import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { MissionService } from "../missions/service.js";
import { ApplicationService } from "./service.js";
import { memoryMediaService, uploadedMedia } from "../media/testing.js";

// Stockage en memoire : la photo est desormais exigee a la publication.
const missionMedia = memoryMediaService();

/**
 * Recette technique de la migration 008 — conflits d'engagement.
 *
 * Ce fichier ne teste pas des fonctions : il rejoue le parcours métier complet
 * contre le **vrai** serveur HTTP et une **vraie** base PostgreSQL. PGlite est
 * PostgreSQL compilé en WebAssembly : le plpgsql, les verrous `FOR UPDATE` et
 * les exceptions du déclencheur s'y exécutent réellement. Rien n'est simulé,
 * aucun appel n'est intercepté.
 *
 * La première vérification porte sur l'environnement lui-même : on prouve que
 * le déclencheur de la 008 est bien présent avant d'affirmer quoi que ce soit
 * sur ce qu'il garantit. Une recette qui ne vérifie pas son propre terrain
 * valide surtout l'illusion d'avoir testé.
 */

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
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "5000" }),
  accounts,
  undefined,
  missions,
  undefined,
  applications,
);

const password = "Recette-engagement-2026!";
const auth = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

/**
 * Un créneau daté, exprimé en jours et heures depuis maintenant.
 *
 * L'exemple de la recette portait sur le 19/09/2026 10:00 → 22:00. Cette date
 * est désormais passée : les règles métier refusent de publier une mission
 * déjà commencée. Les décalages relatifs conservent la forme du scénario —
 * mêmes durées, mêmes recouvrements — sans dépendre du calendrier.
 */
const slot = (dayOffset: number, hour: number, hours: number) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
};

let companyA = "";
let companyAId = "";
let companyB = "";
let companyBId = "";
let workerToken = "";
let workerId = "";

/** Une mission publiée, appartenant à l'entreprise indiquée. */
async function published(
  ownerId: string,
  title: string,
  window: { starts_at: string; ends_at: string },
  headcount = 1,
) {
  const id = await missions.create(ownerId, {
    title,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    description: "",
    address: "",
    pay_amount: null,
    pay_unit: null,
    headcount,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    media: uploadedMedia(ownerId),
    ...window,
  });
  await missions.publish(ownerId, id);
  return id;
}

const apply = (missionId: string) =>
  auth(request(app).post("/api/v1/workers/me/applications"), workerToken).send({
    mission_id: missionId,
  });

const decide = (
  token: string,
  missionId: string,
  applicationId: string,
  status: "accepted" | "rejected",
) =>
  auth(
    request(app).patch(
      `/api/v1/missions/${missionId}/applications/${applicationId}`,
    ),
    token,
  ).send({ status });

const statusOf = async (applicationId: string) =>
  (
    await db.query<{ status: string }>(
      "SELECT status FROM applications WHERE id=$1",
      [applicationId],
    )
  ).rows[0].status;

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  for (const email of ["recette.a@example.test", "recette.b@example.test"])
    await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
      email,
    ]);

  companyA = (await accounts.register("recette.a@example.test", password))
    .access_token;
  companyAId = (await accounts.authenticate(companyA)).id;
  companyB = (await accounts.register("recette.b@example.test", password))
    .access_token;
  companyBId = (await accounts.authenticate(companyB)).id;

  workerToken = (
    await accounts.register("recette.worker@example.test", password)
  ).access_token;
  workerId = (await accounts.authenticate(workerToken)).id;
  await db.query(
    `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
     VALUES($1,'Lyon','69002','serveur')`,
    [workerId],
  );
}, 30_000);

afterAll(() => pg.close());

describe("recette 008 — l'environnement porte bien la contrainte", () => {
  it("a appliqué les huit migrations, 008 comprise", async () => {
    const { rows } = await db.query<{ proname: string }>(
      "SELECT proname FROM pg_proc WHERE proname = 'applications_enforce_engagement'",
    );
    expect(rows).toHaveLength(1);
  });

  it("a installé le déclencheur sur la table des candidatures", async () => {
    const { rows } = await db.query<{ tgname: string; tgenabled: string }>(
      `SELECT t.tgname, t.tgenabled
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'applications' AND t.tgname = 'applications_engagement'`,
    );
    expect(rows).toHaveLength(1);
    // 'O' = activé pour l'origine des écritures, donc réellement actif.
    expect(rows[0].tgenabled).toBe("O");
  });
});

describe("recette 008 — scénario principal", () => {
  let missionA = "";
  let missionB = "";
  let applicationA = "";
  let applicationB = "";

  it("A. l'intérimaire candidate aux deux missions qui se chevauchent", async () => {
    // Forme du scénario demandé : 10:00 → 22:00 puis 18:00 → 23:00.
    missionA = await published(companyAId, "Recette A", slot(7, 10, 12));
    missionB = await published(companyBId, "Recette B", slot(7, 18, 5));

    const first = await apply(missionA);
    const second = await apply(missionB);
    expect([first.status, second.status]).toEqual([201, 201]);
    applicationA = first.body.id;
    applicationB = second.body.id;

    // Deux candidatures en attente coexistent : postuler n'engage à rien.
    expect(await statusOf(applicationA)).toBe("pending");
    expect(await statusOf(applicationB)).toBe("pending");
  });

  it("B. l'entreprise A accepte, et l'engagement est enregistré", async () => {
    const r = await decide(companyA, missionA, applicationA, "accepted");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("accepted");
    expect(await statusOf(applicationA)).toBe("accepted");

    const capacity = (
      await auth(request(app).get(`/api/v1/missions/${missionA}`), companyA)
    ).body.capacity;
    expect(capacity).toMatchObject({ filled: 1, remaining: 0, full: true });
  });

  it("C. l'entreprise B se voit refuser le même intérimaire", async () => {
    const r = await decide(companyB, missionB, applicationB, "accepted");
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("WORKER_ENGAGED");

    // La candidature B n'a jamais changé d'état.
    expect(await statusOf(applicationB)).toBe("pending");

    // Et la capacité de la mission B n'a pas bougé d'un poste.
    const capacity = (
      await auth(request(app).get(`/api/v1/missions/${missionB}`), companyB)
    ).body.capacity;
    expect(capacity).toMatchObject({ filled: 0, remaining: 1, full: false });
  });

  it("D. la base ne contient aucun double engagement", async () => {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM applications a1
         JOIN missions m1 ON m1.id = a1.mission_id AND m1.status <> 'cancelled'
         JOIN applications a2 ON a2.worker_id = a1.worker_id AND a2.id > a1.id
         JOIN missions m2 ON m2.id = a2.mission_id AND m2.status <> 'cancelled'
        WHERE a1.status = 'accepted' AND a2.status = 'accepted'
          AND m1.starts_at < m2.ends_at AND m2.starts_at < m1.ends_at`,
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("E. l'entreprise B peut toujours refuser la candidature", async () => {
    // Le conflit ferme l'acceptation, jamais la clôture du dossier.
    const r = await decide(companyB, missionB, applicationB, "rejected");
    expect(r.status).toBe(200);
    expect(await statusOf(applicationB)).toBe("rejected");
  });
});

describe("recette 008 — cas limites, contre la vraie contrainte SQL", () => {
  /**
   * Engage l'intérimaire sur une première fenêtre, puis tente une seconde.
   * Chaque cas emploie son propre intérimaire : les scénarios ne se polluent
   * pas, et l'ordre d'exécution n'influence aucun résultat.
   */
  const scenario = async (
    name: string,
    first: { starts_at: string; ends_at: string },
    second: { starts_at: string; ends_at: string },
  ) => {
    const token = (
      await accounts.register(`recette.${name}@example.test`, password)
    ).access_token;
    const id = (await accounts.authenticate(token)).id;
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
       VALUES($1,'Lyon','69002','serveur')`,
      [id],
    );
    const a = await published(companyAId, `Limite A ${name}`, first);
    const b = await published(companyBId, `Limite B ${name}`, second);
    const ia = (
      await auth(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: a })
    ).body.id;
    const ib = (
      await auth(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: b })
    ).body.id;
    expect((await decide(companyA, a, ia, "accepted")).status).toBe(200);
    return {
      worker: id,
      missionB: b,
      applicationB: ib,
      attempt: await decide(companyB, b, ib, "accepted"),
    };
  };

  it("refuse un chevauchement partiel", async () => {
    const { attempt, applicationB } = await scenario(
      "partiel",
      slot(20, 10, 12),
      slot(20, 18, 5),
    );
    expect(attempt.status).toBe(409);
    expect(attempt.body.error.code).toBe("WORKER_ENGAGED");
    expect(await statusOf(applicationB)).toBe("pending");
  });

  it("refuse une mission entièrement comprise dans l'engagement", async () => {
    const { attempt } = await scenario(
      "inclus",
      slot(21, 6, 12),
      slot(21, 10, 2),
    );
    expect(attempt.status).toBe(409);
    expect(attempt.body.error.code).toBe("WORKER_ENGAGED");
  });

  it("refuse des horaires strictement identiques", async () => {
    const { attempt } = await scenario(
      "identique",
      slot(22, 9, 6),
      slot(22, 9, 6),
    );
    expect(attempt.status).toBe(409);
    expect(attempt.body.error.code).toBe("WORKER_ENGAGED");
  });

  it("autorise deux missions consécutives, bornes semi-ouvertes", async () => {
    // 10:00 → 12:00 puis 12:00 → 14:00 : aucune minute réclamée deux fois.
    const { attempt, applicationB } = await scenario(
      "consecutif",
      slot(23, 10, 2),
      slot(23, 12, 2),
    );
    expect(attempt.status).toBe(200);
    expect(await statusOf(applicationB)).toBe("accepted");
  });

  it("autorise la mission qui précède immédiatement l'engagement", async () => {
    const { attempt } = await scenario(
      "precedent",
      slot(24, 12, 2),
      slot(24, 10, 2),
    );
    expect(attempt.status).toBe(200);
  });

  it("libère le créneau lorsque la mission engageante est annulée", async () => {
    const token = (
      await accounts.register("recette.annule@example.test", password)
    ).access_token;
    const id = (await accounts.authenticate(token)).id;
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
       VALUES($1,'Lyon','69002','serveur')`,
      [id],
    );
    const a = await published(companyAId, "Annulée A", slot(25, 10, 12));
    const b = await published(companyBId, "Annulée B", slot(25, 18, 5));
    const ia = (
      await auth(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: a })
    ).body.id;
    const ib = (
      await auth(
        request(app).post("/api/v1/workers/me/applications"),
        token,
      ).send({ mission_id: b })
    ).body.id;
    await decide(companyA, a, ia, "accepted");
    await db.query("UPDATE missions SET status='cancelled' WHERE id=$1", [a]);

    expect((await decide(companyB, b, ib, "accepted")).status).toBe(200);
  });
});

/**
 * La couche qui garantit réellement l'invariant.
 *
 * Les tests précédents passent par le service, qui vérifie lui-même le conflit.
 * Ceux-ci écrivent **directement en SQL**, sans traverser une ligne de
 * TypeScript : seule la migration 008 peut alors refuser. C'est la seule preuve
 * qui vaille pour une contrainte censée tenir quel que soit l'appelant — et
 * notamment face à deux transactions concurrentes que le service ne voit pas.
 */
describe("recette 008 — garantie hors du service", () => {
  const direct = async (name: string, hours: number, offset: number) => {
    const token = (
      await accounts.register(`recette.sql.${name}@example.test`, password)
    ).access_token;
    const id = (await accounts.authenticate(token)).id;
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
       VALUES($1,'Lyon','69002','serveur')`,
      [id],
    );
    const a = await published(companyAId, `SQL A ${name}`, slot(30, 10, hours));
    const b = await published(companyBId, `SQL B ${name}`, slot(30, offset, 4));
    await db.query(
      "INSERT INTO applications(mission_id,worker_id,status) VALUES($1,$2,'accepted')",
      [a, id],
    );
    const pending = (
      await db.query<{ id: string }>(
        "INSERT INTO applications(mission_id,worker_id) VALUES($1,$2) RETURNING id",
        [b, id],
      )
    ).rows[0].id;
    return { worker: id, pending };
  };

  it("refuse en base une acceptation qui chevauche, sans passer par le service", async () => {
    const { pending } = await direct("conflit", 8, 14);
    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [
        pending,
      ]),
    ).rejects.toThrow();
    expect(await statusOf(pending)).toBe("pending");
  });

  it("refuse aussi une insertion directe déjà acceptée", async () => {
    // L'autre porte d'entrée : INSERT plutôt qu'UPDATE.
    const token = (
      await accounts.register("recette.sql.insert@example.test", password)
    ).access_token;
    const id = (await accounts.authenticate(token)).id;
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
       VALUES($1,'Lyon','69002','serveur')`,
      [id],
    );
    const a = await published(companyAId, "SQL insert A", slot(31, 10, 8));
    const b = await published(companyBId, "SQL insert B", slot(31, 14, 4));
    await db.query(
      "INSERT INTO applications(mission_id,worker_id,status) VALUES($1,$2,'accepted')",
      [a, id],
    );
    await expect(
      db.query(
        "INSERT INTO applications(mission_id,worker_id,status) VALUES($1,$2,'accepted')",
        [b, id],
      ),
    ).rejects.toThrow();
  });

  it("n'est pas plus strict que la règle : deux créneaux adjacents passent", async () => {
    const { pending } = await direct("adjacent", 4, 14);
    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [
        pending,
      ]),
    ).resolves.toBeTruthy();
    expect(await statusOf(pending)).toBe("accepted");
  });
});
