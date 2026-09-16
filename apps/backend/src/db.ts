import { Pool, type QueryResultRow } from "pg";
import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";
import type { Config } from "./config.js";

/**
 * TLS de la connexion PostgreSQL.
 *
 * Supabase présente le pooler avec sa propre autorité, absente des magasins système.
 * DB_SSL_CA_PATH permet de fournir ce certificat et d'obtenir une vérification complète.
 * Il reste facultatif : sans lui, la connexion est chiffrée mais le certificat n'est pas
 * vérifié — c'est le mode de fonctionnement par défaut sur Render.
 *
 * Un chemin illisible ne doit jamais empêcher le serveur de démarrer : on le signale et
 * on retombe sur le chiffrement sans vérification, plutôt que de planter au boot.
 */
export function sslOptions(config: Config): ConnectionOptions | undefined {
  if (!config.DB_SSL) return undefined;
  if (config.DB_SSL_CA_PATH) {
    try {
      return {
        ca: readFileSync(config.DB_SSL_CA_PATH, "utf8"),
        rejectUnauthorized: true,
      };
    } catch {
      console.warn(
        JSON.stringify({
          event: "db_ssl_ca_unreadable",
          message:
            "DB_SSL_CA_PATH illisible : connexion TLS sans vérification du certificat.",
        }),
      );
    }
  }
  return { rejectUnauthorized: false };
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
