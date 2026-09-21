import { z } from "zod";

export const contractStatusValues = [
  "draft",
  "awaiting_worker_signature",
  "awaiting_company_signature",
  "awaiting_finalization",
  "completed",
  "cancelled",
] as const;

export type ContractStatus = (typeof contractStatusValues)[number];

export const contractSignSchema = z
  .object({ accepted: z.literal(true) })
  .strict();

export interface ContractSnapshot {
  generated_at: string;
  legal_notice: string;
  application: {
    id: string;
    accepted_at: string;
  };
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
}

export interface ContractSignatureEvent {
  id: string;
  actor_id: string;
  actor_role: "worker" | "company";
  action: "worker_signed" | "company_signed";
  from_status: ContractStatus;
  to_status: ContractStatus;
  document_version: number;
  declaration_version: string;
  created_at: string;
}

export interface ContractRow {
  id: string;
  application_id: string;
  mission_id: string;
  worker_id: string;
  company_id: string;
  type: "mission_agreement";
  status: ContractStatus;
  document_version: number;
  snapshot: ContractSnapshot;
  original_file_path: string | null;
  final_file_path: string | null;
  original_sha256: string | null;
  final_sha256: string | null;
  worker_signed_at: string | null;
  company_signed_at: string | null;
  completed_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractListItem = Omit<
  ContractRow,
  | "snapshot"
  | "original_file_path"
  | "final_file_path"
  | "original_sha256"
  | "final_sha256"
  | "last_error_code"
> & {
  mission: Pick<ContractSnapshot["mission"], "id" | "title" | "starts_at">;
  worker: Pick<ContractSnapshot["worker"], "id" | "first_name" | "last_name">;
  company: Pick<
    ContractSnapshot["company"],
    "id" | "legal_name" | "establishment_name"
  >;
};
