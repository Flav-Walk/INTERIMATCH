import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { createBusinessEvent } from "../events/business-event.js";
import { memoryMediaService, uploadedMedia } from "../media/testing.js";

// Stockage en memoire : la photo est desormais exigee a la publication.
const missionMedia = memoryMediaService();

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
const missions = new MissionService(db, undefined, undefined, missionMedia);
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
const draft = (title: string, over: Record<string, unknown> = {}) =>
  missionCreateSchema.parse({
    title,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...futureSlot(),
    media: uploadedMedia(ownerId),
    ...over,
  });

let ownerToken = "";
let ownerId = "";
let otherCompanyToken = "";
let workerToken = "";
let workerId = "";
let secondWorkerToken = "";
let adminToken = "";

async function publishedMission(
  title: string,
  over: Record<string, unknown> = {},
) {
  const id = await missions.create(ownerId, draft(title, over));
  await missions.publish(ownerId, id);
  return id;
}

/** Un creneau date, exprime en jours et en heures depuis maintenant. */
const slotAt = (dayOffset: number, hour: number, hours: number) => {
  const starts = new Date();
  starts.setUTCDate(starts.getUTCDate() + dayOffset);
  starts.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + hours * 3_600_000).toISOString(),
  };
};

/** Un compte interimaire neuf, pret a postuler. */
/**
 * Un interimaire que le rapprochement peut reellement retenir : metier,
 * position, rayon large, toutes les competences et une disponibilite couvrante.
 * `newWorker` suffit pour postuler ; il ne suffit pas pour etre propose.
 */
async function matchableWorker(email: string) {
  const { token, id } = await newWorker(email);
  await db.query(
    `UPDATE worker_profiles
        SET latitude=45.75, longitude=4.85, mobility_radius_km=250,
            open_to_missions=true
      WHERE profile_id=$1`,
    [id],
  );
  await db.query(
    `INSERT INTO worker_skills(profile_id, skill_id)
     SELECT $1, id FROM skills ON CONFLICT DO NOTHING`,
    [id],
  );
  await db.query(
    `INSERT INTO availabilities(profile_id, starts_at, ends_at, status)
     VALUES($1, now() - interval '1 day', now() + interval '400 days', 'available')`,
    [id],
  );
  return { token, id };
}

async function newWorker(email: string) {
  const token = (await accounts.register(email, password)).access_token;
  const id = (await accounts.authenticate(token)).id;
  await db.query(
    `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
     VALUES($1,'Lyon','69002','serveur') ON CONFLICT DO NOTHING`,
    [id],
  );
  return { token, id };
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

  it("conserve un refus dans l historique sans restaurer la mission ni toucher aux disponibilites", async () => {
    const missionId = await publishedMission("Candidature non retenue", {
      ...slotAt(35, 8, 4),
    });
    const worker = await newWorker("history.rejected@example.test");
    await db.query(
      `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
       VALUES($1,now(),now()+interval '120 days','available')`,
      [worker.id],
    );
    const applicationId = await applyTo(missionId, worker.token);

    expect((await decideAs(missionId, applicationId, "rejected")).status).toBe(
      200,
    );
    const history = await authenticated(
      request(app).get("/api/v1/workers/me/applications"),
      worker.token,
    );
    expect(history.body.applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mission_id: missionId, status: "rejected" }),
      ]),
    );
    const proposals = await authenticated(
      request(app).get("/api/v1/workers/me/missions"),
      worker.token,
    );
    expect(
      proposals.body.missions.map((mission: { id: string }) => mission.id),
    ).not.toContain(missionId);
    const duplicate = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: missionId }),
      worker.token,
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("APPLICATION_ALREADY_EXISTS");
    const slots = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM availabilities WHERE profile_id=$1",
      [worker.id],
    );
    expect(Number(slots.rows[0].n)).toBe(1);

    // Une mission terminée quitte les offres mais son dossier reste consultable
    // par la personne qui avait postulé.
    await db.query(
      `UPDATE missions SET starts_at=now()-interval '2 days',
                           ends_at=now()-interval '1 day' WHERE id=$1`,
      [missionId],
    );
    expect(
      (
        await authenticated(
          request(app).get(`/api/v1/workers/me/missions/${missionId}`),
          worker.token,
        )
      ).status,
    ).toBe(200);
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

const decideAs = (
  missionId: string,
  applicationId: string,
  status: "accepted" | "rejected",
) =>
  authenticated(
    request(app).patch(
      `/api/v1/missions/${missionId}/applications/${applicationId}`,
    ),
    ownerToken,
  ).send({ status });

const applyTo = async (missionId: string, token: string) =>
  (
    await authenticated(
      request(app).post("/api/v1/workers/me/applications"),
      token,
    ).send({ mission_id: missionId })
  ).body.id as string;

/**
 * Capacite d'une mission.
 *
 * `headcount` etait jusqu'ici une donnee d'affichage : stockee, montree, jamais
 * opposee a personne. Une mission a un poste pouvait recruter dix personnes.
 */
describe("candidatures - capacite de la mission", () => {
  it("retire une mission pleine des offres et refuse toute nouvelle candidature", async () => {
    const mission = await publishedMission("Mission complète", {
      headcount: 1,
      ...slotAt(39, 8, 4),
    });
    const retained = await newWorker("full.retained@example.test");
    const late = await newWorker("full.late@example.test");
    const application = await applyTo(mission, retained.token);

    expect((await decideAs(mission, application, "accepted")).status).toBe(200);
    expect(
      (await missions.listOpen(false)).map((item) => item.id),
    ).not.toContain(mission);
    await expect(missions.getOpen(mission, false)).rejects.toMatchObject({
      code: "MISSION_NOT_FOUND",
    });

    const direct = await authenticated(
      request(app)
        .post("/api/v1/workers/me/applications")
        .send({ mission_id: mission }),
      late.token,
    );
    expect(direct.status).toBe(409);
    expect(direct.body.error.code).toBe("MISSION_FULL");
    expect(
      (
        await authenticated(
          request(app).get(`/api/v1/workers/me/missions/${mission}`),
          retained.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await authenticated(
          request(app).get(`/api/v1/workers/me/missions/${mission}`),
          late.token,
        )
      ).status,
    ).toBe(404);

    const candidates = await authenticated(
      request(app).get(`/api/v1/missions/${mission}/candidates`),
      ownerToken,
    );
    // « full » et non « closed » : la mission reste publiee et active, elle a
    // seulement trouve tout son monde. Voir le test dedie plus bas.
    expect(candidates.body).toMatchObject({
      inactive: "full",
      candidates: [],
    });
  });

  it("refuse une acceptation au-dela du nombre de postes", async () => {
    const mission = await publishedMission("Un seul poste", {
      headcount: 1,
      ...slotAt(40, 8, 4),
    });
    const premier = await newWorker("cap.premier@example.test");
    const second = await newWorker("cap.second@example.test");
    const a = await applyTo(mission, premier.token);
    const b = await applyTo(mission, second.token);

    expect((await decideAs(mission, a, "accepted")).status).toBe(200);
    const refus = await decideAs(mission, b, "accepted");
    expect(refus.status).toBe(409);
    expect(refus.body.error.code).toBe("MISSION_FULL");
    // La candidature refusee par la capacite reste en attente : l'entreprise
    // n'a rien decide a son sujet, le systeme a seulement refuse le geste.
    expect((await decideAs(mission, b, "rejected")).status).toBe(200);
  });

  it("compte les postes reellement pris, pas les candidatures recues", async () => {
    const mission = await publishedMission("Deux postes", {
      headcount: 2,
      ...slotAt(41, 8, 4),
    });
    const equipe = [];
    for (const suffix of ["a", "b", "c", "d"])
      equipe.push(await newWorker(`cap.${suffix}@example.test`));
    const ids = [];
    for (const one of equipe) ids.push(await applyTo(mission, one.token));

    // Un refus ne consomme aucun poste.
    expect((await decideAs(mission, ids[0], "rejected")).status).toBe(200);
    expect((await decideAs(mission, ids[1], "accepted")).status).toBe(200);
    expect((await decideAs(mission, ids[2], "accepted")).status).toBe(200);
    expect((await decideAs(mission, ids[3], "accepted")).status).toBe(409);
  });

  it("ne laisse pas deux acceptations simultanees depasser la capacite", async () => {
    // Le coeur du probleme : deux responsables qui cliquent en meme temps.
    const mission = await publishedMission("Course a l acceptation", {
      headcount: 1,
      ...slotAt(42, 8, 4),
    });
    const equipe = [];
    for (const suffix of ["a", "b", "c"])
      equipe.push(await newWorker(`race.${suffix}@example.test`));
    const ids = [];
    for (const one of equipe) ids.push(await applyTo(mission, one.token));

    const results = await Promise.all(
      ids.map((id) => decideAs(mission, id, "accepted")),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);

    const { rows } = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM applications WHERE mission_id=$1 AND status='accepted'",
      [mission],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it("garantit la capacite en base, meme sans passer par le service", async () => {
    // La regle ne doit pas reposer sur la seule discipline du code appelant :
    // une ecriture directe doit echouer elle aussi.
    const mission = await publishedMission("Garantie SQL", {
      headcount: 1,
      ...slotAt(43, 8, 4),
    });
    const premier = await newWorker("sql.premier@example.test");
    const second = await newWorker("sql.second@example.test");
    const a = await applyTo(mission, premier.token);
    const b = await applyTo(mission, second.token);
    expect((await decideAs(mission, a, "accepted")).status).toBe(200);

    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [b]),
    ).rejects.toThrow();
  });
});

/**
 * Conflits d'engagement.
 *
 * Une candidature acceptee devient un engagement. Les autres candidatures ne
 * sont ni supprimees ni refusees d'office - l'entreprise n'a rien decide - mais
 * leur acceptation devient impossible, et la raison doit etre lisible.
 */
describe("candidatures - conflits d engagement", () => {
  const listFor = async (missionId: string) =>
    (
      await authenticated(
        request(app).get(`/api/v1/missions/${missionId}/applications`),
        ownerToken,
      )
    ).body.applications as { id: string; status: string; conflict: boolean }[];

  it("laisse coexister deux candidatures qui se chevauchent", async () => {
    // Postuler a deux missions concurrentes est un arbitrage de l'interimaire :
    // rien ne doit l'en empecher tant que rien n'est decide.
    const a = await publishedMission("Chevauche A", slotAt(50, 8, 6));
    const b = await publishedMission("Chevauche B", slotAt(50, 10, 6));
    const worker = await newWorker("conflit.double@example.test");
    expect(await applyTo(a, worker.token)).toBeTruthy();
    expect(await applyTo(b, worker.token)).toBeTruthy();
  });

  it("interdit d accepter une mission chevauchant un engagement", async () => {
    const a = await publishedMission("Engagement pris", slotAt(51, 8, 6));
    const b = await publishedMission("Chevauche", slotAt(51, 10, 6));
    const worker = await newWorker("conflit.pris@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);

    expect((await decideAs(a, ia, "accepted")).status).toBe(200);
    const refus = await decideAs(b, ib, "accepted");
    expect(refus.status).toBe(409);
    expect(refus.body.error.code).toBe("WORKER_ENGAGED");
  });

  it("autorise deux missions strictement adjacentes", async () => {
    // Service du midi puis service du soir : aucune minute partagee.
    const midi = await publishedMission("Service du midi", slotAt(52, 10, 6));
    const soir = await publishedMission("Service du soir", slotAt(52, 16, 6));
    const worker = await newWorker("conflit.adjacent@example.test");
    const im = await applyTo(midi, worker.token);
    const is = await applyTo(soir, worker.token);

    expect((await decideAs(midi, im, "accepted")).status).toBe(200);
    expect((await decideAs(soir, is, "accepted")).status).toBe(200);
  });

  it("signale la candidature devenue incompatible sans la modifier", async () => {
    const a = await publishedMission("Retenue", slotAt(53, 8, 6));
    const b = await publishedMission("Devenue incompatible", slotAt(53, 10, 6));
    const worker = await newWorker("conflit.visible@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);

    expect((await listFor(b)).find((x) => x.id === ib)?.conflict).toBe(false);
    await decideAs(a, ia, "accepted");

    const marquee = (await listFor(b)).find((x) => x.id === ib);
    // Toujours en attente : rien n'a ete decide a sa place.
    expect(marquee).toMatchObject({ status: "pending", conflict: true });
  });

  it("laisse refuser une candidature devenue incompatible", async () => {
    const a = await publishedMission("Retenue bis", slotAt(54, 8, 6));
    const b = await publishedMission("Incompatible bis", slotAt(54, 10, 6));
    const worker = await newWorker("conflit.refus@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    await decideAs(a, ia, "accepted");
    // Le conflit bloque l'acceptation, jamais le refus : l'entreprise doit
    // pouvoir clore le dossier.
    expect((await decideAs(b, ib, "rejected")).status).toBe(200);
  });

  it("ignore une mission annulee dans le calcul des conflits", async () => {
    const a = await publishedMission("Annulee ensuite", slotAt(55, 8, 6));
    const b = await publishedMission("Liberee", slotAt(55, 10, 6));
    const worker = await newWorker("conflit.annule@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    await decideAs(a, ia, "accepted");
    await db.query("UPDATE missions SET status='cancelled' WHERE id=$1", [a]);

    expect((await decideAs(b, ib, "accepted")).status).toBe(200);
  });
});

/**
 * Vue entreprise, toutes missions confondues.
 *
 * Sans elle, une entreprise devait ouvrir chaque mission pour savoir si
 * quelqu'un avait postule. C'etait la cause structurelle du « je dois chercher
 * manuellement » : aucun endpoint ne repondait a la question « ai-je des
 * candidatures ? ».
 */
describe("candidatures - vue d ensemble entreprise", () => {
  const overview = (token = ownerToken) =>
    authenticated(request(app).get("/api/v1/company/me/applications"), token);

  it("refuse un interimaire et un anonyme", async () => {
    expect(
      (await request(app).get("/api/v1/company/me/applications")).status,
    ).toBe(401);
    expect((await overview(workerToken)).status).toBe(403);
  });

  it("rassemble les candidatures de toutes les missions de l entreprise", async () => {
    const a = await publishedMission("Vue A", slotAt(60, 8, 4));
    const b = await publishedMission("Vue B", slotAt(61, 8, 4));
    const un = await newWorker("vue.un@example.test");
    const deux = await newWorker("vue.deux@example.test");
    await applyTo(a, un.token);
    await applyTo(b, deux.token);

    const r = await overview();
    expect(r.status).toBe(200);
    const missionIds = r.body.applications.map(
      (x: { mission_id: string }) => x.mission_id,
    );
    expect(missionIds).toContain(a);
    expect(missionIds).toContain(b);
  });

  it("porte le titre et les dates de la mission concernee", async () => {
    const mission = await publishedMission("Vue titree", slotAt(62, 8, 4));
    const worker = await newWorker("vue.titre@example.test");
    await applyTo(mission, worker.token);

    const found = (await overview()).body.applications.find(
      (x: { mission_id: string }) => x.mission_id === mission,
    );
    expect(found.mission).toMatchObject({ title: "Vue titree" });
    expect(found.mission.starts_at).toBeTruthy();
    expect(found.worker.first_name).toBeDefined();
  });

  it("compte les candidatures par statut", async () => {
    const r = await overview();
    const { counts, applications } = r.body;
    const attendu = applications.filter(
      (x: { status: string }) => x.status === "pending",
    ).length;
    expect(counts.pending).toBe(attendu);
    expect(counts.total).toBe(applications.length);
  });

  it("n expose jamais les candidatures d une autre entreprise", async () => {
    const mine = (await overview()).body.applications.map(
      (x: { id: string }) => x.id,
    );
    const theirs = (await overview(otherCompanyToken)).body.applications.map(
      (x: { id: string }) => x.id,
    );
    expect(theirs.filter((id: string) => mine.includes(id))).toEqual([]);
  });

  it("signale le conflit d engagement dans cette vue aussi", async () => {
    const a = await publishedMission("Vue conflit A", slotAt(63, 8, 6));
    const b = await publishedMission("Vue conflit B", slotAt(63, 10, 6));
    const worker = await newWorker("vue.conflit@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    await decideAs(a, ia, "accepted");

    const found = (await overview()).body.applications.find(
      (x: { id: string }) => x.id === ib,
    );
    expect(found).toMatchObject({ status: "pending", conflict: true });
  });
});

/**
 * Capacite exposee.
 *
 * `headcount` circulait deja dans les reponses, mais rien ne disait combien de
 * postes etaient pris. Le frontend ne pouvait afficher « 2 postes sur 3 » qu en
 * recomptant lui-meme les candidatures — donc en supposant qu il les a toutes.
 */
describe("candidatures - capacite exposee", () => {
  const missionOf = async (missionId: string) =>
    (
      await authenticated(
        request(app).get(`/api/v1/missions/${missionId}`),
        ownerToken,
      )
    ).body;

  const applicationsOf = async (missionId: string) =>
    (
      await authenticated(
        request(app).get(`/api/v1/missions/${missionId}/applications`),
        ownerToken,
      )
    ).body;

  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  const decide = (
    missionId: string,
    applicationId: string,
    status: "accepted" | "rejected",
  ) =>
    authenticated(
      request(app).patch(
        `/api/v1/missions/${missionId}/applications/${applicationId}`,
      ),
      ownerToken,
    ).send({ status });

  it("annonce une mission neuve entierement a pourvoir", async () => {
    const mission = await publishedMission("Capacite neuve", {
      headcount: 3,
      ...slotAt(100, 8, 4),
    });
    expect((await missionOf(mission)).capacity).toEqual({
      headcount: 3,
      filled: 0,
      remaining: 3,
      full: false,
    });
  });

  it("ne compte que les candidatures acceptees", async () => {
    const mission = await publishedMission("Capacite en cours", {
      headcount: 3,
      ...slotAt(101, 8, 4),
    });
    const a = await newWorker("cap.expose.a@example.test");
    const b = await newWorker("cap.expose.b@example.test");
    const c = await newWorker("cap.expose.c@example.test");
    const ia = await applyTo(mission, a.token);
    const ib = await applyTo(mission, b.token);
    await applyTo(mission, c.token);

    // Trois candidatures recues, aucune decision : rien n est pourvu.
    expect((await missionOf(mission)).capacity.filled).toBe(0);

    await decide(mission, ia, "accepted");
    await decide(mission, ib, "rejected");

    const capacity = (await missionOf(mission)).capacity;
    // Un refus ne consomme aucun poste, une acceptation en consomme un.
    expect(capacity).toEqual({
      headcount: 3,
      filled: 1,
      remaining: 2,
      full: false,
    });
  });

  it("declare la mission complete au dernier poste pourvu", async () => {
    const mission = await publishedMission("Capacite pleine", {
      headcount: 1,
      ...slotAt(102, 8, 4),
    });
    const seul = await newWorker("cap.expose.seul@example.test");
    const application = await applyTo(mission, seul.token);
    await decide(mission, application, "accepted");

    expect((await missionOf(mission)).capacity).toEqual({
      headcount: 1,
      filled: 1,
      remaining: 0,
      full: true,
    });
  });

  it("ne descend jamais sous zero poste restant", async () => {
    // Defense contre un etat herite : si la base portait deja plus
    // d acceptations que de postes, « -1 poste restant » n aiderait personne.
    const mission = await publishedMission("Capacite negative", {
      headcount: 1,
      ...slotAt(103, 8, 4),
    });
    const un = await newWorker("cap.neg.un@example.test");
    const deux = await newWorker("cap.neg.deux@example.test");
    const ia = await applyTo(mission, un.token);
    const ib = await applyTo(mission, deux.token);
    await decide(mission, ia, "accepted");
    // Le declencheur SQL protege la capacite : on desactive la contrainte le
    // temps de fabriquer l etat incoherent que l on veut savoir afficher.
    await db.query(
      "ALTER TABLE applications DISABLE TRIGGER applications_capacity",
    );
    await db.query("UPDATE applications SET status='accepted' WHERE id=$1", [
      ib,
    ]);
    await db.query(
      "ALTER TABLE applications ENABLE TRIGGER applications_capacity",
    );

    const capacity = (await missionOf(mission)).capacity;
    expect(capacity.filled).toBe(2);
    expect(capacity.remaining).toBe(0);
    expect(capacity.full).toBe(true);
  });

  it("porte la capacite sur l ecran de decision", async () => {
    const mission = await publishedMission("Capacite decision", {
      headcount: 2,
      ...slotAt(104, 8, 4),
    });
    const un = await newWorker("cap.dec.un@example.test");
    const application = await applyTo(mission, un.token);
    await decide(mission, application, "accepted");

    const body = await applicationsOf(mission);
    expect(Array.isArray(body.applications)).toBe(true);
    expect(body.capacity).toEqual({
      headcount: 2,
      filled: 1,
      remaining: 1,
      full: false,
    });
  });

  it("porte la capacite sur chaque mission de la liste entreprise", async () => {
    const r = await authenticated(
      request(app).get("/api/v1/missions"),
      ownerToken,
    );
    expect(r.status).toBe(200);
    for (const mission of r.body.missions) {
      expect(mission.capacity.headcount).toBe(mission.headcount);
      expect(mission.capacity.remaining).toBeGreaterThanOrEqual(0);
      expect(mission.capacity.full).toBe(mission.capacity.remaining === 0);
    }
  });

  it("n expose la capacite d une mission qu a son proprietaire", async () => {
    const mission = await publishedMission("Capacite privee", {
      ...slotAt(105, 8, 4),
    });
    expect(
      (
        await authenticated(
          request(app).get(`/api/v1/missions/${mission}`),
          otherCompanyToken,
        )
      ).status,
    ).toBe(404);
  });
});

/**
 * Une mission complete reste une mission ouverte.
 *
 * Le cahier demande de distinguer « mission publiee/active » de « capacite
 * atteinte ». Le rapprochement les confondait : une mission dont tous les
 * postes etaient pourvus etait annoncee « closed », ce que l interface traduit
 * par « cette mission n est plus ouverte » — alors qu elle l est toujours.
 */
describe("candidatures - mission complete vs mission fermee", () => {
  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  it("distingue une mission pleine d une mission fermee", async () => {
    const mission = await publishedMission("Pleine mais ouverte", {
      headcount: 1,
      ...slotAt(110, 8, 4),
    });
    const un = await newWorker("pleine.un@example.test");
    const application = await applyTo(mission, un.token);
    await authenticated(
      request(app).patch(
        `/api/v1/missions/${mission}/applications/${application}`,
      ),
      ownerToken,
    ).send({ status: "accepted" });

    const r = await authenticated(
      request(app).get(`/api/v1/missions/${mission}/candidates`),
      ownerToken,
    );
    expect(r.status).toBe(200);
    expect(r.body.inactive).toBe("full");
    expect(r.body.candidates).toEqual([]);

    // Le statut stocke n a pas bouge : la mission reste publiee.
    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM missions WHERE id=$1",
      [mission],
    );
    expect(rows[0].status).toBe("open");
    expect(
      (
        await authenticated(
          request(app).get(`/api/v1/missions/${mission}`),
          ownerToken,
        )
      ).body.status,
    ).toBe("open");
  });
});

/**
 * Le candidat refuse ne revient pas dans les profils correspondants.
 *
 * Sans cette regle, un refus reafficherait aussitot le profil comme
 * « correspondant », l entreprise pourrait le solliciter a nouveau et
 * l interimaire recandidater : une boucle sans etat d arrivee. Le modele
 * retenu est donc l historique — une candidature repondue reste repondue.
 */
describe("candidatures - rapprochement apres decision", () => {
  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  const candidateIds = async (missionId: string) =>
    (
      (
        await authenticated(
          request(app).get(`/api/v1/missions/${missionId}/candidates`),
          ownerToken,
        )
      ).body.candidates as { id: string }[]
    ).map((c) => c.id);

  it("retire le candidat des profils correspondants, refus compris", async () => {
    const mission = await publishedMission("Apres refus", {
      headcount: 2,
      ...slotAt(120, 8, 4),
    });
    const postulant = await matchableWorker("refus.profil@example.test");

    expect(await candidateIds(mission)).toContain(postulant.id);

    const application = await applyTo(mission, postulant.token);
    expect(await candidateIds(mission)).not.toContain(postulant.id);

    await authenticated(
      request(app).patch(
        `/api/v1/missions/${mission}/applications/${application}`,
      ),
      ownerToken,
    ).send({ status: "rejected" });

    // Toujours absent : le refus ne rouvre pas la boucle.
    expect(await candidateIds(mission)).not.toContain(postulant.id);
  });

  it("empeche de recandidater apres un refus", async () => {
    const mission = await publishedMission("Recandidature", {
      headcount: 2,
      ...slotAt(121, 8, 4),
    });
    const postulant = await newWorker("refus.retour@example.test");
    const application = await applyTo(mission, postulant.token);
    await authenticated(
      request(app).patch(
        `/api/v1/missions/${mission}/applications/${application}`,
      ),
      ownerToken,
    ).send({ status: "rejected" });

    const retour = await authenticated(
      request(app).post("/api/v1/workers/me/applications"),
      postulant.token,
    ).send({ mission_id: mission });
    expect(retour.status).toBe(409);
    expect(retour.body.error.code).toBe("APPLICATION_ALREADY_EXISTS");
  });

  it("refuse une seconde decision sur une candidature deja refusee", async () => {
    const mission = await publishedMission("Deja refusee", {
      headcount: 2,
      ...slotAt(122, 8, 4),
    });
    const postulant = await newWorker("refus.double@example.test");
    const application = await applyTo(mission, postulant.token);
    const url = `/api/v1/missions/${mission}/applications/${application}`;
    await authenticated(request(app).patch(url), ownerToken).send({
      status: "rejected",
    });

    for (const status of ["accepted", "rejected"] as const) {
      const again = await authenticated(
        request(app).patch(url),
        ownerToken,
      ).send({ status });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("APPLICATION_ALREADY_DECIDED");
    }
  });
});

/**
 * Silence sur une decision refusee.
 *
 * Les emissions ont lieu apres le COMMIT, jamais pendant : un refus metier doit
 * laisser n8n — et donc les mails — strictement silencieux. La suite des
 * evenements couvre la capacite ; ce cas-ci est le conflit d engagement, qui
 * refuse l acceptation pour une tout autre raison.
 */
describe("candidatures - aucun evenement sur decision refusee", () => {
  const publish = vi.fn(
    (
      type: Parameters<typeof createBusinessEvent>[0],
      data: Record<string, unknown>,
    ) => createBusinessEvent(type, data),
  );
  const watched = new ApplicationService(db, { publish });

  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  it("reste muet quand le candidat est deja engage ailleurs", async () => {
    const premiere = await publishedMission("Silence A", slotAt(130, 8, 6));
    const seconde = await publishedMission("Silence B", slotAt(130, 10, 6));
    const worker = await newWorker("silence.engage@example.test");
    const ia = await applyTo(premiere, worker.token);
    const ib = await applyTo(seconde, worker.token);

    // La premiere acceptation aboutit : elle, doit parler.
    publish.mockClear();
    await watched.decide(ownerId, premiere, ia, "accepted");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toBe("application.accepted");

    // La seconde est refusee : rien ne doit partir.
    publish.mockClear();
    await expect(
      watched.decide(ownerId, seconde, ib, "accepted"),
    ).rejects.toMatchObject({ code: "WORKER_ENGAGED" });
    expect(publish).not.toHaveBeenCalled();

    // Et la candidature reste intacte, en attente.
    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM applications WHERE id=$1",
      [ib],
    );
    expect(rows[0].status).toBe("pending");
  });

  it("reste muet quand la candidature a deja recu une decision", async () => {
    const mission = await publishedMission("Silence C", slotAt(131, 8, 6));
    const worker = await newWorker("silence.double@example.test");
    const application = await applyTo(mission, worker.token);
    await watched.decide(ownerId, mission, application, "rejected");

    publish.mockClear();
    await expect(
      watched.decide(ownerId, mission, application, "accepted"),
    ).rejects.toMatchObject({ code: "APPLICATION_ALREADY_DECIDED" });
    expect(publish).not.toHaveBeenCalled();
  });
});

/**
 * Engagement d un interimaire : la frontiere complete.
 *
 * Une candidature acceptee reserve un creneau. Personne ne peut etre a deux
 * endroits a la fois, et aucune entreprise ne doit pouvoir le lui imposer —
 * meme en acceptant au meme instant qu une autre.
 *
 * Convention de bornes : [debut, fin). Deux missions qui se touchent bout a
 * bout se cumulent — service du midi puis service du soir, quotidien du metier.
 */
describe("engagement - frontiere temporelle complete", () => {
  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  /**
   * Engage l interimaire sur une premiere mission, puis tente de l engager sur
   * une seconde. Renvoie la reponse de la seconde tentative.
   */
  const engageThen = async (
    email: string,
    first: { day: number; hour: number; hours: number },
    second: { day: number; hour: number; hours: number },
  ) => {
    const a = await publishedMission(
      `Engage A ${email}`,
      slotAt(first.day, first.hour, first.hours),
    );
    const b = await publishedMission(
      `Engage B ${email}`,
      slotAt(second.day, second.hour, second.hours),
    );
    const worker = await newWorker(email);
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    expect((await decideAs(a, ia, "accepted")).status).toBe(200);
    return { worker, a, b, ib, second: await decideAs(b, ib, "accepted") };
  };

  it("accepte un interimaire sans aucun engagement", async () => {
    const mission = await publishedMission("Engage libre", slotAt(140, 8, 6));
    const worker = await newWorker("eng.libre@example.test");
    const application = await applyTo(mission, worker.token);
    expect((await decideAs(mission, application, "accepted")).status).toBe(200);
  });

  it("accepte une seconde mission sans chevauchement", async () => {
    const { second } = await engageThen(
      "eng.disjoint@example.test",
      { day: 141, hour: 8, hours: 4 },
      { day: 142, hour: 8, hours: 4 },
    );
    expect(second.status).toBe(200);
  });

  it("accepte une mission qui commence exactement a la fin de l engagement", async () => {
    // [10h, 16h) puis [16h, 22h) : aucune minute reclamee deux fois.
    const { second } = await engageThen(
      "eng.apres@example.test",
      { day: 143, hour: 10, hours: 6 },
      { day: 143, hour: 16, hours: 6 },
    );
    expect(second.status).toBe(200);
  });

  it("accepte une mission qui se termine exactement au debut de l engagement", async () => {
    // Le symetrique : l engagement est pris sur le service du soir, la seconde
    // mission est celle du midi.
    const { second } = await engageThen(
      "eng.avant@example.test",
      { day: 144, hour: 16, hours: 6 },
      { day: 144, hour: 10, hours: 6 },
    );
    expect(second.status).toBe(200);
  });

  it("refuse un chevauchement partiel", async () => {
    const { second } = await engageThen(
      "eng.partiel@example.test",
      { day: 145, hour: 8, hours: 6 },
      { day: 145, hour: 10, hours: 6 },
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("WORKER_ENGAGED");
  });

  it("refuse une mission entierement contenue dans l engagement", async () => {
    const { second } = await engageThen(
      "eng.inclus@example.test",
      { day: 146, hour: 6, hours: 12 },
      { day: 146, hour: 10, hours: 2 },
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("WORKER_ENGAGED");
  });

  it("refuse une mission qui englobe entierement l engagement", async () => {
    const { second } = await engageThen(
      "eng.englobe@example.test",
      { day: 147, hour: 10, hours: 2 },
      { day: 147, hour: 6, hours: 12 },
    );
    expect(second.status).toBe(409);
  });

  it("refuse un intervalle strictement identique", async () => {
    const { second } = await engageThen(
      "eng.identique@example.test",
      { day: 148, hour: 9, hours: 6 },
      { day: 148, hour: 9, hours: 6 },
    );
    expect(second.status).toBe(409);
  });

  it("ne laisse aucune trace apres un refus pour conflit", async () => {
    // La regle exige un etat strictement inchange : ni candidature modifiee,
    // ni poste consomme sur la mission refusee.
    const { b, ib, second } = await engageThen(
      "eng.intact@example.test",
      { day: 149, hour: 8, hours: 6 },
      { day: 149, hour: 10, hours: 6 },
    );
    expect(second.status).toBe(409);

    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM applications WHERE id=$1",
      [ib],
    );
    expect(rows[0].status).toBe("pending");

    const capacity = (
      await authenticated(request(app).get(`/api/v1/missions/${b}`), ownerToken)
    ).body.capacity;
    expect(capacity.filled).toBe(0);
    expect(capacity.full).toBe(false);
  });

  it("ignore une candidature refusee ailleurs", async () => {
    const a = await publishedMission("Conflit refuse A", slotAt(150, 8, 6));
    const b = await publishedMission("Conflit refuse B", slotAt(150, 10, 6));
    const worker = await newWorker("eng.refusee@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    // La premiere est refusee : elle ne reserve rien.
    expect((await decideAs(a, ia, "rejected")).status).toBe(200);
    expect((await decideAs(b, ib, "accepted")).status).toBe(200);
  });

  it("ignore une candidature encore en attente ailleurs", async () => {
    const a = await publishedMission("Conflit pending A", slotAt(151, 8, 6));
    const b = await publishedMission("Conflit pending B", slotAt(151, 10, 6));
    const worker = await newWorker("eng.pending@example.test");
    await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    // Rien n est decide sur A : seule une acceptation reserve un creneau.
    expect((await decideAs(b, ib, "accepted")).status).toBe(200);
  });

  it("n oppose jamais l engagement d une autre personne", async () => {
    const a = await publishedMission("Conflit autrui A", slotAt(152, 8, 6));
    const b = await publishedMission("Conflit autrui B", slotAt(152, 10, 6));
    const un = await newWorker("eng.autrui.un@example.test");
    const deux = await newWorker("eng.autrui.deux@example.test");
    const ia = await applyTo(a, un.token);
    const ib = await applyTo(b, deux.token);
    expect((await decideAs(a, ia, "accepted")).status).toBe(200);
    expect((await decideAs(b, ib, "accepted")).status).toBe(200);
  });

  it("garantit l absence de double engagement en base, hors du service", async () => {
    // Le point decisif. Deux entreprises acceptant simultanement la meme
    // personne sur deux missions differentes verrouillent deux lignes mission
    // differentes : rien ne les sérialise. Seule la base peut trancher.
    const a = await publishedMission("SQL engage A", slotAt(160, 8, 6));
    const b = await publishedMission("SQL engage B", slotAt(160, 10, 6));
    const worker = await newWorker("eng.sql@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    expect((await decideAs(a, ia, "accepted")).status).toBe(200);

    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [ib]),
    ).rejects.toThrow();

    const { rows } = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM applications WHERE id=$1 AND status='accepted'",
      [ib],
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("laisse la base accepter deux creneaux adjacents", async () => {
    // Le declencheur ne doit pas etre plus strict que la regle metier.
    const a = await publishedMission("SQL adjacent A", slotAt(161, 10, 6));
    const b = await publishedMission("SQL adjacent B", slotAt(161, 16, 6));
    const worker = await newWorker("eng.sql.adjacent@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    expect((await decideAs(a, ia, "accepted")).status).toBe(200);
    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [ib]),
    ).resolves.toBeTruthy();
  });

  it("libere le creneau quand la mission engageante est annulee", async () => {
    const a = await publishedMission("SQL annulee A", slotAt(162, 8, 6));
    const b = await publishedMission("SQL annulee B", slotAt(162, 10, 6));
    const worker = await newWorker("eng.sql.annule@example.test");
    const ia = await applyTo(a, worker.token);
    const ib = await applyTo(b, worker.token);
    await decideAs(a, ia, "accepted");
    await db.query("UPDATE missions SET status='cancelled' WHERE id=$1", [a]);
    expect((await decideAs(b, ib, "accepted")).status).toBe(200);
  });
});

/**
 * SL2d — ce que chaque côté comprend une fois les postes pourvus.
 *
 * LA REGLE RETENUE, ET POURQUOI. Quand la derniere place part, les
 * candidatures restantes ne sont PAS refusees d office. Les refuser
 * attribuerait a l entreprise une decision qu elle n a pas prise, et effacerait
 * la difference entre « ecarte apres examen » et « arrive trop tard ». C est le
 * meme raisonnement que pour l annulation d une mission : le statut d une
 * candidature enregistre une decision humaine, pas une consequence mecanique.
 *
 * Ce qui manquait n etait donc pas le statut, mais le CONTEXTE. L entreprise
 * voyait deja qu elle ne pouvait plus retenir personne ; l interimaire, lui,
 * lisait « en attente » indefiniment, sans savoir que sa chance etait passee.
 */
describe("SL2d - mission pourvue : ce que chaque cote comprend", () => {
  const applyTo = async (missionId: string, token: string) =>
    (
      await authenticated(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: missionId })
    ).body.id as string;

  const workerView = async (token: string, missionId: string) =>
    (
      await authenticated(
        request(app).get("/api/v1/workers/me/applications"),
        token,
      )
    ).body.applications.find(
      (one: { mission_id: string }) => one.mission_id === missionId,
    );

  /** Une mission a un poste, pourvue, avec un second candidat laisse en attente. */
  const pourvue = async (label: string, day: number) => {
    const mission = await publishedMission(`SL2d ${label}`, {
      headcount: 1,
      ...slotAt(day, 9, 6),
    });
    const retenu = await newWorker(`sl2d.${label}.retenu@example.test`);
    const attente = await newWorker(`sl2d.${label}.attente@example.test`);
    const premiere = await applyTo(mission, retenu.token);
    const seconde = await applyTo(mission, attente.token);
    expect((await decideAs(mission, premiere, "accepted")).status).toBe(200);
    return { mission, retenu, attente, premiere, seconde };
  };

  it("laisse la candidature restante en attente, sans la refuser d office", async () => {
    const { seconde } = await pourvue("intacte", 200);
    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM applications WHERE id=$1",
      [seconde],
    );
    expect(rows[0].status).toBe("pending");
  });

  it("dit a l interimaire en attente que les postes sont pourvus", async () => {
    // Le point de SL2d. Sans ce contexte, cette candidature est indistinguable
    // d une candidature encore jouable.
    const { attente, mission } = await pourvue("contexte", 201);
    const vue = await workerView(attente.token, mission);
    expect(vue.status).toBe("pending");
    expect(vue.mission.capacity).toMatchObject({
      headcount: 1,
      filled: 1,
      remaining: 0,
      full: true,
    });
    expect(vue.mission.recruiting).toBe(false);
    expect(vue.mission.recruiting_blocked).toBe("full");
  });

  it("montre a l interimaire retenu une mission confirmee et pourvue", async () => {
    const { retenu, mission } = await pourvue("confirmee", 202);
    const vue = await workerView(retenu.token, mission);
    expect(vue.status).toBe("accepted");
    expect(vue.mission.phase).toBe("upcoming");
    expect(vue.mission.capacity.full).toBe(true);
  });

  it("laisse une mission avec de la place ouverte au recrutement", async () => {
    // Le pendant : deux postes, un pourvu. Rien ne doit se fermer.
    const mission = await publishedMission("SL2d place restante", {
      headcount: 2,
      ...slotAt(203, 9, 6),
    });
    const un = await newWorker("sl2d.place.un@example.test");
    const deux = await newWorker("sl2d.place.deux@example.test");
    const premiere = await applyTo(mission, un.token);
    await applyTo(mission, deux.token);
    await decideAs(mission, premiere, "accepted");

    const vue = await workerView(deux.token, mission);
    expect(vue.mission.capacity).toMatchObject({ filled: 1, remaining: 1 });
    expect(vue.mission.recruiting).toBe(true);
    expect(vue.mission.recruiting_blocked).toBe(null);
  });

  it("sert le meme vocabulaire au tableau de bord entreprise", async () => {
    // Les deux cotes doivent decrire la meme situation avec les memes mots :
    // c est ce qui empeche les ecrans de se contredire.
    const { mission } = await pourvue("entreprise", 204);
    const vue = (
      await authenticated(
        request(app).get("/api/v1/company/me/applications"),
        ownerToken,
      )
    ).body.applications.filter(
      (one: { mission: { id: string } }) => one.mission.id === mission,
    );
    expect(vue.length).toBe(2);
    for (const candidature of vue) {
      expect(candidature.mission.recruiting).toBe(false);
      expect(candidature.mission.recruiting_blocked).toBe("full");
      expect(candidature.mission.capacity.full).toBe(true);
    }
    // Le decompte par statut reste celui des faits : une acceptee, une en
    // attente. Le contexte n a rien reecrit.
    const statuts = vue.map((c: { status: string }) => c.status).sort();
    expect(statuts).toEqual(["accepted", "pending"]);
  });

  it("refuse toujours une acceptation supplementaire, sans rien casser", async () => {
    const { mission, seconde } = await pourvue("refus", 205);
    const tentative = await decideAs(mission, seconde, "accepted");
    expect(tentative.status).toBe(409);
    expect(tentative.body.error.code).toBe("MISSION_FULL");

    // Et le refus explicite reste possible : c est la seule action qui reste.
    expect((await decideAs(mission, seconde, "rejected")).status).toBe(200);
  });

  it("signale l annulation plutot que la completude quand les deux sont vraies", async () => {
    // Priorite du motif : une mission annulee n a rien pourvu. Repondre
    // « full » ferait dire a l ecran « tous les postes sont pourvus » d une
    // offre retiree.
    const { mission, attente } = await pourvue("annulee", 206);
    await db.query("UPDATE missions SET status='cancelled' WHERE id=$1", [
      mission,
    ]);
    const vue = await workerView(attente.token, mission);
    expect(vue.mission.phase).toBe("cancelled");
    expect(vue.mission.recruiting_blocked).toBe("cancelled");
  });
});
