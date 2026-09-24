import { api } from "./session";
import {
  missionTemporalState,
  type MissionCapacity,
  type MissionPhase,
  type MissionStatus,
  type NotOpenReason,
} from "./missions";

export type ApplicationStatus = "pending" | "accepted" | "rejected";
export type ApplicationDecision = Exclude<ApplicationStatus, "pending">;

export interface Application {
  id: string;
  mission_id: string;
  worker_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Ce que le serveur dit de la mission avec chaque candidature.
 *
 * Un seul bloc pour les deux côtés : le backend assemble ce contexte par une
 * fonction unique, et deux déclarations divergentes ici reviendraient à décrire
 * différemment la même réponse. La vue entreprise s'en était déjà écartée,
 * ignorant des champs pourtant servis.
 */
export interface ApplicationMissionState {
  /**
   * Statut **écrit**. Trois valeurs seulement sont atteignables : `draft`,
   * `open`, `cancelled`. Une mission complète reste `open` — être pourvue
   * décrit son recrutement, pas son cycle de vie.
   */
  status: MissionStatus;
  /** Position dans le cycle, décidée par le serveur. */
  phase?: MissionPhase;
  /** État du recrutement, servi avec la candidature. */
  capacity?: MissionCapacity;
  recruiting?: boolean;
  recruiting_blocked?: NotOpenReason | null;
}

export interface WorkerApplication extends Omit<Application, "worker_id"> {
  mission: ApplicationMissionState & {
    title: string;
    job: string;
    starts_at: string;
    ends_at: string;
    city: string;
    postal_code: string;
  };
  company: { establishment_name: string | null };
}

export interface MissionApplication extends Omit<Application, "worker_id"> {
  worker: {
    id: string;
    first_name: string;
    last_name: string;
    city: string | null;
    main_job: string | null;
  };
  /**
   * Cette personne a accepté une autre mission qui occupe ce créneau.
   *
   * Un booléen et rien de plus : nommer l'autre mission apprendrait à cette
   * entreprise où travaille l'intérimaire, ce qu'une candidature ne lui donne
   * pas le droit de savoir.
   */
  conflict: boolean;
}

export type WorkerMissionContext =
  | "pending"
  /**
   * En attente, mais tous les postes sont déjà pris.
   *
   * La candidature n'a pas changé de statut — l'entreprise n'a rien décidé à
   * son sujet, et le serveur se garde bien de la refuser d'office. Mais
   * l'afficher comme n'importe quelle candidature en attente laisserait croire
   * qu'elle peut encore aboutir, alors que l'entreprise ne peut déjà plus la
   * retenir. Le statut dit ce qui s'est passé ; ce contexte dit ce qui reste
   * possible.
   */
  | "filled"
  | "rejected"
  | "confirmed"
  | "running"
  | "completed"
  | "cancelled";

export function workerMissionContext(
  application: WorkerApplication,
  now = Date.now(),
): { key: WorkerMissionContext; label: string } {
  const temporal = missionTemporalState(application.mission, now);
  if (temporal === "cancelled")
    return { key: "cancelled", label: "Mission annulée" };
  if (temporal === "completed")
    return { key: "completed", label: "Mission terminée" };
  if (application.status === "accepted")
    return temporal === "running"
      ? { key: "running", label: "Mission en cours" }
      : { key: "confirmed", label: "Mission confirmée" };
  if (application.status === "pending")
    // `recruiting_blocked` vient du serveur : l'interface ne recompte pas les
    // places prises, elle lit la conclusion.
    return application.mission.recruiting_blocked === "full"
      ? { key: "filled", label: "Tous les postes sont pourvus" }
      : { key: "pending", label: "Candidature en attente" };
  return { key: "rejected", label: "Candidature non retenue" };
}

/** Une candidature vue depuis l'entreprise, avec la mission qu'elle vise. */
export interface CompanyApplication extends MissionApplication {
  mission: ApplicationMissionState & {
    id: string;
    title: string;
    job: string;
    starts_at: string;
    ends_at: string;
    city: string;
    headcount: number;
  };
}

export interface CompanyApplications {
  applications: CompanyApplication[];
  counts: {
    pending: number;
    accepted: number;
    rejected: number;
    total: number;
  };
}

/** L'état vide de référence, pour n'avoir jamais à tester `undefined`. */
export const noApplications: CompanyApplications = {
  applications: [],
  counts: { pending: 0, accepted: 0, rejected: 0, total: 0 },
};

export const applicationLabels: Record<ApplicationStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  rejected: "Non retenue",
};

export const applyToMission = (missionId: string) =>
  api<Application>("/workers/me/applications", {
    method: "POST",
    body: JSON.stringify({ mission_id: missionId }),
  });

export const getMyApplication = (missionId: string) =>
  api<{ application: Application | null }>(
    `/workers/me/applications/${encodeURIComponent(missionId)}`,
  );

export const listMyApplications = () =>
  api<{ applications: WorkerApplication[] }>("/workers/me/applications");

/**
 * Toutes les candidatures reçues par l'entreprise, missions confondues.
 *
 * Un seul appel alimente le badge de navigation, le tableau de bord et l'écran
 * Candidatures : trois lectures d'une même question ne justifient pas trois
 * requêtes, et trois requêtes séparées finiraient par se contredire.
 */
export const listCompanyApplications = () =>
  api<CompanyApplications>("/company/me/applications");

/** Candidatures par mission, pour pastiller les cartes sans second appel. */
export function pendingByMission(applications: CompanyApplication[]) {
  const counts = new Map<string, number>();
  for (const one of applications)
    if (one.status === "pending")
      counts.set(one.mission_id, (counts.get(one.mission_id) ?? 0) + 1);
  return counts;
}

export const listMissionApplications = (missionId: string) =>
  api<{
    applications: MissionApplication[];
    capacity: MissionCapacity | null;
  }>(`/missions/${encodeURIComponent(missionId)}/applications`);

export const decideApplication = (
  missionId: string,
  applicationId: string,
  status: ApplicationDecision,
) =>
  api<MissionApplication>(
    `/missions/${encodeURIComponent(missionId)}/applications/${encodeURIComponent(applicationId)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );

export const applicationCandidateName = (application: MissionApplication) =>
  `${application.worker.first_name} ${application.worker.last_name}`.trim() ||
  "Identité non renseignée";

/**
 * Engagements à venir : les missions acceptées qui n'ont pas encore eu lieu.
 *
 * Ce sont elles qui rendent certains créneaux indisponibles au rapprochement,
 * sans rien retirer aux disponibilités déclarées. L'intérimaire doit donc
 * pouvoir les retrouver : sinon, une mission disparaît de ses propositions sans
 * qu'il puisse relier cette absence à quoi que ce soit.
 */
export function upcomingEngagements(applications: WorkerApplication[]) {
  const now = Date.now();
  return applications
    .filter(
      (one) =>
        one.status === "accepted" &&
        one.mission.status !== "cancelled" &&
        // `!== "completed"` figurait ici : statut jamais écrit, et la borne de
        // fin ci-dessous tranche déjà la même question.
        Date.parse(one.mission.ends_at) > now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.mission.starts_at) - Date.parse(b.mission.starts_at),
    );
}

/** Candidatures encore sans réponse. */
export const awaitingReply = (applications: WorkerApplication[]) =>
  applications.filter((one) => one.status === "pending");
