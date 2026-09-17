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
  // Nombre de proxies de confiance devant l'application. 0 = aucun (Express ignore
  // X-Forwarded-For et utilise l'IP de la socket). Render place exactement un proxy
  // devant le service, d'où la valeur 1 par défaut en production. Jamais `true` :
  // cela laisserait n'importe qui usurper son IP et contourner le rate limiting.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  // Tentatives d'authentification par IP et par quart d'heure. Configurable pour
  // que les harnais de test puissent enchaîner des parcours sans être bridés ;
  // la valeur de production reste volontairement basse.
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(100000).default(30),
  // Requêtes par IP et par minute, toutes routes confondues.
  RATE_LIMIT: z.coerce.number().int().min(1).max(1000000).default(100),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_SECRET_KEY: optional,
  DB_SSL: z.preprocess(
    (v) => (v === undefined ? true : v === true || v === "true"),
    z.boolean(),
  ),
  // Optionnel : certificat d'autorité Supabase. Fourni, la vérification du certificat
  // est active ; absent, la connexion reste chiffrée mais non vérifiée.
  DB_SSL_CA_PATH: optional,
  DATABASE_URL: optional,
  MONGODB_URI: optional,
  BREVO_API_KEY: optional,
  BREVO_SENDER_EMAIL: optional,
  BREVO_SENDER_NAME: optional,
  N8N_WEBHOOK_URL: optionalUrl,
  N8N_WEBHOOK_SECRET: optional,
  WEBHOOK_SIGNING_SECRET: optional,
});
export type Config = z.infer<typeof environmentSchema> & {
  TRUST_PROXY: number;
};
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const result = environmentSchema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== "")),
  );
  if (!result.success)
    throw new Error(
      `Configuration invalide : ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const config = result.data;
  if (Boolean(config.N8N_WEBHOOK_URL) !== Boolean(config.N8N_WEBHOOK_SECRET))
    throw new Error(
      "Configuration invalide : N8N_WEBHOOK_URL et N8N_WEBHOOK_SECRET doivent être définis ensemble",
    );
  if (new URL(config.FRONTEND_URL).origin !== config.FRONTEND_URL)
    throw new Error("FRONTEND_URL doit être une origine sans chemin");
  return {
    ...config,
    TRUST_PROXY:
      config.TRUST_PROXY ?? (config.NODE_ENV === "production" ? 1 : 0),
  };
}
