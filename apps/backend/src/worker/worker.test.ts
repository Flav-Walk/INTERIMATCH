import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "./service.js";

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
const geocode = vi.fn(async () => ({ latitude: 45.75, longitude: 4.85 }));
const accounts = new AccountService(db);
const workers = new WorkerService(db, geocode);
const app = createApp(readConfig({ NODE_ENV: "test" }), accounts, workers);
const password = "Worker-profile-password-42!";

const auth = (r: request.Test, token: string) =>
  r.set("Authorization", "Bearer " + token);

/** Un créneau futur, pour que la règle de disponibilité soit satisfaite. */
const slot = (dayOffset: number) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(16, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 6 * 3600_000).toISOString(),
  };
};

let jimmy = "";
let jimmyId = "";
let intruder = "";
let skillIds: string[] = [];

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("migrations/" + name, "utf8"));
  jimmy = (await accounts.register("jimmy@example.test", password))
    .access_token;
  jimmyId = (await accounts.authenticate(jimmy)).id;
  intruder = (await accounts.register("intruder@example.test", password))
    .access_token;
  skillIds = (
    await db.query<{ id: string }>(
      "SELECT id FROM skills ORDER BY name LIMIT 3",
    )
  ).rows.map((r) => r.id);
}, 30000);

afterAll(() => pg.close());

describe("profil intérimaire", () => {
  it("refuse tout accès sans authentification", async () => {
    for (const call of [
      request(app).get("/api/v1/workers/me"),
      request(app).patch("/api/v1/workers/me").send({ city: "Lyon" }),
      request(app).get("/api/v1/workers/me/availabilities"),
      request(app).post("/api/v1/workers/me/availabilities").send(slot(1)),
    ])
      expect((await call).status).toBe(401);
  });

  it("part d'un profil vide et annonce tout ce qui manque", async () => {
    const r = await auth(request(app).get("/api/v1/workers/me"), jimmy);
    expect(r.status).toBe(200);
    expect(r.body.onboarding_completed).toBe(false);
    expect(r.body.missing_requirements).toEqual([
      "identity",
      "location",
      "mobility_radius",
      "main_job",
      "skills",
      "availability",
    ]);
  });

  it("refuse une donnée invalide sans rien écrire", async () => {
    for (const body of [
      { postal_code: "690" },
      { mobility_radius_km: 400 },
      { main_job: "astronaute" },
      { years_experience: 120 },
      { has_vehicle: true, has_driving_licence: false },
      { secondary_jobs: ["serveur", "serveur"] },
      { main_job: "serveur", secondary_jobs: ["serveur"] },
      {},
    ])
      expect(
        (await auth(request(app).patch("/api/v1/workers/me"), jimmy).send(body))
          .status,
      ).toBe(400);
    expect(
      (await auth(request(app).get("/api/v1/workers/me"), jimmy)).body.profile
        .city ?? null,
    ).toBeNull();
  });

  it("refuse les champs décidés par le serveur", async () => {
    // Le client ne peut forcer ni son rôle, ni sa complétion, ni ses coordonnées.
    for (const body of [
      { onboarding_completed: true },
      { role: "company" },
      { latitude: 0, longitude: 0 },
      { profile_id: jimmyId },
    ])
      expect(
        (await auth(request(app).patch("/api/v1/workers/me"), jimmy).send(body))
          .status,
      ).toBe(400);
  });

  it("enregistre une section à la fois, sans exiger le profil entier", async () => {
    const identity = await auth(
      request(app).patch("/api/v1/workers/me"),
      jimmy,
    ).send({ first_name: "Jimmy", last_name: "Martin" });
    expect(identity.status).toBe(200);
    expect(identity.body.first_name).toBe("Jimmy");
    expect(identity.body.onboarding_completed).toBe(false);
    expect(identity.body.missing_requirements).not.toContain("identity");

    const job = await auth(
      request(app).patch("/api/v1/workers/me"),
      jimmy,
    ).send({
      main_job: "serveur",
      secondary_jobs: ["chef_de_rang", "barman"],
      years_experience: 3,
      phone: "+33600000000",
    });
    expect(job.status).toBe(200);
    expect(job.body.profile.main_job).toBe("serveur");
    expect(job.body.profile.secondary_jobs).toEqual(["chef_de_rang", "barman"]);
    // L'identité enregistrée à l'étape précédente n'a pas été perdue.
    expect(job.body.last_name).toBe("Martin");
  });

  it("dérive les coordonnées de la ville, sans les demander à l'utilisateur", async () => {
    geocode.mockClear();
    const r = await auth(request(app).patch("/api/v1/workers/me"), jimmy).send({
      city: "Lyon",
      postal_code: "69002",
      mobility_radius_km: 15,
      has_driving_licence: true,
      has_vehicle: true,
    });
    expect(r.status).toBe(200);
    expect(geocode).toHaveBeenCalledWith("Lyon", "69002");
    expect(r.body.profile.latitude).toBe(45.75);
    expect(r.body.profile.longitude).toBe(4.85);
    expect(r.body.profile.geocoded_at).toBeTruthy();
  });

  it("ne regéocode pas une localisation inchangée", async () => {
    geocode.mockClear();
    await auth(request(app).patch("/api/v1/workers/me"), jimmy).send({
      years_experience: 4,
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it("enregistre le profil même si le géocodage est indisponible", async () => {
    geocode.mockResolvedValueOnce(null as never);
    const r = await auth(request(app).patch("/api/v1/workers/me"), jimmy).send({
      city: "Villeurbanne",
      postal_code: "69100",
    });
    expect(r.status).toBe(200);
    expect(r.body.profile.city).toBe("Villeurbanne");
    // Pas de fausses coordonnées : celles de Lyon ne désignent plus la bonne ville.
    expect(r.body.profile.latitude).toBeNull();
    expect(r.body.profile.geocoded_at).toBeNull();
    // Et la panne ne bloque pas la complétion : ce sont des données dérivées.
    expect(r.body.missing_requirements).not.toContain("location");
    // Retour à Lyon, géocodage de nouveau disponible.
    await auth(request(app).patch("/api/v1/workers/me"), jimmy).send({
      city: "Lyon",
      postal_code: "69002",
    });
  });

  it("enregistre les compétences via la table partagée", async () => {
    const r = await auth(
      request(app).put("/api/v1/workers/me/skills"),
      jimmy,
    ).send({ skill_ids: skillIds.slice(0, 2) });
    expect(r.status).toBe(200);
    expect(r.body.profile.skills).toHaveLength(2);
    expect(
      (
        await auth(request(app).put("/api/v1/workers/me/skills"), jimmy).send({
          skill_ids: ["00000000-0000-4000-8000-000000000001"],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth(request(app).put("/api/v1/workers/me/skills"), jimmy).send({
          skill_ids: [skillIds[0], skillIds[0]],
        })
      ).status,
    ).toBe(400);
  });

  it("enregistre plusieurs expériences et plusieurs certifications", async () => {
    const r = await auth(
      request(app).put("/api/v1/workers/me/experiences"),
      jimmy,
    ).send({
      experiences: [
        { job_title: "Serveur", employer: "Brasserie fictive", years: 2 },
        { job_title: "Chef de rang", employer: "Hôtel fictif", years: 1.5 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.profile.experiences).toHaveLength(2);

    const c = await auth(
      request(app).put("/api/v1/workers/me/certifications"),
      jimmy,
    ).send({
      certifications: [
        {
          name: "HACCP",
          issuer: "Organisme fictif",
          obtained_on: "2025-06-01",
        },
        { name: "Permis d'exploitation" },
      ],
    });
    expect(c.status).toBe(200);
    expect(c.body.profile.certifications).toHaveLength(2);
  });

  it("gère les disponibilités en CRUD et complète le profil", async () => {
    const created = await auth(
      request(app).post("/api/v1/workers/me/availabilities"),
      jimmy,
    ).send(slot(2));
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("available");

    // Le dernier élément obligatoire vient d'être fourni.
    const profile = await auth(request(app).get("/api/v1/workers/me"), jimmy);
    expect(profile.body.onboarding_completed).toBe(true);
    expect(profile.body.missing_requirements).toEqual([]);

    expect(
      (
        await auth(
          request(app).post("/api/v1/workers/me/availabilities"),
          jimmy,
        ).send(slot(2))
      ).status,
    ).toBe(409); // chevauchement

    const second = await auth(
      request(app).post("/api/v1/workers/me/availabilities"),
      jimmy,
    ).send(slot(5));
    expect(second.status).toBe(201);
    expect(
      (await auth(request(app).get("/api/v1/workers/me/availabilities"), jimmy))
        .body,
    ).toHaveLength(2);

    const patched = await auth(
      request(app).patch(
        "/api/v1/workers/me/availabilities/" + String(second.body.id),
      ),
      jimmy,
    ).send({ status: "unavailable" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("unavailable");

    expect(
      (
        await auth(
          request(app).delete(
            "/api/v1/workers/me/availabilities/" + String(second.body.id),
          ),
          jimmy,
        )
      ).status,
    ).toBe(204);
  });

  it("repasse le profil à incomplet si une exigence disparaît", async () => {
    const before = await auth(request(app).get("/api/v1/workers/me"), jimmy);
    expect(before.body.onboarding_completed).toBe(true);

    const emptied = await auth(
      request(app).put("/api/v1/workers/me/skills"),
      jimmy,
    ).send({ skill_ids: [] });
    expect(emptied.body.onboarding_completed).toBe(false);
    expect(emptied.body.missing_requirements).toEqual(["skills"]);

    const restored = await auth(
      request(app).put("/api/v1/workers/me/skills"),
      jimmy,
    ).send({ skill_ids: skillIds });
    expect(restored.body.onboarding_completed).toBe(true);
  });

  it("ne laisse personne modifier le profil d'un autre", async () => {
    // L'intrus est authentifié : seule sa session décide de ce qu'il modifie.
    await auth(request(app).patch("/api/v1/workers/me"), intruder).send({
      first_name: "Intrus",
      city: "Marseille",
      postal_code: "13001",
    });
    const victim = await auth(request(app).get("/api/v1/workers/me"), jimmy);
    expect(victim.body.first_name).toBe("Jimmy");
    expect(victim.body.profile.city).toBe("Lyon");

    // Et il ne peut pas toucher un créneau qui ne lui appartient pas.
    const owned = (
      await auth(request(app).get("/api/v1/workers/me/availabilities"), jimmy)
    ).body[0] as { id: string };
    expect(
      (
        await auth(
          request(app).patch("/api/v1/workers/me/availabilities/" + owned.id),
          intruder,
        ).send({ status: "unavailable" })
      ).status,
    ).toBe(404);
    expect(
      (
        await auth(
          request(app).delete("/api/v1/workers/me/availabilities/" + owned.id),
          intruder,
        )
      ).status,
    ).toBe(404);
    expect(
      (await auth(request(app).get("/api/v1/workers/me/availabilities"), jimmy))
        .body,
    ).toHaveLength(1);
  });

  it("conserve les données après reconnexion", async () => {
    await accounts.logout(undefined, jimmy);
    expect(
      (await auth(request(app).get("/api/v1/workers/me"), jimmy)).status,
    ).toBe(401);
    const again = (await accounts.login("jimmy@example.test", password))
      .access_token;
    const r = await auth(request(app).get("/api/v1/workers/me"), again);
    expect(r.status).toBe(200);
    expect(r.body.first_name).toBe("Jimmy");
    expect(r.body.profile.city).toBe("Lyon");
    expect(r.body.profile.main_job).toBe("serveur");
    expect(r.body.profile.skills.length).toBeGreaterThan(0);
    expect(r.body.profile.experiences).toHaveLength(2);
    expect(r.body.onboarding_completed).toBe(true);
    jimmy = again;
  });

  it("interdit l'espace intérimaire à une entreprise", async () => {
    await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
      "boss@example.test",
    ]);
    const boss = (await accounts.register("boss@example.test", password))
      .access_token;
    for (const call of [
      auth(request(app).get("/api/v1/workers/me"), boss),
      auth(request(app).patch("/api/v1/workers/me"), boss).send({
        city: "Lyon",
      }),
      auth(request(app).get("/api/v1/workers/me/availabilities"), boss),
    ])
      expect((await call).status).toBe(403);
  });

  it("garde la route de compatibilité alignée sur le même service", async () => {
    // Ancienne route tout-en-un : mêmes écritures, mêmes règles de complétion,
    // et les latitude/longitude transmises sont ignorées.
    const legacy = (await accounts.register("legacy@example.test", password))
      .access_token;
    const r = await auth(
      request(app).put("/api/v1/onboarding/worker"),
      legacy,
    ).send({
      first_name: "Ancien",
      last_name: "Parcours",
      city: "Lyon",
      postal_code: "69002",
      latitude: 0,
      longitude: 0,
      main_job: "Serveur",
      mobility_radius_km: 10,
      skill_ids: [skillIds[0]],
      experiences: [],
      availabilities: [slot(3)],
    });
    expect(r.status).toBe(200);
    expect(r.body.onboarding_completed).toBe(true);
    // Les coordonnées viennent du géocodeur serveur, pas du corps de la requête.
    expect(r.body.profile.latitude).toBe(45.75);
  });
});
