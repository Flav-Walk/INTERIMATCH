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
const draft = (title: string, over: Record<string, unknown> = {}) =>
  missionCreateSchema.parse({
    title,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...futureSlot(),
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
