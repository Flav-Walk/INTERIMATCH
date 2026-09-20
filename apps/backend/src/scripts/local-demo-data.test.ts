import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
import { ApplicationService } from "../applications/service.js";
import { PublicJobOfferService } from "../public-data/service.js";
import { MatchingService } from "../matching/service.js";
import {
  LOCAL_DEMO_ACCOUNTS,
  LOCAL_DEMO_PASSWORD,
  seedLocalDemo,
} from "./local-demo-data.js";
import { memoryMediaService } from "../media/testing.js";

// Stockage en memoire : la photo est desormais exigee a la publication.
const missionMedia = memoryMediaService();

describe("jeu de données de démonstration locale", () => {
  const pg = new PGlite();
  let db: Db;
  let accounts: AccountService;
  let missions: MissionService;
  let applications: ApplicationService;
  let publicOffers: PublicJobOfferService;

  beforeAll(async () => {
    for (const name of (await readdir("migrations"))
      .filter((entry) => entry.endsWith(".sql"))
      .sort()) {
      await pg.exec(await readFile(`migrations/${name}`, "utf8"));
    }
    db = {
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
    accounts = new AccountService(db, undefined, geocode);
    const workers = new WorkerService(db, geocode);
    missions = new MissionService(db, geocode, undefined, missionMedia);
    applications = new ApplicationService(db);
    publicOffers = new PublicJobOfferService(db);
    await seedLocalDemo(db, accounts, workers, missions, publicOffers);
  }, 30_000);

  afterAll(async () => pg.close());

  it("sépare quatre comptes demo, dix missions et dix offres importées", async () => {
    const profiles = (
      await db.query<{ email: string; demo: boolean }>(
        "SELECT email,demo FROM profiles ORDER BY email",
      )
    ).rows;
    expect(profiles.map(({ email }) => email)).toEqual(
      [...LOCAL_DEMO_ACCOUNTS].sort(),
    );
    expect(profiles.every(({ demo }) => demo)).toBe(true);
    expect(
      Number(
        (await db.query<{ count: string }>("SELECT count(*) FROM missions"))
          .rows[0].count,
      ),
    ).toBe(10);

    const offers = await publicOffers.list({ page: 1, limit: 20 });
    expect(offers.total).toBe(10);
    expect(offers.offers).toHaveLength(10);
  });

  it("part sans candidature puis crée une vraie candidature backend", async () => {
    const session = await accounts.login(
      "demo.service@example.test",
      LOCAL_DEMO_PASSWORD,
    );
    const worker = await accounts.authenticate(session.access_token);
    expect(await applications.listForWorker(worker.id)).toEqual([]);

    const matching = new MatchingService(db, missions);
    const before = await matching.missionsForWorker(worker.id, true);
    expect(before.matches.length).toBeGreaterThan(0);
    expect(
      before.matches.every(({ match }) => Number.isFinite(match.score)),
    ).toBe(true);

    const missionId = before.matches[0].mission.id;
    await applications.create(worker.id, missionId);
    const created = await applications.listForWorker(worker.id);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      mission_id: missionId,
      status: "pending",
    });

    const after = await matching.missionsForWorker(worker.id, true);
    expect(after.matches.some(({ mission }) => mission.id === missionId)).toBe(
      false,
    );
  });
});
