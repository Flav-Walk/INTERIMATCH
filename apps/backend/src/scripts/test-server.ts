// Ephemeral PostgreSQL engine for browser tests; never connects to remote services.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { AccountService } from "../auth/service.js";
import type { Db } from "../db.js";
if (process.env.NODE_ENV !== "test")
  throw new Error("Test server requires NODE_ENV=test");
const pg = new PGlite();
for (const name of (await readdir("migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort())
  await pg.exec(await readFile("migrations/" + name, "utf8"));
const db: Db = {
  query: (sql, values) => pg.query(sql, values),
  transaction: (work) =>
    pg.transaction((tx) =>
      work({
        query: (sql, values) => tx.query(sql, values),
        transaction: () => {
          throw new Error("nested");
        },
      }),
    ),
};
// Fixture navigateur : une adresse entreprise par projet Playwright, pour que les
// projets desktop et mobile ne se disputent pas le même compte.
await pg.exec(
  "INSERT INTO company_accounts(email,label) VALUES ('company.desktop@example.test','E2E'),('company.mobile@example.test','E2E') ON CONFLICT DO NOTHING",
);
createApp(
  readConfig({ NODE_ENV: "test", FRONTEND_URL: "http://127.0.0.1:5174" }),
  new AccountService(db),
).listen(3001, "127.0.0.1");
