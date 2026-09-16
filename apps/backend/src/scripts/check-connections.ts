import "dotenv/config";
import { readFile } from "node:fs/promises";
import { readConfig } from "../config.js";
import { createDatabase } from "../db.js";
const config = readConfig(process.env);
const frontend = await readFile(
  "../../../InteriMatch-frontend/apps/frontend/.env.local",
  "utf8",
);
const publishable = frontend
  .match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]
  ?.trim();
if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY || !publishable)
  throw new Error("Configuration Supabase manquante.");
for (const [label, key, path] of [
  ["publishable", publishable, "/auth/v1/settings"],
  [
    "server",
    config.SUPABASE_SECRET_KEY,
    "/auth/v1/admin/users?page=1&per_page=1",
  ],
]) {
  const response = await fetch(config.SUPABASE_URL + path, {
    headers: { apikey: key, Authorization: "Bearer " + key },
  });
  if (!response.ok)
    throw new Error(label + " connection failed: " + response.status);
  console.info(label + ": OK");
}
const db = createDatabase(config);
try {
  const result = await db.query(
    "SELECT current_database() AS database,current_user AS role",
  );
  console.info("PostgreSQL authenticated:", result.rows[0]);
  const tables = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  console.info(
    "Public tables:",
    tables.rows.map((r) => r.tablename),
  );
} finally {
  await db.close();
}
