import { api } from "./session";

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

export interface WorkerApplication extends Omit<Application, "worker_id"> {
  mission: {
    title: string;
    job: string;
    starts_at: string;
    ends_at: string;
    city: string;
    postal_code: string;
    status: string;
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

/** Une candidature vue depuis l'entreprise, avec la mission qu'elle vise. */
export interface CompanyApplication extends MissionApplication {
  mission: {
    id: string;
    title: string;
    job: string;
    starts_at: string;
    ends_at: string;
    city: string;
    status: string;
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
  rejected: "Refusée",
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
  api<{ applications: MissionApplication[] }>(
    `/missions/${encodeURIComponent(missionId)}/applications`,
  );

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
