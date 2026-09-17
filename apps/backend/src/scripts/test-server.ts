// Ephemeral PostgreSQL engine for browser tests; never connects to remote services.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
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
const projects = ["desktop", "mobile"] as const;
await pg.exec(
  `INSERT INTO company_accounts(email,label) VALUES
     ('company.desktop@example.test','E2E'),('company.mobile@example.test','E2E'),
     ('missions.desktop@example.test','E2E'),('missions.mobile@example.test','E2E'),
     -- Compte laissé vide : le parcours de création part d'une liste sans
     -- mission, donc ses décomptes ne dépendent d'aucune autre fixture.
     ('crud.desktop@example.test','E2E'),('crud.mobile@example.test','E2E')
   ON CONFLICT DO NOTHING`,
);

// Géocodeur déterministe : la suite navigateur n'appelle aucun service distant.
const geocode = async () => ({ latitude: 45.75, longitude: 4.85 });
const accounts = new AccountService(db);
const workers = new WorkerService(db, geocode);
const missions = new MissionService(db, geocode);

/**
 * Compte entreprise pré-rempli avec des missions, pour que la suite navigateur
 * puisse vérifier la liste et les filtres sur des données réelles plutôt que sur
 * un écran vide. Ce compte n'existe que dans ce serveur éphémère.
 */
const slot = (dayOffset: number, hour: number, hours: number) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + hours * 3600_000).toISOString(),
  };
};

for (const project of projects) {
  const email = `missions.${project}@example.test`;
  const { access_token } = await accounts.register(
    email,
    "Browser-test-password-42!",
  );
  const profile = await accounts.authenticate(access_token);
  const drafts = [
    {
      title: "Serveur en restauration",
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      headcount: 2,
      publish: true,
      ...slot(4, 16, 8),
    },
    {
      title: "Hôte d'accueil salon",
      job: "hote_accueil",
      city: "Lyon",
      postal_code: "69003",
      headcount: 1,
      publish: true,
      ...slot(9, 10, 8),
    },
    {
      title: "Commis de cuisine brunch",
      job: "commis_cuisine",
      city: "Villeurbanne",
      postal_code: "69100",
      headcount: 1,
      publish: false,
      ...slot(16, 9, 6),
    },
  ];
  for (const { publish, ...input } of drafts) {
    const id = await missions.create(profile.id, {
      description: "Mission de test navigateur.",
      address: "",
      pay_amount: null,
      pay_unit: null,
      min_years_experience: null,
      required_skill_ids: [],
      desired_skill_ids: [],
      ...input,
    });
    if (publish)
      await db.query(
        "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
        [id],
      );
  }
}

createApp(
  readConfig({
    NODE_ENV: "test",
    FRONTEND_URL: "http://127.0.0.1:5174",
    // Le harnais navigateur enchaîne les parcours depuis une seule IP.
    AUTH_RATE_LIMIT: "5000",
    RATE_LIMIT: "100000",
  }),
  accounts,
  workers,
  missions,
).listen(3001, "127.0.0.1");
