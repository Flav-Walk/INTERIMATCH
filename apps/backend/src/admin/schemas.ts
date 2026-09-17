import { z } from "zod";

export const adminRoles = ["worker", "company", "admin"] as const;

export const roleUpdateSchema = z.object({ role: z.enum(adminRoles) }).strict();
