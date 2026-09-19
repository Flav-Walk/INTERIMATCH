import { z } from "zod";

export const publicJobOfferQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    rome: z.string().trim().max(10).optional(),
    location: z.string().trim().max(100).optional(),
    contract_type: z.string().trim().max(20).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type PublicJobOfferQuery = z.infer<typeof publicJobOfferQuerySchema>;
