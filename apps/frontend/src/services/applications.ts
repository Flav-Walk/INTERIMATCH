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
}

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
