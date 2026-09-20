import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
import { AdminService } from "../admin/service.js";
import { ApplicationService } from "../applications/service.js";
import { PublicJobOfferService } from "./service.js";
import { memoryMediaService } from "../media/testing.js";

// Stockage en memoire : la photo est desormais exigee a la publication.
const missionMedia = memoryMediaService();

describe("Routing regression: public offers isolation and historical routes", () => {
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

  const geocode = async () => ({ latitude: 45.75, longitude: 4.85 });
  const accounts = new AccountService(db, undefined, geocode);
  const workers = new WorkerService(db, geocode);
  const missions = new MissionService(db, geocode, undefined, missionMedia);
  const admin = new AdminService(db);
  const applications = new ApplicationService(db);
  const publicOffers = new PublicJobOfferService(db);

  const config = readConfig({
    NODE_ENV: "test",
    RATE_LIMIT: "1000",
    AUTH_RATE_LIMIT: "1000",
  });

  const app = createApp(
    config,
    accounts,
    workers,
    missions,
    admin,
    applications,
    publicOffers,
  );

  const origin = config.FRONTEND_URL;
  const password = "Regression-test-pass-42!";

  let workerToken = "";
  let companyToken = "";
  let adminToken = "";
  const sampleOfferExternalId = "SAMPLE-RT-01";

  beforeAll(async () => {
    for (const name of (await readdir("migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await pg.exec(await readFile(`migrations/${name}`, "utf8"));
    }

    await db.query(
      "INSERT INTO company_accounts(email, label) VALUES ($1, 'Entreprise Test')",
      ["company.routing@example.test"],
    );

    await publicOffers.importFromPayload([
      {
        id: sampleOfferExternalId,
        intitule: "Serveur polyvalent (H/F)",
        description: "Service en salle et accueil des clients.",
        dateCreation: "2026-09-19T08:00:00.000Z",
        dateActualisation: "2026-09-19T10:00:00.000Z",
        romeCode: "G1803",
        romeLibelle: "Service en restauration",
        typeContrat: "MIS",
        lieuTravail: {
          libelle: "69 - Lyon 2e",
          codePostal: "69002",
        },
      },
    ]);
  }, 30000);

  afterAll(() => pg.close());

  describe("A & B. Auth routes are not intercepted by requireAuth", () => {
    it("POST /api/v1/auth/register creates accounts without authentication", async () => {
      const workerRes = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", origin)
        .send({ email: "worker.routing@example.test", password });

      expect(workerRes.status).toBe(201);
      expect(workerRes.body.access_token).toBeTruthy();
      workerToken = workerRes.body.access_token;

      const companyRes = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", origin)
        .send({ email: "company.routing@example.test", password });

      expect(companyRes.status).toBe(201);
      expect(companyRes.body.access_token).toBeTruthy();
      companyToken = companyRes.body.access_token;

      const adminRes = await request(app)
        .post("/api/v1/auth/register")
        .set("Origin", origin)
        .send({ email: "admin.routing@example.test", password });

      expect(adminRes.status).toBe(201);
      adminToken = adminRes.body.access_token;
      const adminProfile = await accounts.authenticate(adminToken);
      await db.query("UPDATE profiles SET role='admin' WHERE id=$1", [
        adminProfile.id,
      ]);
    });

    it("POST /api/v1/auth/login performs real login through Express and reaches auth controller", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", origin)
        .send({ email: "worker.routing@example.test", password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.access_token).toBeTruthy();
      expect(loginRes.body.expires_in).toBeTruthy();

      const badLoginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", origin)
        .send({
          email: "worker.routing@example.test",
          password: "wrong-password",
        });

      expect(badLoginRes.status).toBe(401);
      expect(badLoginRes.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("C, D, E & F. Public job offers access control and routing", () => {
    it("C. GET /api/v1/public-job-offers without authentication returns 401", async () => {
      const res = await request(app).get("/api/v1/public-job-offers");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("D. GET /api/v1/public-job-offers with company user returns 403", async () => {
      const res = await request(app)
        .get("/api/v1/public-job-offers")
        .set("Authorization", `Bearer ${companyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("E. GET /api/v1/public-job-offers with worker user reaches public-data router", async () => {
      const res = await request(app)
        .get("/api/v1/public-job-offers")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.offers).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.offers[0].external_id).toBe(sampleOfferExternalId);
    });

    it("F. GET /api/v1/public-job-offers/:id with worker user reaches public-data router", async () => {
      const res = await request(app)
        .get(`/api/v1/public-job-offers/${sampleOfferExternalId}`)
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.external_id).toBe(sampleOfferExternalId);
      expect(res.body.title).toBe("Serveur polyvalent (H/F)");
    });

    it("GET /api/v1/public-job-offers/:id returns 404 for unknown offer", async () => {
      const res = await request(app)
        .get("/api/v1/public-job-offers/non-existent-id")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Historical routes remain accessible per contract", () => {
    it("auth: GET /api/v1/me is accessible to worker and company", async () => {
      const workerMe = await request(app)
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerMe.status).toBe(200);
      expect(workerMe.body.role).toBe("worker");

      const companyMe = await request(app)
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyMe.status).toBe(200);
      expect(companyMe.body.role).toBe("company");
    });

    it("worker: GET /api/v1/workers/me is restricted to worker", async () => {
      const workerRes = await request(app)
        .get("/api/v1/workers/me")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerRes.status).toBe(200);

      const companyRes = await request(app)
        .get("/api/v1/workers/me")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyRes.status).toBe(403);
    });

    it("company: GET /api/v1/companies/me is restricted to company", async () => {
      const companyRes = await request(app)
        .get("/api/v1/companies/me")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyRes.status).toBe(200);

      const workerRes = await request(app)
        .get("/api/v1/companies/me")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerRes.status).toBe(403);
    });

    it("admin: GET /api/v1/admin/users is restricted to admin", async () => {
      const adminRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      const workerRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerRes.status).toBe(403);

      const companyRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyRes.status).toBe(403);
    });

    it("missions: GET /api/v1/missions is restricted to company, GET /api/v1/workers/me/missions to worker", async () => {
      const companyMissions = await request(app)
        .get("/api/v1/missions")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyMissions.status).toBe(200);

      const workerMissions = await request(app)
        .get("/api/v1/missions")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerMissions.status).toBe(403);

      const workerMeMissions = await request(app)
        .get("/api/v1/workers/me/missions")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerMeMissions.status).toBe(200);

      const companyMeMissions = await request(app)
        .get("/api/v1/workers/me/missions")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyMeMissions.status).toBe(403);
    });

    it("applications: GET /api/v1/workers/me/applications is restricted to worker, GET /api/v1/company/me/applications to company", async () => {
      const workerApps = await request(app)
        .get("/api/v1/workers/me/applications")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerApps.status).toBe(200);

      const companyApps = await request(app)
        .get("/api/v1/company/me/applications")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyApps.status).toBe(200);

      const workerDeniedCompanyApps = await request(app)
        .get("/api/v1/company/me/applications")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(workerDeniedCompanyApps.status).toBe(403);

      const companyDeniedWorkerApps = await request(app)
        .get("/api/v1/workers/me/applications")
        .set("Authorization", `Bearer ${companyToken}`);
      expect(companyDeniedWorkerApps.status).toBe(403);
    });
  });
});
