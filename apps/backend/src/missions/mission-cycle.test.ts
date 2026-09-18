import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { ApplicationService } from "../applications/service.js";
import { MissionService } from "./service.js";
import { missionCreateSchema } from "./schemas.js";

/**
 * Le cycle de vie d'une mission, joué de bout en bout contre une vraie base.
 *
 * PGlite est PostgreSQL compilé en WebAssembly : les huit migrations y sont
 * rejouées, déclencheurs compris. Ce qui est vérifié ici l'est donc par le
 * moteur, pas par un doublure — en particulier tout ce qui touche à
 * l'engagement, dont la garantie vit dans le déclencheur de la migration 008.
 *
 * DÉTERMINISME. Aucun test ne dépend de l'heure à laquelle on le lance. Les
 * créneaux futurs sont construits en décalage depuis `now()` ; les créneaux
 * passés — qu'aucune route ne sait créer, `publish` refusant une mission déjà
 * commencée — sont posés par un `UPDATE` relatif à `now()`, jamais par une date
 * écrite en dur qui finirait par se périmer.
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

const publish = vi.fn();
const accounts = new AccountService(db);
const missions = new MissionService(db, undefined, { publish });
const applications = new ApplicationService(db, { publish });
const app = createApp(
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "1000" }),
  accounts,
  undefined,
  missions,
  undefined,
  applications,
);

const password = "Cycle-test-password-42!";
const auth = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

let ownerToken = "";
let ownerId = "";
let rivalToken = "";

/** Un créneau daté, exprimé en jours et en heures depuis maintenant. */
const slotAt = (dayOffset: number, hour: number, hours: number) => {
  const starts = new Date();
  starts.setUTCDate(starts.getUTCDate() + dayOffset);
  starts.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + hours * 3_600_000).toISOString(),
  };
};

const draft = (title: string, over: Record<string, unknown> = {}) =>
  missionCreateSchema.parse({
    title,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...slotAt(20, 9, 6),
    ...over,
  });

const newDraft = (title: string, over: Record<string, unknown> = {}) =>
  missions.create(ownerId, draft(title, over));

async function published(title: string, over: Record<string, unknown> = {}) {
  const id = await newDraft(title, over);
  await missions.publish(ownerId, id);
  return id;
}

/** Un intérimaire capable de postuler, rien de plus. */
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

const applyTo = async (missionId: string, token: string) =>
  auth(request(app).post("/api/v1/workers/me/applications"), token).send({
    mission_id: missionId,
  });

const decide = (
  missionId: string,
  applicationId: string,
  status: "accepted" | "rejected",
) =>
  auth(
    request(app).patch(
      `/api/v1/missions/${missionId}/applications/${applicationId}`,
    ),
    ownerToken,
  ).send({ status });

const cancel = (missionId: string, token = ownerToken) =>
  auth(request(app).post(`/api/v1/missions/${missionId}/cancel`), token).send();

const readMission = (missionId: string) =>
  auth(request(app).get(`/api/v1/missions/${missionId}`), ownerToken);

/** Recule le créneau d'une mission, relativement à `now()`. */
const moveWindow = (missionId: string, fromHours: number, toHours: number) =>
  db.query(
    `UPDATE missions
        SET starts_at = now() + ($2 || ' hours')::interval,
            ends_at   = now() + ($3 || ' hours')::interval
      WHERE id = $1`,
    [missionId, String(fromHours), String(toHours)],
  );

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  for (const email of ["owner.cycle@example.test", "rival.cycle@example.test"])
    await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
      email,
    ]);
  const owner = await accounts.register("owner.cycle@example.test", password);
  ownerToken = owner.access_token;
  ownerId = (await accounts.authenticate(ownerToken)).id;
  rivalToken = (await accounts.register("rival.cycle@example.test", password))
    .access_token;
}, 30_000);

afterAll(() => pg.close());

describe("cycle de vie — phase servie par l'API", () => {
  it("décrit un brouillon", async () => {
    const id = await newDraft("Cycle brouillon");
    const body = (await readMission(id)).body;
    expect(body.phase).toBe("draft");
    expect(body.recruiting).toBe(false);
    expect(body.recruiting_blocked).toBe("draft");
    expect(body.capacity).toMatchObject({ filled: 0, full: false });
  });

  it("décrit une mission publiée que personne n'a rejointe", async () => {
    const id = await published("Cycle publiée");
    const body = (await readMission(id)).body;
    expect(body.phase).toBe("open");
    expect(body.recruiting).toBe(true);
    expect(body.recruiting_blocked).toBe(null);
  });

  it("passe à « à venir » dès la première acceptation", async () => {
    const id = await published("Cycle à venir", {
      headcount: 2,
      ...slotAt(21, 9, 6),
    });
    const worker = await newWorker("cycle.avenir@example.test");
    const application = (await applyTo(id, worker.token)).body.id;

    expect((await readMission(id)).body.phase).toBe("open");
    expect((await decide(id, application, "accepted")).status).toBe(200);

    const body = (await readMission(id)).body;
    expect(body.phase).toBe("upcoming");
    // Une place reste : « à venir » et « pourvue » sont deux axes distincts.
    expect(body.recruiting).toBe(true);
    expect(body.capacity).toMatchObject({ filled: 1, remaining: 1 });
  });

  it("reste « à venir » une fois complète, et cesse de recruter", async () => {
    const id = await published("Cycle complète", { ...slotAt(22, 9, 6) });
    const worker = await newWorker("cycle.complete@example.test");
    const application = (await applyTo(id, worker.token)).body.id;
    await decide(id, application, "accepted");

    const body = (await readMission(id)).body;
    // Le point que la refonte tenait à ne pas confondre : le statut écrit reste
    // `open`. Être complet décrit le recrutement, pas le cycle de vie.
    expect(body.status).toBe("open");
    expect(body.phase).toBe("upcoming");
    expect(body.recruiting).toBe(false);
    expect(body.recruiting_blocked).toBe("full");
    expect(body.capacity.full).toBe(true);
  });

  it("décrit une mission en cours", async () => {
    const id = await published("Cycle en cours", { ...slotAt(23, 9, 6) });
    const worker = await newWorker("cycle.encours@example.test");
    const application = (await applyTo(id, worker.token)).body.id;
    await decide(id, application, "accepted");
    await moveWindow(id, -1, 5);

    const body = (await readMission(id)).body;
    expect(body.phase).toBe("in_progress");
    // Une mission commencée continue d'accepter : un remplacement de dernière
    // minute est un cas normal du métier. Elle est ici complète, d'où `full`.
    expect(body.recruiting_blocked).toBe("full");
  });

  it("décrit une mission terminée", async () => {
    const id = await published("Cycle terminée", { ...slotAt(24, 9, 6) });
    await moveWindow(id, -10, -4);

    const body = (await readMission(id)).body;
    expect(body.phase).toBe("completed");
    expect(body.recruiting).toBe(false);
    expect(body.recruiting_blocked).toBe("ended");
  });

  it("sert la phase à l'intérimaire comme à l'entreprise", async () => {
    const id = await published("Cycle vu du worker", { ...slotAt(25, 9, 6) });
    const worker = await newWorker("cycle.vue.worker@example.test");
    const detail = await auth(
      request(app).get(`/api/v1/workers/me/missions/${id}`),
      worker.token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.phase).toBe("open");
    expect(detail.body.recruiting).toBe(true);
    expect(detail.body.capacity).toMatchObject({ filled: 0, full: false });
  });
});

describe("annulation — règles et refus", () => {
  it("annule une mission publiée sans aucune candidature", async () => {
    const id = await published("Annulation simple", { ...slotAt(30, 9, 6) });
    const response = await cancel(id);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("cancelled");
    expect(response.body.phase).toBe("cancelled");
    expect(response.body.recruiting).toBe(false);
    expect(response.body.recruiting_blocked).toBe("cancelled");
  });

  it("refuse d'annuler un brouillon", async () => {
    // Un brouillon n'a jamais été offert : l'annuler ne retirerait rien.
    const id = await newDraft("Annulation brouillon");
    const response = await cancel(id);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
    expect((await readMission(id)).body.status).toBe("draft");
  });

  it("refuse une seconde annulation", async () => {
    const id = await published("Annulation double", { ...slotAt(31, 9, 6) });
    expect((await cancel(id)).status).toBe(200);
    const again = await cancel(id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("refuse d'annuler une mission déjà commencée", async () => {
    const id = await published("Annulation commencée", { ...slotAt(32, 9, 6) });
    await moveWindow(id, -1, 5);
    const response = await cancel(id);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MISSION_ALREADY_STARTED");
    expect((await readMission(id)).body.status).toBe("open");
  });

  it("refuse d'annuler une mission terminée", async () => {
    const id = await published("Annulation terminée", { ...slotAt(33, 9, 6) });
    await moveWindow(id, -10, -4);
    const response = await cancel(id);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MISSION_ENDED");
  });

  it("déclare introuvable la mission d'une autre entreprise", async () => {
    // Comme partout ailleurs : 404, jamais 403. On ne révèle pas son existence.
    const id = await published("Annulation d'autrui", { ...slotAt(34, 9, 6) });
    const response = await cancel(id, rivalToken);
    expect(response.status).toBe(404);
    expect((await readMission(id)).body.status).toBe("open");
  });

  it("refuse le rôle intérimaire", async () => {
    const id = await published("Annulation par worker", {
      ...slotAt(35, 9, 6),
    });
    const worker = await newWorker("cycle.worker.cancel@example.test");
    expect((await cancel(id, worker.token)).status).toBe(403);
  });
});

describe("annulation — effet sur les candidatures", () => {
  it("ne détruit aucune candidature et conserve l'historique", async () => {
    const id = await published("Annulation historique", {
      headcount: 2,
      ...slotAt(40, 9, 6),
    });
    const retenu = await newWorker("cycle.retenu@example.test");
    const enAttente = await newWorker("cycle.attente@example.test");
    const ecarte = await newWorker("cycle.ecarte@example.test");

    const accepte = (await applyTo(id, retenu.token)).body.id;
    const pending = (await applyTo(id, enAttente.token)).body.id;
    const refuse = (await applyTo(id, ecarte.token)).body.id;
    await decide(id, accepte, "accepted");
    await decide(id, refuse, "rejected");

    expect((await cancel(id)).status).toBe(200);

    const { rows } = await db.query<{ id: string; status: string }>(
      "SELECT id,status FROM applications WHERE mission_id=$1 ORDER BY status",
      [id],
    );
    // Les trois lignes sont là, chacune avec le statut qu'elle avait. Une
    // acceptation reste une acceptation : la réécrire en « refusée » après coup
    // attribuerait à l'entreprise une décision qu'elle n'a pas prise.
    expect(rows).toEqual([
      { id: accepte, status: "accepted" },
      { id: pending, status: "pending" },
      { id: refuse, status: "rejected" },
    ]);
  });

  it("montre la mission annulée à l'intérimaire, phase comprise", async () => {
    const id = await published("Annulation vue worker", {
      ...slotAt(41, 9, 6),
    });
    const worker = await newWorker("cycle.vue.annulee@example.test");
    await applyTo(id, worker.token);
    await cancel(id);

    const list = await auth(
      request(app).get("/api/v1/workers/me/applications"),
      worker.token,
    );
    const mine = list.body.applications.find(
      (a: { mission_id: string }) => a.mission_id === id,
    );
    // Sans ce champ, l'écran devait deviner « annulée » depuis le statut brut.
    expect(mine.mission.phase).toBe("cancelled");
    expect(mine.status).toBe("pending");
  });

  it("laisse l'entreprise refuser une candidature après annulation", async () => {
    // C'est même la seule chose qu'il lui reste à faire : clore les dossiers.
    const id = await published("Annulation puis refus", {
      ...slotAt(42, 9, 6),
    });
    const worker = await newWorker("cycle.refus.apres@example.test");
    const application = (await applyTo(id, worker.token)).body.id;
    await cancel(id);

    const response = await decide(id, application, "rejected");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("rejected");
  });

  it("interdit d'accepter sur une mission annulée", async () => {
    const id = await published("Annulation puis accept", {
      ...slotAt(43, 9, 6),
    });
    const worker = await newWorker("cycle.accept.apres@example.test");
    const application = (await applyTo(id, worker.token)).body.id;
    await cancel(id);

    const response = await decide(id, application, "accepted");
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MISSION_CANCELLED");

    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM applications WHERE id=$1",
      [application],
    );
    expect(rows[0].status).toBe("pending");
  });

  it("interdit d'accepter sur une mission terminée", async () => {
    const id = await published("Terminée puis accept", { ...slotAt(44, 9, 6) });
    const worker = await newWorker("cycle.accept.finie@example.test");
    const application = (await applyTo(id, worker.token)).body.id;
    await moveWindow(id, -10, -4);

    const response = await decide(id, application, "accepted");
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MISSION_ENDED");
  });

  it("interdit de postuler à une mission annulée, en le disant", async () => {
    const id = await published("Postuler sur annulée", { ...slotAt(45, 9, 6) });
    await cancel(id);
    const worker = await newWorker("cycle.postule.annulee@example.test");
    const response = await applyTo(id, worker.token);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MISSION_CANCELLED");
  });

  it("retire la mission annulée des offres visibles", async () => {
    const id = await published("Annulée hors vitrine", { ...slotAt(46, 9, 6) });
    const worker = await newWorker("cycle.vitrine@example.test");

    // `listOpen` est le prédicat de visibilité lui-même. La liste servie par
    // `/workers/me/missions` le filtre ensuite par compatibilité : s'y fier
    // ici mesurerait l'éligibilité du profil, pas la disparition de l'offre.
    const offertes = async () =>
      (await missions.listOpen(false)).map((m) => m.id);
    expect(await offertes()).toContain(id);

    // Le détail aussi, qui est le chemin réellement emprunté par un lien direct.
    const avant = await auth(
      request(app).get(`/api/v1/workers/me/missions/${id}`),
      worker.token,
    );
    expect(avant.status).toBe(200);

    await cancel(id);

    expect(await offertes()).not.toContain(id);
    const apres = await auth(
      request(app).get(`/api/v1/workers/me/missions/${id}`),
      worker.token,
    );
    // Introuvable, et non « interdite » : la mission sort de son univers.
    expect(apres.status).toBe(404);
  });

  it("garde la mission annulée consultable par qui y a postulé", async () => {
    // L'historique ne doit pas se refermer sur celui qui y figure : sa
    // candidature renvoie vers une mission qui doit rester lisible.
    const id = await published("Annulée mais consultable", {
      ...slotAt(48, 9, 6),
    });
    const worker = await newWorker("cycle.historique.detail@example.test");
    await applyTo(id, worker.token);
    await cancel(id);

    const detail = await auth(
      request(app).get(`/api/v1/workers/me/missions/${id}`),
      worker.token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.phase).toBe("cancelled");
    expect(detail.body.recruiting).toBe(false);
  });

  it("suspend le rapprochement en donnant le bon motif", async () => {
    // `closed` aurait fait annoncer « tous les postes sont pourvus » d'une
    // mission que personne n'a pourvue.
    const id = await published("Annulée sans matching", {
      ...slotAt(47, 9, 6),
    });
    await cancel(id);
    const response = await auth(
      request(app).get(`/api/v1/missions/${id}/candidates`),
      ownerToken,
    );
    expect(response.status).toBe(200);
    expect(response.body.inactive).toBe("cancelled");
    expect(response.body.candidates).toEqual([]);
  });
});

describe("annulation — libération de l'engagement", () => {
  it("rend son créneau à l'intérimaire, y compris au niveau de la base", async () => {
    // Deux missions qui se chevauchent franchement : 9 h → 15 h et 12 h → 18 h.
    const premiere = await published("Engagement libéré A", {
      ...slotAt(50, 9, 6),
    });
    const seconde = await published("Engagement libéré B", {
      ...slotAt(50, 12, 6),
    });
    const worker = await newWorker("cycle.liberation@example.test");
    const surA = (await applyTo(premiere, worker.token)).body.id;
    const surB = (await applyTo(seconde, worker.token)).body.id;

    expect((await decide(premiere, surA, "accepted")).status).toBe(200);
    // Tant que A tient, B est refusée — c'est la garantie de la migration 008.
    const bloque = await decide(seconde, surB, "accepted");
    expect(bloque.status).toBe(409);
    expect(bloque.body.error.code).toBe("WORKER_ENGAGED");

    expect((await cancel(premiere)).status).toBe(200);

    // A annulée, le créneau est libre : ni le service ni le déclencheur ne s'y
    // opposent plus. Aucune donnée n'a bougé dans `applications` — c'est le
    // statut de la mission, à lui seul, qui a libéré la personne.
    expect((await decide(seconde, surB, "accepted")).status).toBe(200);

    const { rows } = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM applications WHERE worker_id=$1 AND status='accepted'",
      [worker.id],
    );
    expect(Number(rows[0].n)).toBe(2);
  });

  it("laisse deux missions consécutives se cumuler", async () => {
    // [10 h, 16 h) puis [16 h, 22 h) : aucune minute réclamée deux fois. Le
    // service du midi suivi du service du soir est le quotidien du métier.
    const midi = await published("Consécutive midi", { ...slotAt(51, 10, 6) });
    const soir = await published("Consécutive soir", { ...slotAt(51, 16, 6) });
    const worker = await newWorker("cycle.consecutive@example.test");
    const surMidi = (await applyTo(midi, worker.token)).body.id;
    const surSoir = (await applyTo(soir, worker.token)).body.id;

    expect((await decide(midi, surMidi, "accepted")).status).toBe(200);
    expect((await decide(soir, surSoir, "accepted")).status).toBe(200);
  });

  it("garantit hors du service qu'une mission annulée ne réserve plus rien", async () => {
    // La preuve qui compte : écriture SQL directe, sans passer par l'API. Si le
    // déclencheur de la 008 tenait encore compte d'une mission annulée, cette
    // ligne serait rejetée.
    const annulee = await published("SQL annulée A", { ...slotAt(52, 9, 6) });
    const reprise = await published("SQL annulée B", { ...slotAt(52, 12, 6) });
    const worker = await newWorker("cycle.sql.annulee@example.test");
    const surA = (await applyTo(annulee, worker.token)).body.id;
    const surB = (await applyTo(reprise, worker.token)).body.id;
    await decide(annulee, surA, "accepted");

    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [surB]),
    ).rejects.toThrow();

    await cancel(annulee);

    await expect(
      db.query("UPDATE applications SET status='accepted' WHERE id=$1", [surB]),
    ).resolves.toBeTruthy();
  });
});

describe("annulation — événement métier", () => {
  it("émet mission.cancelled avec la mission telle qu'elle est après la décision", async () => {
    publish.mockClear();
    const id = await published("Annulation événement", { ...slotAt(60, 9, 6) });
    expect(publish).toHaveBeenCalledWith(
      "mission.published",
      expect.objectContaining({ mission_id: id }),
    );

    publish.mockClear();
    await cancel(id);

    expect(publish).toHaveBeenCalledTimes(1);
    const [type, data] = publish.mock.calls[0];
    expect(type).toBe("mission.cancelled");
    expect(data.mission_id).toBe(id);
    expect(data.mission.status).toBe("cancelled");
    expect(data.mission.title).toBe("Annulation événement");
    expect(data.company.id).toBe(ownerId);
  });

  it("n'émet rien quand l'annulation est refusée", async () => {
    // L'émission a lieu après COMMIT : un refus métier ne doit jamais faire
    // partir un avis d'annulation vers n8n.
    const id = await published("Annulation refusée", { ...slotAt(61, 9, 6) });
    await moveWindow(id, -10, -4);
    publish.mockClear();
    expect((await cancel(id)).status).toBe(409);
    expect(publish).not.toHaveBeenCalled();
  });
});
