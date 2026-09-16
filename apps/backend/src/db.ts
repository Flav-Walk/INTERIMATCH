import { Pool, type QueryResultRow } from "pg";
import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";
import type { Config } from "./config.js";
// Verification stays on unless the operator disables it explicitly outside production.
export function sslOptions(config: Config): ConnectionOptions | undefined {
  if (!config.DB_SSL) return undefined;
  if (config.DB_SSL_CA_PATH)
    return {
      ca: readFileSync(config.DB_SSL_CA_PATH, "utf8"),
      rejectUnauthorized: true,
    };
  return { rejectUnauthorized: !config.DB_SSL_INSECURE };
}
export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
  transaction<T>(work: (db: Db) => Promise<T>): Promise<T>;
}
export function createDatabase(
  config: Config,
): Db & { close: () => Promise<void> } {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    ssl: sslOptions(config),
  });
  const db: Db & { close: () => Promise<void> } = {
    query: (sql, values) => pool.query(sql, values),
    close: () => pool.end(),
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work({
          query: (sql, values) => client.query(sql, values),
          transaction: async () => {
            throw new Error("Nested transaction unsupported");
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
  return db;
}
