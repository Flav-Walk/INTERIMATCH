import { z } from "zod";
const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.url().optional(),
);
const schema = z.object({
  VITE_API_URL: optionalUrl,
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});
export const environment = schema.safeParse(import.meta.env);
export const config = environment.success ? environment.data : null;
