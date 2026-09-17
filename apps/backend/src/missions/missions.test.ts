import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService, notOpenToWorkers } from "./service.js";
import { MatchingService } from "../matching/service.js";
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
const matching = new MatchingService(db, missions);
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
let workerId = "";
/** Renseigné par la suite « données de démonstration », relu par le SL3a. */
let demoWorkerProfileId = "";
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
  workerId = (await accounts.authenticate(worker)).id;
  skillIds = (
    await db.query<{ id: string }>(
      "SELECT id FROM skills ORDER BY name LIMIT 3",
    )
  ).rows.map((r) => r.id);
  await makeEmployable(workerId);
}, 30000);

/**
 * Donne à un intérimaire de quoi être rapproché : un métier, une position, un
 * rayon large, toutes les compétences et une disponibilité qui couvre le mois.
 *
 * Depuis le SL3a, une mission n'est plus visible parce qu'elle est publiée mais
 * parce qu'elle est compatible. Un compte sans profil n'a donc rien à voir, ce
 * qui est le comportement attendu — les tests de visibilité doivent partir d'un
 * profil réel, comme en production.
 */
async function makeEmployable(profileId: string) {
  await db.query(
    `INSERT INTO worker_profiles(profile_id, city, postal_code, latitude, longitude,
       mobility_radius_km, main_job, open_to_missions)
     VALUES($1,'Lyon','69002',45.75,4.85,250,'serveur',true)
     ON CONFLICT(profile_id) DO UPDATE SET open_to_missions=true`,
    [profileId],
  );
  await db.query(
    `INSERT INTO worker_skills(profile_id, skill_id)
     SELECT $1, id FROM skills ON CONFLICT DO NOTHING`,
    [profileId],
  );
  // Une seule plage très large : les missions des tests se situent toutes à
  // quelques semaines, et la couverture doit être totale pour ne rien bloquer.
  await db.query(
    `INSERT INTO availabilities(profile_id, starts_at, ends_at, status)
     VALUES($1, now() - interval '30 days', now() + interval '120 days', 'available')`,
    [profileId],
  );
}

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

// ---------------------------------------------------------------------------
// SL2c — ce qu'un intérimaire voit des missions.
// ---------------------------------------------------------------------------

describe("missions — espace intérimaire", () => {
  /** Publie une mission pour de bon, par le chemin réel de l'entreprise. */
  const publish = async (over: Record<string, unknown> = {}) => {
    const id = await missions.create(bossId, draft(over));
    await publishMission(id);
    return id;
  };

  const openList = (token = worker) =>
    auth(request(app).get("/api/v1/workers/me/missions"), token);

  const openOne = (id: string, token = worker) =>
    auth(request(app).get("/api/v1/workers/me/missions/" + id), token);

  it("refuse tout accès sans authentification", async () => {
    for (const call of [
      request(app).get("/api/v1/workers/me/missions"),
      request(app).get(
        "/api/v1/workers/me/missions/c0ffee00-0000-4000-8000-000000000001",
      ),
    ])
      expect((await call).status).toBe(401);
  });

  it("ferme l'espace intérimaire à une entreprise", async () => {
    expect((await openList(boss)).status).toBe(403);
  });

  it("montre une mission publiée", async () => {
    const id = await publish({ title: "Renfort service du midi" });
    const r = await openList();
    expect(r.status).toBe(200);
    expect(r.body.missions.map((m: { id: string }) => m.id)).toContain(id);
  });

  it("ne montre jamais un brouillon, ni dans la liste ni par son identifiant", async () => {
    const id = await missions.create(bossId, draft({ title: "Jamais publié" }));
    const r = await openList();
    expect(r.body.missions.map((m: { id: string }) => m.id)).not.toContain(id);
    // Introuvable, et non « interdit » : rien ne révèle que ce brouillon existe.
    const detail = await openOne(id);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe("MISSION_NOT_FOUND");
  });

  it("ne montre que des missions ouvertes et encore à venir", async () => {
    const r = await openList();
    expect(r.body.missions.length).toBeGreaterThan(0);
    for (const mission of r.body.missions) {
      expect(mission.status).toBe("open");
      expect(Date.parse(mission.ends_at)).toBeGreaterThan(Date.now());
    }
  });

  it("écarte une mission publiée dont le créneau est passé", async () => {
    const id = await missions.create(bossId, draft({ title: "Déjà terminée" }));
    // Publiée quand elle était à venir, puis rattrapée par le temps.
    await publishMission(id);
    await db.query(
      "UPDATE missions SET starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' WHERE id=$1",
      [id],
    );
    expect(
      (await openList()).body.missions.map((m: { id: string }) => m.id),
    ).not.toContain(id);
    expect((await openOne(id)).status).toBe(404);
  });

  it("montre les missions de toutes les entreprises, pas d'une seule", async () => {
    const mine = await publish({ title: "Chez le boss" });
    const theirs = await missions.create(
      rivalId,
      draft({ title: "Chez le rival" }),
    );
    await auth(
      request(app).post(`/api/v1/missions/${theirs}/publish`),
      rival,
    ).send({});
    const ids = (await openList()).body.missions.map(
      (m: { id: string }) => m.id,
    );
    expect(ids).toContain(mine);
    expect(ids).toContain(theirs);
  });

  it("renvoie le détail d'une mission offerte, compétences comprises", async () => {
    const id = await publish({
      title: "Chef de rang — banquet",
      description: "Service à l'assiette.",
      headcount: 3,
      min_years_experience: 2,
      pay_amount: 15.5,
      pay_unit: "hour",
      required_skill_ids: [skillIds[0]],
      desired_skill_ids: [skillIds[1]],
    });
    const r = await openOne(id);
    expect(r.status).toBe(200);
    expect(r.body.title).toBe("Chef de rang — banquet");
    expect(r.body.description).toBe("Service à l'assiette.");
    expect(r.body.headcount).toBe(3);
    expect(Number(r.body.min_years_experience)).toBe(2);
    expect(Number(r.body.pay_amount)).toBe(15.5);
    expect(r.body.pay_unit).toBe("hour");
    expect(r.body.city).toBe("Lyon");
    expect(
      r.body.skills.filter((s: { required: boolean }) => s.required),
    ).toHaveLength(1);
    expect(
      r.body.skills.filter((s: { required: boolean }) => !s.required),
    ).toHaveLength(1);
  });

  it("répond introuvable pour une mission inexistante et refuse un identifiant mal formé", async () => {
    expect((await openOne("c0ffee00-0000-4000-8000-000000000009")).status).toBe(
      404,
    );
    expect((await openOne("pas-un-uuid")).status).toBe(400);
  });

  it("joint les informations que l'établissement destine aux intérimaires", async () => {
    await db.query(
      `INSERT INTO company_profiles(profile_id,legal_name,establishment_name,sector,address,city,postal_code,latitude,longitude,phone,description)
       VALUES($1,'Brasserie du Quai SARL','Brasserie du Quai','brasserie','12 quai Rambaud','Lyon','69002',45.75,4.85,'+33400000000','Cuisine de marché, 120 couverts.')
       ON CONFLICT(profile_id) DO UPDATE SET establishment_name=EXCLUDED.establishment_name`,
      [bossId],
    );
    const id = await publish({ title: "Avec établissement" });
    const r = await openOne(id);
    expect(r.body.company).toEqual({
      establishment_name: "Brasserie du Quai",
      sector: "brasserie",
      description: "Cuisine de marché, 120 couverts.",
    });
  });

  it("ne divulgue ni les coordonnées de contact ni l'identifiant de l'entreprise", async () => {
    const id = await publish({ title: "Sans fuite" });
    const r = await openOne(id);
    // Le téléphone, la raison sociale et l'adresse du siège sont des données de
    // contact : rien ne justifie de les donner avant une mise en relation.
    const serialized = JSON.stringify(r.body);
    expect(serialized).not.toContain("+33400000000");
    expect(serialized).not.toContain("Brasserie du Quai SARL");
    expect(r.body.company_id).toBeUndefined();
    expect(Object.keys(r.body.company).sort()).toEqual([
      "description",
      "establishment_name",
      "sector",
    ]);
  });

  it("supporte une entreprise qui n'a pas encore présenté son établissement", async () => {
    const orphan = await missions.create(
      rivalId,
      draft({ title: "Sans vitrine" }),
    );
    await auth(
      request(app).post(`/api/v1/missions/${orphan}/publish`),
      rival,
    ).send({});
    const r = await openOne(orphan);
    expect(r.status).toBe(200);
    expect(r.body.company.establishment_name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cloison entre données de démonstration et données réelles.
// Régression constatée en recette : une mission du seek de démo apparaissait
// à un vrai intérimaire.
// ---------------------------------------------------------------------------

describe("missions — données de démonstration", () => {
  let demoCompanyId = "";
  let demoWorker = "";
  let demoMissionId = "";
  let realMissionId = "";

  beforeAll(async () => {
    // Un compte entreprise et un compte intérimaire marqués « démo », comme
    // ceux que produit `db:seed`.
    demoCompanyId = (
      await db.query<{ id: string }>(
        "INSERT INTO profiles(email,role,demo) VALUES('demo.company@example.test','company',true) RETURNING id",
      )
    ).rows[0].id;
    demoWorkerProfileId = (
      await db.query<{ id: string }>(
        "INSERT INTO profiles(email,role,demo) VALUES('demo.worker@example.test','worker',true) RETURNING id",
      )
    ).rows[0].id;
    demoWorker = (await accounts.issue(db, demoWorkerProfileId)).access_token;
    await makeEmployable(demoWorkerProfileId);

    // Une mission fictive, créée comme le seed la crée.
    demoMissionId = await missions.create(
      demoCompanyId,
      draft({ title: "Mission fictive du seed" }),
      { demo: true },
    );
    await db.query(
      "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
      [demoMissionId],
    );

    // Et une vraie mission publiée, pour vérifier que la cloison joue des deux côtés.
    realMissionId = await missions.create(
      bossId,
      draft({ title: "Mission réelle" }),
    );
    await db.query(
      "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
      [realMissionId],
    );
  });

  const ids = async (token: string) =>
    (
      await auth(request(app).get("/api/v1/workers/me/missions"), token)
    ).body.missions.map((m: { id: string }) => m.id);

  it("n'expose aucune mission fictive à un intérimaire réel", async () => {
    // La mission fictive satisfait toutes les autres conditions de visibilité :
    // publiée, à venir. Seul son marqueur `demo` peut donc l'exclure, et c'est
    // ce que ce test vérifie réellement.
    const fictive = (
      await db.query<{ status: string; ends_at: Date; demo: boolean }>(
        "SELECT status, ends_at, demo FROM missions WHERE id=$1",
        [demoMissionId],
      )
    ).rows[0];
    expect(fictive.status).toBe("open");
    expect(fictive.demo).toBe(true);
    expect(new Date(fictive.ends_at).getTime()).toBeGreaterThan(Date.now());

    const visible = await ids(worker);
    expect(visible).toContain(realMissionId);
    expect(visible).not.toContain(demoMissionId);
  });

  it("garde la mission fictive introuvable par son identifiant direct", async () => {
    const r = await auth(
      request(app).get("/api/v1/workers/me/missions/" + demoMissionId),
      worker,
    );
    expect(r.status).toBe(404);
  });

  it("ne renvoie jamais de mission marquée démo à un compte réel", async () => {
    const r = await auth(
      request(app).get("/api/v1/workers/me/missions"),
      worker,
    );
    for (const mission of r.body.missions) expect(mission.demo).toBe(false);
  });

  it("laisse un compte de démonstration voir les missions de démonstration", async () => {
    // C'est à cela que sert le compte de démo : le priver de ses données le
    // rendrait inutile pour une présentation.
    const visible = await ids(demoWorker);
    expect(visible).toContain(demoMissionId);
    expect(visible).not.toContain(realMissionId);
    expect(
      (
        await auth(
          request(app).get("/api/v1/workers/me/missions/" + demoMissionId),
          demoWorker,
        )
      ).status,
    ).toBe(200);
  });

  it("garde la mission réelle introuvable pour un compte de démonstration", async () => {
    // La cloison joue dans les deux sens, détail compris : un compte fictif ne
    // doit pas davantage atteindre une vraie mission par son identifiant.
    expect(
      (
        await auth(
          request(app).get("/api/v1/workers/me/missions/" + realMissionId),
          demoWorker,
        )
      ).status,
    ).toBe(404);
  });

  it("ne laisse pas le client choisir de quel côté de la cloison il se place", async () => {
    // Le marqueur vient de la session : ni un paramètre de requête ni un corps
    // ne doivent pouvoir le forcer, sur la liste comme sur le détail.
    const forcedList = await auth(
      request(app).get("/api/v1/workers/me/missions?demo=true"),
      worker,
    ).send({ demo: true });
    expect(forcedList.status).toBe(200);
    expect(
      forcedList.body.missions.map((m: { id: string }) => m.id),
    ).not.toContain(demoMissionId);

    const forcedDetail = await auth(
      request(app).get(
        `/api/v1/workers/me/missions/${demoMissionId}?demo=true`,
      ),
      worker,
    ).send({ demo: true });
    expect(forcedDetail.status).toBe(404);
  });

  it("n'assouplit aucune des règles de statut de son côté de la cloison", async () => {
    // La cloison s'ajoute aux règles SL2c, elle ne les remplace pas : un
    // brouillon fictif reste invisible, même d'un compte fictif.
    const fictifNonPublie = await missions.create(
      demoCompanyId,
      draft({ title: "Brouillon fictif" }),
      { demo: true },
    );
    const visible = await ids(demoWorker);
    expect(visible).not.toContain(fictifNonPublie);
    expect(
      (
        await auth(
          request(app).get("/api/v1/workers/me/missions/" + fictifNonPublie),
          demoWorker,
        )
      ).status,
    ).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// SL3a — rapprochement. Les règles de calcul sont couvertes unitairement dans
// `matching/score.test.ts` ; ici on vérifie leur branchement réel : ce que les
// deux espaces reçoivent, et ce qu'ils ne doivent jamais recevoir.
// ---------------------------------------------------------------------------

describe("rapprochement — espace intérimaire", () => {
  const publish = async (over: Record<string, unknown> = {}) => {
    const id = await missions.create(bossId, draft(over));
    await publishMission(id);
    return id;
  };

  const proposed = async (token = worker) =>
    (await auth(request(app).get("/api/v1/workers/me/missions"), token)).body
      .missions;

  const excluded = async (token = worker) =>
    (await auth(request(app).get("/api/v1/workers/me/missions"), token)).body
      .excluded;

  it("ne propose rien à un compte sans profil intérimaire", async () => {
    // Un compte fraîchement créé n'a rien à rapprocher : mieux vaut une liste
    // vide qu'une proposition fondée sur du vide.
    const neuf = (await accounts.register("vierge@example.test", password))
      .access_token;
    const r = await auth(request(app).get("/api/v1/workers/me/missions"), neuf);
    expect(r.status).toBe(200);
    expect(r.body.missions).toEqual([]);
  });

  it("joint un score et son détail à chaque mission proposée", async () => {
    await publish({ title: "Avec score" });
    const list = await proposed();
    expect(list.length).toBeGreaterThan(0);
    for (const m of list) {
      expect(m.match.compatible).toBe(true);
      expect(m.match.score).toBeGreaterThanOrEqual(0);
      expect(m.match.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(m.match.dimensions)).toBe(true);
      expect(m.match.blockers).toEqual([]);
    }
  });

  it("classe les propositions de la plus compatible à la moins compatible", async () => {
    const scores = (await proposed()).map(
      (m: { match: { score: number } }) => m.match.score,
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("écarte une mission dont une compétence obligatoire manque", async () => {
    // Un intérimaire dépourvu de la compétence exigée ne doit pas la voir.
    const demuni = (await accounts.register("demuni@example.test", password))
      .access_token;
    const demuniId = (await accounts.authenticate(demuni)).id;
    await makeEmployable(demuniId);
    await db.query("DELETE FROM worker_skills WHERE profile_id=$1", [demuniId]);

    const exigeante = await publish({
      title: "Exige une compétence",
      required_skill_ids: [skillIds[0]],
    });
    expect(
      (await proposed(demuni)).map((m: { id: string }) => m.id),
    ).not.toContain(exigeante);
    // Le même intérimaire, pourvu de la compétence, la voit.
    expect((await proposed()).map((m: { id: string }) => m.id)).toContain(
      exigeante,
    );
  });

  it("écarte une mission hors du rayon de mobilité", async () => {
    const lointain = (
      await accounts.register("lointain@example.test", password)
    ).access_token;
    const lointainId = (await accounts.authenticate(lointain)).id;
    await makeEmployable(lointainId);
    // Rayon réduit à 5 km : Lyon reste accessible, Paris non.
    await db.query(
      "UPDATE worker_profiles SET mobility_radius_km=5 WHERE profile_id=$1",
      [lointainId],
    );
    const parisienne = await publish({
      title: "Mission parisienne",
      city: "Paris",
      postal_code: "75012",
    });
    await db.query(
      "UPDATE missions SET latitude=48.8566, longitude=2.3522 WHERE id=$1",
      [parisienne],
    );
    expect(
      (await proposed(lointain)).map((m: { id: string }) => m.id),
    ).not.toContain(parisienne);
  });

  it("écarte une mission qu'aucune disponibilité ne couvre", async () => {
    const indispo = (await accounts.register("indispo@example.test", password))
      .access_token;
    const indispoId = (await accounts.authenticate(indispo)).id;
    await makeEmployable(indispoId);
    await db.query("DELETE FROM availabilities WHERE profile_id=$1", [
      indispoId,
    ]);
    const mission = await publish({ title: "Personne n'est libre" });
    expect(
      (await proposed(indispo)).map((m: { id: string }) => m.id),
    ).not.toContain(mission);
  });

  it("écarte les missions d'une recherche mise en pause", async () => {
    const pause = (await accounts.register("pause@example.test", password))
      .access_token;
    const pauseId = (await accounts.authenticate(pause)).id;
    await makeEmployable(pauseId);
    await db.query(
      "UPDATE worker_profiles SET open_to_missions=false WHERE profile_id=$1",
      [pauseId],
    );
    expect(await proposed(pause)).toEqual([]);
  });

  it("laisse le détail accessible et explique l'incompatibilité", async () => {
    // Arriver par un lien sur une mission qui ne convient pas doit apprendre
    // pourquoi, plutôt que de renvoyer une erreur muette.
    const pause = (await accounts.register("pause2@example.test", password))
      .access_token;
    const pauseId = (await accounts.authenticate(pause)).id;
    await makeEmployable(pauseId);
    await db.query(
      "UPDATE worker_profiles SET open_to_missions=false WHERE profile_id=$1",
      [pauseId],
    );
    const mission = await publish({ title: "Détail malgré tout" });
    const r = await auth(
      request(app).get("/api/v1/workers/me/missions/" + mission),
      pause,
    );
    expect(r.status).toBe(200);
    expect(r.body.title).toBe("Détail malgré tout");
    expect(r.body.match.compatible).toBe(false);
    expect(r.body.match.blockers).toContain("paused");
  });

  it("dit combien de missions sont écartées, et pour quel motif", async () => {
    // Le cas vécu en production : un profil complet, compatible en tout point,
    // mais dont aucun créneau ne couvre les missions ouvertes. L'écran vide
    // doit pouvoir nommer ce motif plutôt que d'énumérer quatre hypothèses.
    const sansCreneau = (
      await accounts.register("sanscreneau@example.test", password)
    ).access_token;
    const sansCreneauId = (await accounts.authenticate(sansCreneau)).id;
    await makeEmployable(sansCreneauId);
    await db.query("DELETE FROM availabilities WHERE profile_id=$1", [
      sansCreneauId,
    ]);
    await publish({ title: "Ouverte mais hors créneau" });

    expect(await proposed(sansCreneau)).toEqual([]);
    const motifs = await excluded(sansCreneau);
    expect(motifs.total).toBeGreaterThan(0);
    // Le compte n'a aucun créneau : la disponibilité bloque donc la totalité
    // des missions écartées. D'autres motifs peuvent s'y ajouter — une mission
    // hors rayon posée par un test précédent en cumule deux — ce qui est
    // précisément ce que l'agrégat doit savoir représenter.
    expect(motifs.reasons.unavailable).toBe(motifs.total);
  });

  it("propose la mission dès qu'un créneau la couvre", async () => {
    const tardif = (await accounts.register("tardif@example.test", password))
      .access_token;
    const tardifId = (await accounts.authenticate(tardif)).id;
    await makeEmployable(tardifId);
    await db.query("DELETE FROM availabilities WHERE profile_id=$1", [
      tardifId,
    ]);
    const mission = await publish({ title: "Couverte après coup" });
    expect((await proposed(tardif)).map((m: { id: string }) => m.id)).not.toContain(
      mission,
    );

    // Le créneau est posé autour des dates réelles de la mission : c'est la
    // seule chose qui change entre les deux appels.
    const { starts_at, ends_at } = (
      await db.query<{ starts_at: string; ends_at: string }>(
        "SELECT starts_at, ends_at FROM missions WHERE id=$1",
        [mission],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO availabilities(profile_id, starts_at, ends_at, status)
       VALUES($1, $2::timestamptz - interval '1 hour',
                  $3::timestamptz + interval '1 hour', 'available')`,
      [tardifId, starts_at, ends_at],
    );

    expect((await proposed(tardif)).map((m: { id: string }) => m.id)).toContain(
      mission,
    );
    expect((await excluded(tardif)).reasons.unavailable ?? 0).toBe(0);
  });

  it("ne compte aucune exclusion pour un compte sans profil intérimaire", async () => {
    // Rien n'est évaluable : annoncer un motif serait une affirmation sans
    // fondement. L'écran a déjà de quoi dire quoi faire.
    const neuf = (await accounts.register("vierge2@example.test", password))
      .access_token;
    expect(await excluded(neuf)).toEqual({ total: 0, reasons: {} });
  });

  it("garde un brouillon invisible, rapprochement ou non", async () => {
    const brouillon = await missions.create(
      bossId,
      draft({ title: "Brouillon SL3a" }),
    );
    expect((await proposed()).map((m: { id: string }) => m.id)).not.toContain(
      brouillon,
    );
    expect(
      (
        await auth(
          request(app).get("/api/v1/workers/me/missions/" + brouillon),
          worker,
        )
      ).status,
    ).toBe(404);
  });
});

describe("rapprochement — candidats côté entreprise", () => {
  let missionId = "";

  beforeAll(async () => {
    missionId = await missions.create(
      bossId,
      draft({
        title: "Mission à pourvoir pour candidats",
        required_skill_ids: [skillIds[0]],
        desired_skill_ids: [skillIds[1]],
      }),
    );
    await publishMission(missionId);
  });

  const candidates = (id = missionId, token = boss) =>
    auth(request(app).get(`/api/v1/missions/${id}/candidates`), token);

  it("refuse tout accès sans authentification", async () => {
    expect(
      (await request(app).get(`/api/v1/missions/${missionId}/candidates`))
        .status,
    ).toBe(401);
  });

  it("ferme l'accès à un intérimaire", async () => {
    // Un intérimaire ne doit jamais atteindre les autres intérimaires.
    expect((await candidates(missionId, worker)).status).toBe(403);
  });

  it("traite comme introuvable la mission d'une autre entreprise", async () => {
    expect((await candidates(missionId, rival)).status).toBe(404);
  });

  it("renvoie les candidats rapprochés de sa propre mission", async () => {
    const r = await candidates();
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.candidates)).toBe(true);
    expect(r.body.candidates.length).toBeGreaterThan(0);
    for (const c of r.body.candidates) {
      expect(c.match.compatible).toBe(true);
      expect(c.match.score).toBeGreaterThanOrEqual(50);
    }
  });

  it("annonce le palier retenu", async () => {
    const r = await candidates();
    expect([70, 60, 50]).toContain(r.body.band);
    expect(typeof r.body.band_label).toBe("string");
  });

  it("classe du meilleur au moins bon", async () => {
    const scores = (await candidates()).body.candidates.map(
      (c: { match: { score: number } }) => c.match.score,
    );
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
  });

  it("ne divulgue ni nom complet ni moyen de contact", async () => {
    const r = await candidates();
    const serialized = JSON.stringify(r.body);
    expect(serialized).not.toContain("worker@example.test");
    expect(serialized).not.toContain("@example.test");
    for (const c of r.body.candidates) {
      expect(Object.keys(c).sort()).toEqual([
        "city",
        "first_name",
        "id",
        "last_initial",
        "main_job",
        "match",
        "matched_skills",
        "years_experience",
      ]);
      expect(c.last_initial.length).toBeLessThanOrEqual(1);
    }
  });

  it("n'expose que les compétences de la mission réellement détenues", async () => {
    const r = await candidates();
    const missionSkills = new Set([skillIds[0], skillIds[1]]);
    for (const c of r.body.candidates)
      for (const s of c.matched_skills)
        expect(missionSkills.has(s.id)).toBe(true);
  });

  it("écarte un intérimaire incompatible du rapprochement", async () => {
    const demuni = (await accounts.register("sanscomp@example.test", password))
      .access_token;
    const demuniId = (await accounts.authenticate(demuni)).id;
    await makeEmployable(demuniId);
    await db.query("DELETE FROM worker_skills WHERE profile_id=$1", [demuniId]);
    const r = await candidates();
    expect(r.body.candidates.map((c: { id: string }) => c.id)).not.toContain(
      demuniId,
    );
  });

  it("ne renvoie personne quand aucun profil ne convient", async () => {
    // Une compétence neuve, que personne ne possède : plus sûr que de retirer
    // une compétence existante, qui fausserait les tests suivants.
    const inedite = (
      await db.query<{ id: string }>(
        "INSERT INTO skills(name) VALUES('Sommellerie rare') RETURNING id",
      )
    ).rows[0].id;
    const impossible = await missions.create(
      bossId,
      draft({ title: "Introuvable", required_skill_ids: [inedite] }),
    );
    await publishMission(impossible);
    const r = await candidates(impossible);
    expect(r.status).toBe(200);
    expect(r.body.candidates).toEqual([]);
    expect(r.body.band).toBeNull();
  });

  it("sépare les candidats de démonstration des candidats réels", async () => {
    // La cloison du SL2c vaut aussi pour les profils rapprochés.
    const r = await candidates();
    expect(r.body.candidates.map((c: { id: string }) => c.id)).not.toContain(
      demoWorkerProfileId,
    );
  });

  it("rapproche des profils tant que la mission est offerte", async () => {
    const r = await candidates();
    expect(r.body.inactive).toBeNull();
    expect(r.body.candidates.length).toBeGreaterThan(0);
  });

  it("ne rapproche personne d'un brouillon", async () => {
    // Un brouillon n'est visible d'aucun intérimaire : lui proposer des
    // « profils compatibles » ferait croire à un vivier qui ne peut pas
    // répondre. La mission reste consultable, seul le rapprochement s'arrête.
    const brouillon = await missions.create(
      bossId,
      draft({ title: "Brouillon sans candidats" }),
    );
    const r = await candidates(brouillon);
    expect(r.status).toBe(200);
    expect(r.body.inactive).toBe("draft");
    expect(r.body.candidates).toEqual([]);
    expect(r.body.band).toBeNull();
    // Le détail, lui, reste accessible à l'entreprise propriétaire.
    expect(
      (await auth(request(app).get("/api/v1/missions/" + brouillon), boss))
        .status,
    ).toBe(200);
  });

  it("ne rapproche personne d'une mission terminée", async () => {
    const passee = await missions.create(
      bossId,
      draft({ title: "Déjà terminée" }),
    );
    await publishMission(passee);
    // La publication refuse une mission déjà commencée : on la fait vieillir
    // après coup, comme le temps le ferait en production.
    await db.query(
      `UPDATE missions SET starts_at = now() - interval '2 days',
                           ends_at = now() - interval '1 day' WHERE id = $1`,
      [passee],
    );
    const r = await candidates(passee);
    expect(r.status).toBe(200);
    expect(r.body.inactive).toBe("ended");
    expect(r.body.candidates).toEqual([]);
    // Et surtout : elle n'est pas devenue introuvable pour sa propriétaire.
    expect(
      (await auth(request(app).get("/api/v1/missions/" + passee), boss)).status,
    ).toBe(200);
  });

  it("reste introuvable pour une autre entreprise, même terminée", async () => {
    const passee = await missions.create(bossId, draft({ title: "Passée" }));
    await publishMission(passee);
    await db.query(
      `UPDATE missions SET starts_at = now() - interval '2 days',
                           ends_at = now() - interval '1 day' WHERE id = $1`,
      [passee],
    );
    expect((await candidates(passee, rival)).status).toBe(404);
  });
});

/**
 * L'asymétrie que la recette de production a révélée : les deux espaces
 * doivent parler des mêmes missions et des mêmes profils.
 *
 * L'invariant porte sur la compatibilité métier, pas sur les listes affichées.
 * Les paliers 70 / 60 / 50 écartent volontairement des profils compatibles de
 * la liste entreprise ; l'inclusion n'est donc vérifiée que dans un sens —
 * quiconque figure dans la sélection entreprise doit voir la mission.
 */
describe("rapprochement — symétrie des deux espaces", () => {
  it("accorde le prédicat SQL et son pendant TypeScript", async () => {
    // `openToWorkers` et `notOpenToWorkers` disent la même chose ou le
    // rapprochement se désynchronise à nouveau. Confrontation sur l'ensemble
    // des missions réelles de la base.
    const { rows } = await db.query<{
      id: string;
      status: "draft" | "open" | "filled" | "completed" | "cancelled";
      ends_at: string;
    }>("SELECT id, status, ends_at FROM missions WHERE demo = false");
    const offertes = new Set(
      (await missions.listOpen(false)).map((m) => m.id as string),
    );
    for (const row of rows)
      expect([row.id, notOpenToWorkers(row) === null]).toEqual([
        row.id,
        offertes.has(row.id),
      ]);
  });

  it("montre à chaque profil retenu la mission pour laquelle il est retenu", async () => {
    const mission = await missions.create(
      bossId,
      draft({
        title: "Symétrie des deux espaces",
        required_skill_ids: [skillIds[0]],
        desired_skill_ids: [skillIds[1]],
      }),
    );
    await publishMission(mission);

    const selection = await matching.candidatesForMission(
      bossId,
      mission,
      false,
    );
    expect(selection.inactive).toBeNull();
    expect(selection.candidates.length).toBeGreaterThan(0);

    for (const candidate of selection.candidates) {
      const { matches } = await matching.missionsForWorker(candidate.id, false);
      expect([candidate.id, matches.map((m) => m.mission.id)]).toEqual([
        candidate.id,
        expect.arrayContaining([mission]),
      ]);
    }
  });

  it("n'oublie aucun profil compatible au passage des paliers", async () => {
    // L'écart entre « compatible » et « affiché » doit rester le seul fait des
    // paliers : tout profil absent de la sélection l'est parce qu'il est
    // incompatible, ou parce que son score n'atteint pas le palier retenu.
    const mission = await missions.create(
      bossId,
      draft({ title: "Paliers et rien d'autre" }),
    );
    await publishMission(mission);
    const selection = await matching.candidatesForMission(
      bossId,
      mission,
      false,
    );
    const retenus = new Set(selection.candidates.map((c) => c.id));

    const { rows } = await db.query<{ id: string }>(
      `SELECT p.id FROM profiles p JOIN worker_profiles w ON w.profile_id = p.id
        WHERE p.role = 'worker' AND p.active = true AND p.demo = false`,
    );
    for (const { id } of rows) {
      const { matches } = await matching.missionsForWorker(id, false);
      const entry = matches.find((m) => m.mission.id === mission);
      if (!entry || retenus.has(id)) continue;
      expect([id, entry.match.score < (selection.band ?? 50)]).toEqual([
        id,
        true,
      ]);
    }
  });
});
