import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService, digest } from "./service.js";
const pg = new PGlite();
const db: Db = {
  query: async (sql, values) => pg.query(sql, values),
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
const service = new AccountService(db);
const app = createApp(readConfig({ NODE_ENV: "test" }), service);
const origin = "http://localhost:5173";
const password = "Test-only-password-42!";
let worker = "",
  company = "",
  refresh = "";
let workerId = "";
const auth = (r: request.Test, t = worker) =>
  r.set("Authorization", "Bearer " + t);
beforeAll(async () => {
  await pg.exec(await readFile("migrations/001_accounts.sql", "utf8"));
}, 20000);
afterAll(() => pg.close());
describe("auth and onboarding with real SQL engine", () => {
  it("refuses missing token", async () => {
    expect((await request(app).get("/api/v1/me")).status).toBe(401);
  });
  it("refuses invalid token", async () => {
    expect((await auth(request(app).get("/api/v1/me"), "invalid")).status).toBe(
      401,
    );
  });
  it("blocks cross-origin auth", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .send({ email: "worker@example.test", password })
      ).status,
    ).toBe(403);
  });
  it("validates email and password", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .set("Origin", origin)
          .send({ email: "bad", password: "short" })
      ).status,
    ).toBe(400);
  });
  it("registers with hash and opaque session", async () => {
    const r = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({ email: "worker@example.test", password });
    expect(r.status).toBe(201);
    worker = r.body.access_token;
    refresh = r.headers["set-cookie"][0].split(";")[0];
    expect(r.headers["set-cookie"][0]).toContain("HttpOnly");
    const c = await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM credentials",
    );
    expect(c.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(c.rows[0].password_hash).not.toBe(password);
  });
  it("returns me with null role before onboarding", async () => {
    const r = await auth(request(app).get("/api/v1/me"));
    expect(r.status).toBe(200);
    expect(r.body.role).toBeNull();
    expect(r.body.onboarding_completed).toBe(false);
    workerId = r.body.id;
  });
  it("rejects duplicate registration atomically", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .set("Origin", origin)
          .send({ email: "worker@example.test", password })
      ).status,
    ).toBe(409);
  });
  it("rejects bad password and unknown account", async () => {
    for (const email of ["worker@example.test", "missing@example.test"])
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .set("Origin", origin)
            .send({ email, password: "wrong" })
        ).status,
      ).toBe(401);
  });
  it("logs in using password", async () => {
    const r = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email: "worker@example.test", password });
    expect(r.status).toBe(200);
  });
  it("forbids admin self assignment", async () => {
    expect(
      (await auth(request(app).put("/api/v1/me/role")).send({ role: "admin" }))
        .status,
    ).toBe(400);
  });
  it("selects worker role and locks it", async () => {
    expect(
      (await auth(request(app).put("/api/v1/me/role")).send({ role: "worker" }))
        .status,
    ).toBe(200);
    expect(
      (
        await auth(request(app).put("/api/v1/me/role")).send({
          role: "company",
        })
      ).status,
    ).toBe(409);
  });
  it("worker allowed and company forbidden", async () => {
    expect((await auth(request(app).get("/api/v1/workers/me"))).status).toBe(
      200,
    );
    expect((await auth(request(app).get("/api/v1/companies/me"))).status).toBe(
      403,
    );
  });
  it("validates incomplete worker input", async () => {
    expect(
      (
        await auth(request(app).put("/api/v1/onboarding/worker")).send({
          first_name: "Jimmy",
        })
      ).status,
    ).toBe(400);
  });
  it("persists complete worker profile transactionally", async () => {
    const skills = (await auth(request(app).get("/api/v1/skills"))).body;
    const input = {
      first_name: "Jimmy",
      last_name: "Demo",
      city: "Lyon",
      postal_code: "69002",
      latitude: 45.75,
      longitude: 4.85,
      main_job: "Serveur",
      mobility_radius_km: 15,
      skill_ids: [skills[0].id],
      experiences: [
        { job_title: "Serveur", employer: "Restaurant fictif", years: 2 },
      ],
      availabilities: [
        { starts_at: "2027-01-02T12:00:00Z", ends_at: "2027-01-02T20:00:00Z" },
      ],
    };
    const r = await auth(request(app).put("/api/v1/onboarding/worker")).send(
      input,
    );
    expect(r.status).toBe(200);
    expect(r.body.onboarding_completed).toBe(true);
    expect(r.body.profile.skills).toHaveLength(1);
    expect(r.body.profile.availabilities).toHaveLength(1);
    expect(
      (
        await auth(request(app).put("/api/v1/onboarding/worker")).send({
          ...input,
          role: "admin",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth(request(app).put("/api/v1/onboarding/worker")).send({
          ...input,
          skill_ids: ["00000000-0000-4000-8000-000000000001"],
        })
      ).status,
    ).toBe(400);
    expect(
      (await auth(request(app).get("/api/v1/me"))).body.profile.skills,
    ).toHaveLength(1);
  });
  it("rejects expired access, refreshes via cookie and invalidates old bearer", async () => {
    await db.query(
      "UPDATE sessions SET access_expires_at=now()-interval '1 hour' WHERE access_hash=$1",
      [digest(worker)],
    );
    expect((await auth(request(app).get("/api/v1/me"))).status).toBe(401);
    const r = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", refresh);
    expect(r.status).toBe(200);
    worker = r.body.access_token;
    expect((await auth(request(app).get("/api/v1/me"))).status).toBe(200);
  });
  it("company allowed and worker forbidden", async () => {
    company = (await service.register("company@example.test", password))
      .access_token;
    expect(
      (
        await auth(request(app).put("/api/v1/me/role"), company).send({
          role: "company",
        })
      ).status,
    ).toBe(200);
    expect(
      (await auth(request(app).get("/api/v1/companies/me"), company)).status,
    ).toBe(200);
    expect(
      (await auth(request(app).get("/api/v1/workers/me"), company)).status,
    ).toBe(403);
    expect(
      (
        await auth(request(app).put("/api/v1/onboarding/worker"), company).send(
          {},
        )
      ).status,
    ).toBe(403);
  });
  it("persists company separately without modifying worker", async () => {
    const r = await auth(
      request(app).put("/api/v1/onboarding/company"),
      company,
    ).send({
      first_name: "Jimmy",
      last_name: "Company",
      city: "Lyon",
      postal_code: "69002",
      latitude: 45.75,
      longitude: 4.85,
      legal_name: "Demo SARL",
      establishment_name: "Brasserie fictive",
      sector: "brasserie",
      address: "1 rue de démonstration",
      phone: "+33000000000",
      description: "Établissement de test",
    });
    expect(r.status).toBe(200);
    expect(r.body.id).not.toBe(workerId);
    expect(r.body.onboarding_completed).toBe(true);
    expect((await auth(request(app).get("/api/v1/me"))).body.last_name).toBe(
      "Demo",
    );
  });
  it("revokes bearer and refresh on logout", async () => {
    expect(
      (
        await auth(request(app).post("/api/v1/auth/logout"))
          .set("Origin", origin)
          .set("Cookie", refresh)
      ).status,
    ).toBe(204);
    expect((await auth(request(app).get("/api/v1/me"))).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", origin)
          .set("Cookie", refresh)
      ).status,
    ).toBe(401);
  });
  it("rejects expired refresh", async () => {
    const s = await service.login("worker@example.test", password);
    await db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 hour' WHERE refresh_hash=$1",
      [digest(s.refresh_token)],
    );
    await expect(service.refresh(s.refresh_token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("does not silently merge Google and password identities", async () => {
    const google = new AccountService(db, async () => ({
      id: "00000000-0000-4000-8000-000000000009",
      email: "worker@example.test",
    }));
    await expect(google.google("provider-token")).rejects.toMatchObject({
      code: "IDENTITY_CONFLICT",
    });
  });
  it("refuses Google when the provider bridge is absent", async () => {
    await expect(service.google("provider-token")).rejects.toMatchObject({
      status: 503,
      code: "GOOGLE_UNAVAILABLE",
    });
  });
  it("creates one InteriMatch profile for a Google identity and reuses it", async () => {
    const identity = {
      id: "00000000-0000-4000-8000-00000000000a",
      email: "Google.User@Example.Test",
    };
    const google = new AccountService(db, async () => identity);
    const first = await google.google("provider-token");
    const profile = await google.authenticate(first.access_token);
    expect(profile.auth_user_id).toBe(identity.id);
    expect(profile.email).toBe("google.user@example.test");
    // Google accounts start without a role: they join the same onboarding funnel.
    expect(profile.role).toBeNull();
    expect(profile.onboarding_completed).toBe(false);
    const second = await google.google("another-provider-token");
    expect((await google.authenticate(second.access_token)).id).toBe(
      profile.id,
    );
    expect(
      (
        await db.query("SELECT id FROM profiles WHERE auth_user_id=$1", [
          identity.id,
        ])
      ).rows,
    ).toHaveLength(1);
    // No password credential is fabricated for a provider-only account.
    expect(
      (
        await db.query("SELECT 1 FROM credentials WHERE profile_id=$1", [
          profile.id,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("converges a Google account onto the same role and onboarding rules", async () => {
    const google = new AccountService(db, async () => ({
      id: "00000000-0000-4000-8000-00000000000a",
      email: "google.user@example.test",
    }));
    const token = (await google.google("provider-token")).access_token;
    expect(
      (await auth(request(app).get("/api/v1/workers/me"), token)).status,
    ).toBe(403);
    expect(
      (
        await auth(request(app).put("/api/v1/me/role"), token).send({
          role: "company",
        })
      ).status,
    ).toBe(200);
    expect(
      (await auth(request(app).get("/api/v1/companies/me"), token)).status,
    ).toBe(200);
  });
  it("refuses a deactivated account on both entry points", async () => {
    const closed = await service.register("closed@example.test", password);
    await db.query("UPDATE profiles SET active=false WHERE email=$1", [
      "closed@example.test",
    ]);
    await expect(
      service.login("closed@example.test", password),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.authenticate(closed.access_token),
    ).rejects.toMatchObject({ status: 401 });
  });
});
