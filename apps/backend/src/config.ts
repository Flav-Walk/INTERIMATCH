import { z } from "zod";
const optional = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();
const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.url().optional(),
);
export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_SECRET_KEY: optional,
  DB_SSL: z.preprocess(
    (v) => (v === undefined ? true : v === true || v === "true"),
    z.boolean(),
  ),
  // Supabase serves the pooler with its own authority: supply that CA to keep
  // certificate verification enabled. DB_SSL_INSECURE is a local-only fallback.
  DB_SSL_CA_PATH: optional,
  DB_SSL_INSECURE: z.preprocess((v) => v === true || v === "true", z.boolean()),
  DATABASE_URL: optional,
  MONGODB_URI: optional,
  BREVO_API_KEY: optional,
  BREVO_SENDER_EMAIL: optional,
  BREVO_SENDER_NAME: optional,
  N8N_WEBHOOK_URL: optionalUrl,
  N8N_WEBHOOK_SECRET: optional,
  WEBHOOK_SIGNING_SECRET: optional,
});
export type Config = z.infer<typeof environmentSchema>;
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const result = environmentSchema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== "")),
  );
  if (!result.success)
    throw new Error(
      `Configuration invalide : ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const config = result.data;
  if (new URL(config.FRONTEND_URL).origin !== config.FRONTEND_URL)
    throw new Error("FRONTEND_URL doit être une origine sans chemin");
  if (config.DB_SSL_INSECURE && config.NODE_ENV === "production")
    throw new Error(
      "DB_SSL_INSECURE est interdit en production : fournir DB_SSL_CA_PATH",
    );
  return config;
}
