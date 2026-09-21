import { api, apiBlob, type Role } from "./session";

export type ContractStatus =
  | "draft"
  | "awaiting_worker_signature"
  | "awaiting_company_signature"
  | "awaiting_finalization"
  | "completed"
  | "cancelled";

export interface ContractPartySummary {
  id: string;
  first_name?: string;
  last_name?: string;
  legal_name?: string | null;
  establishment_name?: string | null;
}

export interface ContractListItem {
  id: string;
  application_id: string;
  mission_id: string;
  worker_id: string;
  company_id: string;
  type: "mission_agreement";
  status: ContractStatus;
  document_version: number;
  worker_signed_at: string | null;
  company_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  mission: { id: string; title: string; starts_at: string };
  worker: ContractPartySummary;
  company: ContractPartySummary;
}

export interface ContractDetail
  extends Omit<ContractListItem, "mission" | "worker" | "company"> {
  snapshot: {
    generated_at: string;
    legal_notice: string;
    application: { id: string; accepted_at: string };
    worker: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      city: string | null;
      postal_code: string | null;
    };
    company: {
      id: string;
      legal_name: string | null;
      establishment_name: string | null;
      representative_first_name: string;
      representative_last_name: string;
      email: string;
      phone: string | null;
      address: string | null;
      city: string | null;
      postal_code: string | null;
      sector: string | null;
    };
    mission: {
      id: string;
      title: string;
      description: string;
      job: string;
      starts_at: string;
      ends_at: string;
      address: string;
      city: string;
      postal_code: string;
      pay_amount: string | null;
      pay_unit: string | null;
      headcount: number;
    };
  };
  signatures: Array<{
    id: string;
    actor_role: "worker" | "company";
    created_at: string;
  }>;
  download_available: boolean;
}

export const listDocuments = (role: "worker" | "company") =>
  api<{ documents: ContractListItem[] }>(
    role === "worker" ? "/workers/me/documents" : "/company/me/documents",
  );

export const getDocument = (id: string) =>
  api<ContractDetail>(`/documents/${encodeURIComponent(id)}`);

export const signDocument = (id: string) =>
  api<ContractDetail>(`/documents/${encodeURIComponent(id)}/sign`, {
    method: "POST",
    body: JSON.stringify({ accepted: true }),
  });

export async function downloadDocument(id: string) {
  const blob = await apiBlob(`/documents/${encodeURIComponent(id)}/download`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `interimatch-document-${id}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function documentStatus(status: ContractStatus, role: Role) {
  const shared: Partial<Record<ContractStatus, string>> = {
    draft: "En préparation",
    awaiting_finalization: "Finalisation en cours",
    completed: "Finalisé",
    cancelled: "Annulé",
  };
  if (shared[status]) return shared[status]!;
  if (status === "awaiting_worker_signature")
    return role === "worker" ? "À valider" : "En attente de l’intérimaire";
  return role === "company" ? "À valider" : "En attente de l’entreprise";
}

export const canSignDocument = (status: ContractStatus, role: Role) =>
  (role === "worker" && status === "awaiting_worker_signature") ||
  (role === "company" && status === "awaiting_company_signature");
