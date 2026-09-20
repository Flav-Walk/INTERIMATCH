// Serveur local éphémère destiné à la recette humaine. Il est volontairement
// séparé du serveur E2E pour que leurs jeux de données ne puissent pas se mêler.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
import { MissionMediaService } from "../media/service.js";
import { localFixtureMediaStore } from "../media/testing.js";
import { ApplicationService } from "../applications/service.js";
import { PublicJobOfferService } from "../public-data/service.js";
import type { Db } from "../db.js";
import {
  LOCAL_DEMO_ACCOUNTS,
  LOCAL_DEMO_PASSWORD,
  seedLocalDemo,
} from "./local-demo-data.js";

if (process.env.NODE_ENV !== "test")
  throw new Error("Le serveur de démonstration exige NODE_ENV=test.");

const pg = new PGlite();
for (const name of (await readdir("migrations"))
  .filter((entry) => entry.endsWith(".sql"))
  .sort()) {
  await pg.exec(await readFile(`migrations/${name}`, "utf8"));
}

const db: Db = {
  query: (sql, values) => pg.query(sql, values),
  transaction: (work) =>
    pg.transaction((transaction) =>
      work({
        query: (sql, values) => transaction.query(sql, values),
        transaction: () => {
          throw new Error("nested");
        },
      }),
    ),
};
const geocode = async () => ({ latitude: 45.75, longitude: 4.85 });
const accounts = new AccountService(db, undefined, geocode);
const workers = new WorkerService(db, geocode);
const missionMedia = new MissionMediaService(localFixtureMediaStore());
const missions = new MissionService(db, geocode, undefined, missionMedia);
const applications = new ApplicationService(db);
const publicOffers = new PublicJobOfferService(db);

const seeded = await seedLocalDemo(
  db,
  accounts,
  workers,
  missions,
  publicOffers,
);
const port = Number(process.env.DEMO_PORT ?? 3001);
const frontendUrl = process.env.DEMO_FRONTEND_URL ?? "http://127.0.0.1:5174";

createApp(
  readConfig({
    NODE_ENV: "test",
    FRONTEND_URL: frontendUrl,
    AUTH_RATE_LIMIT: "5000",
    RATE_LIMIT: "100000",
  }),
  accounts,
  workers,
  missions,
  undefined,
  applications,
  publicOffers,
  missionMedia,
).listen(port, "127.0.0.1", () => {
  console.info(`InteriMatch demo: ${frontendUrl} -> API ${port}`);
  console.info(`Comptes: ${LOCAL_DEMO_ACCOUNTS.join(", ")}`);
  console.info(`Mot de passe: ${LOCAL_DEMO_PASSWORD}`);
  console.info(`Missions réalistes: ${seeded.missionIds.length}`);
  console.info(
    `Offres France Travail locales: ${seeded.franceTravail.accepted}`,
  );
});
