// Ephemeral PostgreSQL engine for browser tests; never connects to remote services.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { AccountService } from "../auth/service.js";
import type { Db } from "../db.js";
if (process.env.NODE_ENV !== "test")
  throw new Error("Test server requires NODE_ENV=test");
const pg = new PGlite();
await pg.exec(await readFile("migrations/001_accounts.sql", "utf8"));
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
createApp(
  readConfig({ NODE_ENV: "test", FRONTEND_URL: "http://127.0.0.1:5174" }),
  new AccountService(db),
).listen(3001, "127.0.0.1");
