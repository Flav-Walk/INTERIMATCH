import { createClient } from "@supabase/supabase-js";
import { MongoClient } from "mongodb";
import { Pool } from "pg";
import type { Config } from "../config.js";
// Factories only: no network connection until explicitly used by a future service.
export function createSupabaseAdmin(config: Config) {
  if (
    !config.SUPABASE_URL ||
    !(config.SUPABASE_SECRET_KEY ?? config.SUPABASE_SERVICE_ROLE_KEY)
  )
    throw new Error("Supabase serveur non configuré");
  return createClient(
    config.SUPABASE_URL,
    (config.SUPABASE_SECRET_KEY ?? config.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
export function createPostgresPool(config: Config) {
  if (!config.DATABASE_URL) throw new Error("PostgreSQL non configuré");
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
}
export function createMongoClient(config: Config) {
  if (!config.MONGODB_URI) throw new Error("MongoDB non configuré");
  return new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 5,
  });
}
