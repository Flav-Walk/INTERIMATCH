import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { AdminService } from "./service.js";

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
const admin = new AdminService(db);
const app = createApp(
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "1000" }),
  accounts,
  undefined,
  undefined,
  admin,
);
const password = "Admin-test-password-42!";
let adminToken = "";
let adminId = "";
let workerToken = "";
let workerId = "";
let companyToken = "";

const authenticated = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  const registeredAdmin = await accounts.register(
    "admin@example.test",
    password,
  );
  adminToken = registeredAdmin.access_token;
  adminId = (await accounts.authenticate(adminToken)).id;
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1", [adminId]);

  const registeredWorker = await accounts.register(
    "worker.admin-test@example.test",
    password,
  );
  workerToken = registeredWorker.access_token;
  workerId = (await accounts.authenticate(workerToken)).id;
  await db.query(
    "UPDATE profiles SET first_name='Camille',last_name='Martin' WHERE id=$1",
    [workerId],
  );

  const registeredCompany = await accounts.register(
    "company.admin-test@example.test",
    password,
  );
  companyToken = registeredCompany.access_token;
  await db.query("UPDATE profiles SET role='company' WHERE id=$1", [
    (await accounts.authenticate(companyToken)).id,
  ]);
}, 20_000);

afterAll(() => pg.close());

describe("administration des rôles", () => {
  it("refuse une requête non authentifiée", async () => {
    expect((await request(app).get("/api/v1/admin/users")).status).toBe(401);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${workerId}/role`)
          .send({ role: "company" })
      ).status,
    ).toBe(401);
  });

  it.each([
    ["worker", () => workerToken],
    ["company", () => companyToken],
  ])("refuse le rôle %s", async (_role, token) => {
    expect(
      (await authenticated(request(app).get("/api/v1/admin/users"), token()))
        .status,
    ).toBe(403);
    expect(
      (
        await authenticated(
          request(app)
            .patch(`/api/v1/admin/users/${adminId}/role`)
            .send({ role: "worker" }),
          token(),
        )
      ).status,
    ).toBe(403);
  });

  it("permet à un admin de lister les utilisateurs", async () => {
    const response = await authenticated(
      request(app).get("/api/v1/admin/users"),
      adminToken,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: workerId,
          email: "worker.admin-test@example.test",
          first_name: "Camille",
          last_name: "Martin",
          role: "worker",
        }),
      ]),
    );
    expect(response.body[0]).not.toHaveProperty("password_hash");
  });

  it("permet à un admin de modifier un rôle", async () => {
    const response = await authenticated(
      request(app)
        .patch(`/api/v1/admin/users/${workerId}/role`)
        .send({ role: "company" }),
      adminToken,
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: workerId, role: "company" });
    expect((await accounts.reload(workerId)).role).toBe("company");
  });

  it("refuse un rôle invalide", async () => {
    const response = await authenticated(
      request(app)
        .patch(`/api/v1/admin/users/${workerId}/role`)
        .send({ role: "superadmin" }),
      adminToken,
    );
    expect(response.status).toBe(400);
  });

  it("répond 404 pour un utilisateur inexistant", async () => {
    const response = await authenticated(
      request(app)
        .patch("/api/v1/admin/users/00000000-0000-4000-8000-000000000001/role")
        .send({ role: "worker" }),
      adminToken,
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("empêche un administrateur de retirer son propre rôle", async () => {
    const response = await authenticated(
      request(app)
        .patch(`/api/v1/admin/users/${adminId}/role`)
        .send({ role: "worker" }),
      adminToken,
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SELF_ROLE_CHANGE");
    expect((await accounts.reload(adminId)).role).toBe("admin");
  });
});
