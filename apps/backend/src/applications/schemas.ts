import { z } from "zod";

export const applicationStatusValues = [
  "pending",
  "accepted",
  "rejected",
] as const;

export type ApplicationStatus = (typeof applicationStatusValues)[number];

export const applicationCreateSchema = z
  .object({ mission_id: z.uuid() })
  .strict();

export const applicationDecisionSchema = z
  .object({ status: z.enum(["accepted", "rejected"]) })
  .strict();
