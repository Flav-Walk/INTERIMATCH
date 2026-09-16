import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createDatabase } from "../db.js";
import { readConfig } from "../config.js";
const db = createDatabase(readConfig(process.env));
try {
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(901001)");
    await tx.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    await tx.query("ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY");
    await tx.query("REVOKE ALL ON schema_migrations FROM PUBLIC");
    for (const name of (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile("migrations/" + name, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = (
        await tx.query<{ checksum: string }>(
          "SELECT checksum FROM schema_migrations WHERE name=$1",
          [name],
        )
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error("Migration checksum mismatch: " + name);
        continue;
      }
      await tx.query(sql);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.info("Applied " + name);
    }
  });
} catch (e) {
  console.error("Migration failed:", e instanceof Error ? e.name : "unknown");
  process.exitCode = 1;
} finally {
  await db.close();
}
