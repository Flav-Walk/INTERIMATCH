import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "./service.js";
import { missionCreateSchema } from "./schemas.js";

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
const missions = new MissionService(db, geocode);
const app = createApp(
  readConfig({
    NODE_ENV: "test",
    RATE_LIMIT: "1000",
    AUTH_RATE_LIMIT: "1000",
  }),
  accounts,
  workers,
  missions,
);
const password = "Mission-test-password-42!";
const auth = (r: request.Test, token: string) =>
  r.set("Authorization", "Bearer " + token);

const day = (offset: number, hour = 16, hours = 6) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + offset);
  start.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + hours * 3600_000).toISOString(),
  };
};

const draft = (over: Record<string, unknown> = {}) =>
  missionCreateSchema.parse({
    title: "Serveur en restauration",
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...day(4),
    ...over,
  });

let boss = "";
let bossId = "";
let rival = "";
let rivalId = "";
let worker = "";
let skillIds: string[] = [];

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("migrations/" + name, "utf8"));
  for (const email of ["boss@example.test", "rival@example.test"])
    await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
      email,
    ]);
  boss = (await accounts.register("boss@example.test", password)).access_token;
  bossId = (await accounts.authenticate(boss)).id;
  rival = (await accounts.register("rival@example.test", password))
    .access_token;
  rivalId = (await accounts.authenticate(rival)).id;
  worker = (await accounts.register("worker@example.test", password))
    .access_token;
  skillIds = (
    await db.query<{ id: string }>(
      "SELECT id FROM skills ORDER BY name LIMIT 3",
    )
  ).rows.map((r) => r.id);
}, 30000);

afterAll(() => pg.close());

describe("missions — validation du contrat", () => {
  it("refuse une fin antérieure au début", () => {
    const start = day(4);
    expect(
      missionCreateSchema.safeParse({
        title: "x",
        job: "serveur",
        city: "Lyon",
        postal_code: "69002",
        starts_at: start.ends_at,
        ends_at: start.starts_at,
      }).success,
    ).toBe(false);
  });

  it("refuse un métier hors référentiel et un code postal invalide", () => {
    expect(draftFails({ job: "astronaute" })).toBe(true);
    expect(draftFails({ postal_code: "690" })).toBe(true);
  });

  it("refuse une rémunération sans unité, et inversement", () => {
    expect(draftFails({ pay_amount: 13.5 })).toBe(true);
    expect(draftFails({ pay_unit: "hour" })).toBe(true);
    expect(draftFails({ pay_amount: 13.5, pay_unit: "hour" })).toBe(false);
  });

  it("refuse une compétence à la fois obligatoire et souhaitée", () => {
    const id = "c0ffee00-0000-4000-8000-000000000001";
    expect(
      draftFails({ required_skill_ids: [id], desired_skill_ids: [id] }),
    ).toBe(true);
  });

  it("refuse les champs décidés par le serveur", () => {
    for (const field of [
      { company_id: "x" },
      { status: "open" },
      { latitude: 0 },
      { longitude: 0 },
      { published_at: new Date().toISOString() },
      { demo: true },
    ])
      expect(draftFails(field)).toBe(true);
  });

  it("refuse un effectif nul et une expérience hors bornes", () => {
    expect(draftFails({ headcount: 0 })).toBe(true);
    expect(draftFails({ min_years_experience: 99 })).toBe(true);
  });

  function draftFails(over: Record<string, unknown>) {
    return !missionCreateSchema.safeParse({
      title: "Serveur",
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      ...day(4),
      ...over,
    }).success;
  }
});

describe("missions — lecture et propriété", () => {
  it("refuse tout accès sans authentification", async () => {
    for (const call of [
      request(app).get("/api/v1/missions"),
      request(app).get("/api/v1/missions/00000000-0000-4000-8000-000000000001"),
    ])
      expect((await call).status).toBe(401);
  });

  it("interdit l'espace missions à un intérimaire", async () => {
    expect(
      (await auth(request(app).get("/api/v1/missions"), worker)).status,
    ).toBe(403);
  });

  it("part d'une liste vide", async () => {
    const r = await auth(request(app).get("/api/v1/missions"), boss);
    expect(r.status).toBe(200);
    expect(r.body.missions).toEqual([]);
    expect(r.body.counts).toEqual({});
  });

  it("crée une mission en brouillon avec ses compétences", async () => {
    const id = await missions.create(
      bossId,
      draft({
        required_skill_ids: [skillIds[0], skillIds[1]],
        desired_skill_ids: [skillIds[2]],
        pay_amount: 13.5,
        pay_unit: "hour",
        headcount: 2,
      }),
    );
    const r = await auth(request(app).get("/api/v1/missions/" + id), boss);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("draft");
    expect(r.body.published_at).toBeNull();
    expect(r.body.headcount).toBe(2);
    // Les obligatoires viennent d'abord, ce qui rend l'affichage stable.
    expect(r.body.skills).toHaveLength(3);
    expect(
      r.body.skills.filter((s: { required: boolean }) => s.required),
    ).toHaveLength(2);
    expect(r.body.skills[0].required).toBe(true);
  });

  it("dérive les coordonnées de la mission sans les demander", async () => {
    geocode.mockClear();
    const id = await missions.create(
      bossId,
      draft({ city: "Paris", postal_code: "75012" }),
    );
    expect(geocode).toHaveBeenCalledWith("Paris", "75012");
    const r = await auth(request(app).get("/api/v1/missions/" + id), boss);
    expect(r.body.latitude).toBe(45.75);
    expect(r.body.geocoded_at).toBeTruthy();
  });

  it("crée la mission même si le géocodage est indisponible", async () => {
    geocode.mockResolvedValueOnce(null as never);
    const id = await missions.create(bossId, draft({ city: "Introuvable" }));
    const r = await auth(request(app).get("/api/v1/missions/" + id), boss);
    expect(r.status).toBe(200);
    expect(r.body.city).toBe("Introuvable");
    expect(r.body.latitude).toBeNull();
    expect(r.body.geocoded_at).toBeNull();
  });

  it("refuse une compétence inconnue sans rien écrire", async () => {
    const before = (await missions.list(bossId)).length;
    await expect(
      missions.create(
        bossId,
        draft({ required_skill_ids: ["00000000-0000-4000-8000-000000000009"] }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_SKILLS" });
    expect((await missions.list(bossId)).length).toBe(before);
  });

  it("compte les missions par statut pour les filtres", async () => {
    const id = await missions.create(bossId, draft({ title: "À publier" }));
    await db.query(
      "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
      [id],
    );
    const r = await auth(request(app).get("/api/v1/missions"), boss);
    expect(r.body.counts.open).toBe(1);
    expect(r.body.counts.draft).toBeGreaterThan(0);
  });

  it("filtre la liste par statut", async () => {
    const r = await auth(
      request(app).get("/api/v1/missions?status=open"),
      boss,
    );
    expect(r.status).toBe(200);
    expect(r.body.missions).toHaveLength(1);
    expect(r.body.missions[0].status).toBe("open");
    expect(
      (await auth(request(app).get("/api/v1/missions?status=zzz"), boss))
        .status,
    ).toBe(400);
  });

  it("trie les missions de la plus récente à la plus ancienne", async () => {
    const list = (await auth(request(app).get("/api/v1/missions"), boss)).body
      .missions as { starts_at: string }[];
    const dates = list.map((m) => Date.parse(m.starts_at));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it("ne laisse aucune entreprise voir les missions d'une autre", async () => {
    const mine = (await missions.list(bossId))[0];
    // Introuvable, pas « interdit » : l'existence de la mission n'est pas révélée.
    expect(
      (await auth(request(app).get("/api/v1/missions/" + mine.id), rival))
        .status,
    ).toBe(404);
    expect(
      (await auth(request(app).get("/api/v1/missions"), rival)).body.missions,
    ).toEqual([]);
    expect(await missions.list(rivalId)).toEqual([]);
  });

  it("refuse un identifiant de mission mal formé", async () => {
    expect(
      (await auth(request(app).get("/api/v1/missions/pas-un-uuid"), boss))
        .status,
    ).toBe(400);
  });

  it("refuse d'attacher une mission à un profil non entreprise", async () => {
    const workerId = (await accounts.authenticate(worker)).id;
    await expect(missions.assertCompany(workerId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(missions.assertCompany(bossId)).resolves.toBeUndefined();
  });

  it("supprime les compétences avec la mission", async () => {
    const id = await missions.create(
      bossId,
      draft({ required_skill_ids: [skillIds[0]] }),
    );
    await db.query("DELETE FROM missions WHERE id=$1", [id]);
    expect(
      (await db.query("SELECT 1 FROM mission_skills WHERE mission_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  });

  it("expose les unités de rémunération dans le vocabulaire métier", async () => {
    const r = await auth(request(app).get("/api/v1/reference"), boss);
    expect(r.body.pay_units.map((u: { value: string }) => u.value)).toEqual([
      "hour",
      "day",
      "mission",
    ]);
  });
});

// ---------------------------------------------------------------------------
// SL2a — écriture : création, modification, publication.
// ---------------------------------------------------------------------------

/** Corps brut, non validé : c'est ce qu'un client mal intentionné enverrait. */
const body = (over: Record<string, unknown> = {}) => ({
  title: "Serveur en restauration",
  job: "serveur",
  city: "Lyon",
  postal_code: "69002",
  ...day(4),
  ...over,
});

const postMission = (payload: Record<string, unknown>, token = boss) =>
  auth(request(app).post("/api/v1/missions"), token).send(payload);

const patchMission = (
  id: string,
  payload: Record<string, unknown>,
  token = boss,
) => auth(request(app).patch("/api/v1/missions/" + id), token).send(payload);

const publishMission = (id: string, token = boss) =>
  auth(request(app).post(`/api/v1/missions/${id}/publish`), token).send({});

describe("missions — création par l'API", () => {
  it("crée un brouillon et le renvoie entier", async () => {
    const r = await postMission(
      body({ title: "Chef de rang — service du soir" }),
    );
    expect(r.status).toBe(201);
    expect(r.body.id).toBeTruthy();
    expect(r.body.title).toBe("Chef de rang — service du soir");
    // Une mission naît toujours en brouillon : la publication est un geste à part.
    expect(r.body.status).toBe("draft");
    expect(r.body.published_at).toBeNull();
    expect(r.body.company_id).toBe(bossId);
    expect(r.body.headcount).toBe(1);
  });

  it("refuse la création à un intérimaire", async () => {
    expect((await postMission(body(), worker)).status).toBe(403);
  });

  it("refuse la création sans authentification", async () => {
    expect(
      (await request(app).post("/api/v1/missions").send(body())).status,
    ).toBe(401);
  });

  it("refuse tout champ décidé par le serveur", async () => {
    for (const injected of [
      { company_id: rivalId },
      { status: "open" },
      { latitude: 48.85 },
      { longitude: 2.35 },
      { geocoded_at: new Date().toISOString() },
      { published_at: new Date().toISOString() },
      { demo: true },
      { id: "c0ffee00-0000-4000-8000-000000000001" },
    ])
      expect((await postMission(body(injected))).status).toBe(400);
  });

  it("n'attache jamais la mission à l'entreprise nommée par le client", async () => {
    // Même refusé par le schéma, le point important est que `company_id` vienne
    // de la session : le rival ne doit rien voir apparaître chez lui.
    const before = (await missions.list(rivalId)).length;
    await postMission(body({ title: "Tentative d'injection" }));
    expect((await missions.list(rivalId)).length).toBe(before);
  });

  it("enregistre les compétences obligatoires et souhaitées", async () => {
    const r = await postMission(
      body({
        required_skill_ids: [skillIds[0]],
        desired_skill_ids: [skillIds[1]],
      }),
    );
    expect(r.status).toBe(201);
    const required = r.body.skills.filter(
      (s: { required: boolean }) => s.required,
    );
    const desired = r.body.skills.filter(
      (s: { required: boolean }) => !s.required,
    );
    expect(required.map((s: { id: string }) => s.id)).toEqual([skillIds[0]]);
    expect(desired.map((s: { id: string }) => s.id)).toEqual([skillIds[1]]);
  });

  it("refuse une compétence inconnue sans créer la mission", async () => {
    const before = (await missions.list(bossId)).length;
    const r = await postMission(
      body({ required_skill_ids: ["00000000-0000-4000-8000-00000000000a"] }),
    );
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("INVALID_SKILLS");
    expect((await missions.list(bossId)).length).toBe(before);
  });
});

describe("missions — modification", () => {
  const fresh = (over: Record<string, unknown> = {}) =>
    missions.create(bossId, draft(over));

  it("modifie une mission de l'entreprise", async () => {
    const id = await fresh({ title: "Avant" });
    const r = await patchMission(id, { title: "Après", headcount: 4 });
    expect(r.status).toBe(200);
    expect(r.body.title).toBe("Après");
    expect(r.body.headcount).toBe(4);
  });

  it("laisse intacts les champs absents de la requête", async () => {
    const id = await fresh({
      title: "Intitulé",
      description: "Service du soir",
    });
    await patchMission(id, { headcount: 2 });
    const r = await auth(request(app).get("/api/v1/missions/" + id), boss);
    expect(r.body.title).toBe("Intitulé");
    expect(r.body.description).toBe("Service du soir");
  });

  it("traite comme introuvable la mission d'une autre entreprise", async () => {
    const id = await fresh({ title: "Propriété du boss" });
    const r = await patchMission(id, { title: "Détournée" }, rival);
    // 404 et non 403 : on ne révèle pas que la mission existe ailleurs.
    expect(r.status).toBe(404);
    expect((await missions.get(bossId, id)).title).toBe("Propriété du boss");
  });

  it("refuse un champ inconnu ou décidé par le serveur", async () => {
    const id = await fresh();
    for (const injected of [
      { inconnu: 1 },
      { company_id: rivalId },
      { status: "open" },
      { latitude: 48.85 },
      { longitude: 2.35 },
      { geocoded_at: new Date().toISOString() },
      { published_at: new Date().toISOString() },
      { demo: true },
    ])
      expect((await patchMission(id, injected)).status).toBe(400);
    expect((await missions.get(bossId, id)).status).toBe("draft");
  });

  it("refuse une modification vide en le disant", async () => {
    const r = await patchMission(await fresh(), {});
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe("Aucune modification transmise.");
  });

  it("vérifie les règles croisées sur l'état final, pas sur la requête", async () => {
    const id = await fresh(day(10));
    const before = await missions.get(bossId, id);
    // `ends_at` seul, placé avant le `starts_at` déjà enregistré.
    const early = await patchMission(id, {
      ends_at: new Date(
        Date.parse(String(before.starts_at)) - 3600_000,
      ).toISOString(),
    });
    expect(early.status).toBe(400);
    expect(early.body.error.message).toBe("La fin doit suivre le début.");

    // Une unité de rémunération seule, sur une mission sans montant enregistré.
    const orphan = await patchMission(id, { pay_unit: "hour" });
    expect(orphan.status).toBe(400);
    expect(orphan.body.error.message).toBe(
      "Indiquez la rémunération et son unité, ou aucune des deux.",
    );

    // Une compétence déjà souhaitée ne peut pas devenir obligatoire en douce.
    const withDesired = await fresh({ desired_skill_ids: [skillIds[0]] });
    expect(
      (await patchMission(withDesired, { required_skill_ids: [skillIds[0]] }))
        .status,
    ).toBe(400);
  });

  it("accepte un effacement cohérent de la rémunération", async () => {
    const id = await fresh({ pay_amount: 13.5, pay_unit: "hour" });
    const r = await patchMission(id, { pay_amount: null, pay_unit: null });
    expect(r.status).toBe(200);
    expect(r.body.pay_amount).toBeNull();
    expect(r.body.pay_unit).toBeNull();
  });

  it("re-géocode quand la localisation change", async () => {
    const id = await fresh({ city: "Lyon", postal_code: "69002" });
    geocode.mockClear();
    const r = await patchMission(id, { city: "Paris", postal_code: "75012" });
    expect(r.status).toBe(200);
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledWith("Paris", "75012");
    expect(r.body.geocoded_at).toBeTruthy();
  });

  it("ne géocode pas quand la localisation ne change pas", async () => {
    const id = await fresh({ city: "Lyon", postal_code: "69002" });
    geocode.mockClear();
    await patchMission(id, { title: "Nouveau titre" });
    // Une même valeur renvoyée n'est pas un déménagement.
    await patchMission(id, { city: "Lyon", postal_code: "69002" });
    expect(geocode).not.toHaveBeenCalled();
  });

  it("aboutit malgré une panne du géocodeur, sans garder les anciennes coordonnées", async () => {
    const id = await fresh({ city: "Lyon", postal_code: "69002" });
    geocode.mockResolvedValueOnce(null as never);
    const r = await patchMission(id, {
      city: "Introuvable",
      postal_code: "69100",
    });
    expect(r.status).toBe(200);
    expect(r.body.city).toBe("Introuvable");
    // Les anciennes coordonnées désignaient Lyon : les conserver fausserait
    // le rapprochement plus sûrement que de les laisser vides.
    expect(r.body.latitude).toBeNull();
    expect(r.body.geocoded_at).toBeNull();
  });

  it("remplace les compétences", async () => {
    const id = await fresh({ required_skill_ids: [skillIds[0]] });
    const r = await patchMission(id, {
      required_skill_ids: [skillIds[1]],
      desired_skill_ids: [skillIds[2]],
    });
    expect(r.status).toBe(200);
    expect(
      r.body.skills.map((s: { id: string; required: boolean }) => [
        s.id,
        s.required,
      ]),
    ).toEqual([
      [skillIds[1], true],
      [skillIds[2], false],
    ]);
  });

  it("laisse la mission strictement intacte si une compétence est inconnue", async () => {
    const id = await fresh({
      title: "Intact",
      required_skill_ids: [skillIds[0]],
    });
    const r = await patchMission(id, {
      title: "Ne doit pas être écrit",
      required_skill_ids: ["00000000-0000-4000-8000-00000000000b"],
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("INVALID_SKILLS");
    // La colonne était écrite avant la vérification des compétences : c'est
    // la transaction qui garantit qu'aucune des deux n'est conservée.
    const after = await missions.get(bossId, id);
    expect(after.title).toBe("Intact");
    expect(after.skills.map((s) => s.id)).toEqual([skillIds[0]]);
  });
});

describe("missions — publication", () => {
  it("publie un brouillon et pose la date côté serveur", async () => {
    const id = await missions.create(bossId, draft({ title: "À publier" }));
    const sent = new Date(Date.now() - 999 * 86400_000).toISOString();
    // Le corps est ignoré : aucune date de publication ne vient du client.
    const r = await auth(
      request(app).post(`/api/v1/missions/${id}/publish`),
      boss,
    ).send({ published_at: sent, status: "completed" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("open");
    expect(r.body.published_at).not.toBe(sent);
    expect(Date.now() - Date.parse(r.body.published_at)).toBeLessThan(10_000);
  });

  it("refuse une seconde publication", async () => {
    const id = await missions.create(
      bossId,
      draft({ title: "Publiée une fois" }),
    );
    expect((await publishMission(id)).status).toBe(200);
    const again = await publishMission(id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("refuse de publier une mission déjà commencée", async () => {
    const id = await missions.create(bossId, draft(day(-2)));
    const r = await publishMission(id);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("MISSION_ALREADY_STARTED");
    expect((await missions.get(bossId, id)).status).toBe("draft");
  });

  it("traite comme introuvable la mission d'une autre entreprise", async () => {
    const id = await missions.create(bossId, draft({ title: "Pas la vôtre" }));
    expect((await publishMission(id, rival)).status).toBe(404);
    expect((await missions.get(bossId, id)).status).toBe("draft");
  });

  it("refuse la publication à un intérimaire", async () => {
    const id = await missions.create(bossId, draft());
    expect((await publishMission(id, worker)).status).toBe(403);
  });

  it("n'expose aucune transition au-delà de la publication", async () => {
    const id = await missions.create(bossId, draft({ title: "Sans suite" }));
    await publishMission(id);
    // `filled`, `completed` et `cancelled` viendront avec l'attribution : rien
    // ne doit permettre d'y basculer aujourd'hui, ni par PATCH ni par publish.
    expect((await patchMission(id, { status: "filled" })).status).toBe(400);
    expect((await publishMission(id)).status).toBe(409);
    expect((await missions.get(bossId, id)).status).toBe("open");
  });
});
