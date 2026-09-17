import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { MissionService } from "../missions/service.js";
import { missionCreateSchema } from "../missions/schemas.js";
import { ApplicationService } from "./service.js";

const pg = new PGlite();
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
const accounts = new AccountService(db);
const missions = new MissionService(db);
const applications = new ApplicationService(db);
const app = createApp(
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "1000" }),
  accounts,
  undefined,
  missions,
  undefined,
  applications,
);
const password = "Application-test-password-42!";
const authenticated = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

const futureSlot = () => {
  const starts = new Date(Date.now() + 4 * 86_400_000);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 6 * 3_600_000).toISOString(),
  };
};
const draft = (title: string) =>
  missionCreateSchema.parse({
    title,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...futureSlot(),
  });

let ownerToken = "";
let ownerId = "";
let otherCompanyToken = "";
let workerToken = "";
let workerId = "";
let secondWorkerToken = "";
let adminToken = "";

async function publishedMission(title: string) {
  const id = await missions.create(ownerId, draft(title));
  await missions.publish(ownerId, id);
  return id;
}

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  for (const email of [
    "owner.application@example.test",
    "other.application@example.test",
  ])
    await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
      email,
    ]);

  const owner = await accounts.register(
    "owner.application@example.test",
    password,
  );
  ownerToken = owner.access_token;
  ownerId = (await accounts.authenticate(ownerToken)).id;
  otherCompanyToken = (
    await accounts.register("other.application@example.test", password)
  ).access_token;

  const worker = await accounts.register(
    "worker.application@example.test",
    password,
  );
  workerToken = worker.access_token;
  workerId = (await accounts.authenticate(workerToken)).id;
  await db.query(
    "UPDATE profiles SET first_name='Camille',last_name='Martin' WHERE id=$1",
    [workerId],
  );
  await db.query(
    `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
     VALUES($1,'Lyon','69002','serveur')`,
    [workerId],
  );

  secondWorkerToken = (
    await accounts.register("second.worker.application@example.test", password)
  ).access_token;
  const admin = await accounts.register(
    "admin.application@example.test",
    password,
  );
  adminToken = admin.access_token;
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1", [
    (await accounts.authenticate(adminToken)).id,
  ]);
}, 30_000);

afterAll(() => pg.close());

describe("candidatures — création et autorisations worker", () => {
  it("refuse un utilisateur non authentifié", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/workers/me/applications")
          .send({ mission_id: crypto.randomUUID() })
      ).status,
    ).toBe(401);
  });

  it.each([
    ["company", () => ownerToken],
    ["admin", () => adminToken],
  ])("refuse le rôle %s", async (_role, token) => {
    const response = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: crypto.randomUUID() }),
      token(),
    );
    expect(response.status).toBe(403);
  });

  it("crée une candidature persistante et refuse le doublon", async () => {
    const missionId = await publishedMission("Mission candidature unique");
    const created = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      workerToken,
    );
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      mission_id: missionId,
      worker_id: workerId,
      status: "pending",
    });

    const refreshed = await authenticated(
      request(app).get(`/api/v1/workers/me/applications/${missionId}`),
      workerToken,
    );
    expect(refreshed.body.application.id).toBe(created.body.id);

    const list = await authenticated(
      request(app).get("/api/v1/workers/me/applications"),
      workerToken,
    );
    expect(list.body.applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mission_id: missionId, status: "pending" }),
      ]),
    );

    const duplicate = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      workerToken,
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("APPLICATION_ALREADY_EXISTS");
  });

  it("refuse une mission inexistante et un brouillon", async () => {
    const missing = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: crypto.randomUUID() }),
      workerToken,
    );
    expect(missing.status).toBe(404);

    const draftId = await missions.create(ownerId, draft("Brouillon fermé"));
    const closed = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: draftId }),
      workerToken,
    );
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("APPLICATION_CLOSED");
  });

  it("refuse une mission terminée mais conserve la règle actuelle après son début", async () => {
    const endedId = await publishedMission("Mission terminée");
    await db.query(
      "UPDATE missions SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=$1",
      [endedId],
    );
    const ended = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: endedId }),
      secondWorkerToken,
    );
    expect(ended.status).toBe(409);

    const startedId = await publishedMission("Mission commencée");
    await db.query(
      "UPDATE missions SET starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour' WHERE id=$1",
      [startedId],
    );
    const started = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: startedId }),
      secondWorkerToken,
    );
    expect(started.status).toBe(201);
  });
});

describe("candidatures — consultation et décision entreprise", () => {
  it("isole les candidatures par entreprise et ne révèle que les données utiles", async () => {
    const missionId = await publishedMission("Mission avec candidat");
    await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      workerToken,
    );

    const owner = await authenticated(
      request(app).get(`/api/v1/missions/${missionId}/applications`),
      ownerToken,
    );
    expect(owner.status).toBe(200);
    expect(owner.body.applications[0]).toMatchObject({
      mission_id: missionId,
      status: "pending",
      worker: {
        id: workerId,
        first_name: "Camille",
        last_name: "Martin",
        city: "Lyon",
        main_job: "serveur",
      },
    });
    expect(owner.body.applications[0].worker).not.toHaveProperty("email");
    expect(owner.body.applications[0].worker).not.toHaveProperty("phone");

    const foreign = await authenticated(
      request(app).get(`/api/v1/missions/${missionId}/applications`),
      otherCompanyToken,
    );
    expect(foreign.status).toBe(404);
  });

  it("permet uniquement au propriétaire de décider une candidature en attente", async () => {
    const missionId = await publishedMission("Mission à décider");
    const application = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      workerToken,
    );

    const foreign = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "accepted" }),
      otherCompanyToken,
    );
    expect(foreign.status).toBe(404);

    const workerDecision = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "accepted" }),
      workerToken,
    );
    expect(workerDecision.status).toBe(403);

    const accepted = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "accepted" }),
      ownerToken,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("accepted");

    const workerView = await authenticated(
      request(app).get(`/api/v1/workers/me/applications/${missionId}`),
      workerToken,
    );
    expect(workerView.body.application.status).toBe("accepted");

    const secondDecision = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "rejected" }),
      ownerToken,
    );
    expect(secondDecision.status).toBe(409);
    expect(secondDecision.body.error.code).toBe("APPLICATION_ALREADY_DECIDED");
  });

  it("refuse une transition ou une propriété supplémentaire", async () => {
    const missionId = await publishedMission("Mission statut invalide");
    const application = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      workerToken,
    );
    const invalid = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "pending" }),
      ownerToken,
    );
    expect(invalid.status).toBe(400);

    const extra = await authenticated(
      request(app)
        .patch(
          `/api/v1/missions/${missionId}/applications/${application.body.id}`,
        )
        .send({ status: "rejected", worker_id: workerId }),
      ownerToken,
    );
    expect(extra.status).toBe(400);
  });
});
