import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { ApplicationService } from "../applications/service.js";
import { MissionService } from "../missions/service.js";
import { missionCreateSchema } from "../missions/schemas.js";
import {
  businessEventSchema,
  createBusinessEvent,
  type BusinessEvent,
  type BusinessEventType,
} from "./business-event.js";
import type { BusinessEventPublisher } from "./dispatcher.js";

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

const emitted: BusinessEvent[] = [];
const publisher: BusinessEventPublisher = {
  publish(eventType: BusinessEventType, data: Record<string, unknown>) {
    const event = createBusinessEvent(eventType, data);
    emitted.push(event);
    return event;
  },
};
const missions = new MissionService(db, undefined, publisher);
const applications = new ApplicationService(db, publisher);

let companyId = "";
let otherCompanyId = "";
let workerSequence = 0;
let skillId = "";

const futureSlot = (days = 5) => {
  const starts = new Date(Date.now() + days * 86_400_000);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 6 * 3_600_000).toISOString(),
  };
};

const draft = (title: string, over: Record<string, unknown> = {}) =>
  missionCreateSchema.parse({
    title,
    description: "Renfort pour le service en salle.",
    job: "serveur",
    address: "10 rue de la République",
    city: "Lyon",
    postal_code: "69002",
    pay_amount: 15.5,
    pay_unit: "hour",
    required_skill_ids: skillId ? [skillId] : [],
    ...futureSlot(),
    ...over,
  });

async function newWorker() {
  workerSequence += 1;
  const id = (
    await db.query<{ id: string }>(
      `INSERT INTO profiles(email,role,first_name,last_name)
       VALUES($1,'worker',$2,$3) RETURNING id`,
      [
        `domain-event-worker-${workerSequence}@example.test`,
        `Camille${workerSequence}`,
        `Martin${workerSequence}`,
      ],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job)
     VALUES($1,'Lyon','69002','serveur')`,
    [id],
  );
  return id;
}

async function publishedMission(title: string, over = {}) {
  const id = await missions.create(companyId, draft(title, over));
  await missions.publish(companyId, id);
  return id;
}

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));
  companyId = (
    await db.query<{ id: string }>(
      "INSERT INTO profiles(email,role) VALUES('domain-event-company@example.test','company') RETURNING id",
    )
  ).rows[0].id;
  otherCompanyId = (
    await db.query<{ id: string }>(
      "INSERT INTO profiles(email,role) VALUES('other-domain-event-company@example.test','company') RETURNING id",
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO company_profiles(profile_id,legal_name,establishment_name,
       sector,address,city,postal_code,phone,description)
     VALUES($1,'Bistrot Exemple SAS','Bistrot Exemple','restaurant',
       '20 quai Exemple','Lyon','69002','+33400000000','Restaurant de test')`,
    [companyId],
  );
  skillId = (
    await db.query<{ id: string }>(
      "SELECT id FROM skills ORDER BY name LIMIT 1",
    )
  ).rows[0].id;
}, 30_000);

beforeEach(() => {
  emitted.length = 0;
});

afterAll(() => pg.close());

describe("événements métier missions et candidatures", () => {
  it("publie mission.published une fois seulement après draft → open", async () => {
    const input = draft("Publication événementielle");
    const missionId = await missions.create(companyId, input);
    expect(emitted).toEqual([]);

    await missions.publish(companyId, missionId);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "mission.published",
      schema_version: "1.0",
      data: {
        mission_id: missionId,
        mission: {
          id: missionId,
          title: "Publication événementielle",
          description: "Renfort pour le service en salle.",
          status: "open",
          starts_at: input.starts_at,
          ends_at: input.ends_at,
          address: "10 rue de la République",
          city: "Lyon",
          postal_code: "69002",
          job: "serveur",
          headcount: 1,
          pay_amount: "15.50",
          pay_unit: "hour",
          skills: [{ id: skillId, required: true }],
        },
        company: {
          id: companyId,
          email: "domain-event-company@example.test",
          legal_name: "Bistrot Exemple SAS",
          establishment_name: "Bistrot Exemple",
          sector: "restaurant",
          phone: "+33400000000",
        },
      },
    });
    expect(emitted[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(emitted[0].data).not.toHaveProperty("password");

    await missions.update(companyId, missionId, { title: "Titre modifié" });
    await expect(missions.publish(companyId, missionId)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    } satisfies Partial<HttpError>);
    expect(emitted).toHaveLength(1);
  });

  it("n'émet rien lorsqu'une publication échoue", async () => {
    const past = futureSlot(-2);
    const missionId = await missions.create(
      companyId,
      draft("Publication impossible", past),
    );
    await expect(missions.publish(companyId, missionId)).rejects.toMatchObject({
      code: "MISSION_ALREADY_STARTED",
    } satisfies Partial<HttpError>);
    expect(emitted).toEqual([]);
  });

  it("publie application.created uniquement pour une création effective", async () => {
    const missionId = await publishedMission("Nouvelle candidature");
    const workerId = await newWorker();
    emitted.length = 0;

    const application = await applications.create(workerId, missionId);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.created",
      schema_version: "1.0",
      data: {
        application_id: application.id,
        application: {
          id: application.id,
          status: "pending",
          created_at: new Date(application.created_at).toISOString(),
          updated_at: new Date(application.updated_at).toISOString(),
        },
        worker: {
          id: workerId,
          email: `domain-event-worker-${workerSequence}@example.test`,
          main_job: "serveur",
          city: "Lyon",
        },
        mission: {
          id: missionId,
          title: "Nouvelle candidature",
          status: "open",
        },
        company: {
          id: companyId,
          email: "domain-event-company@example.test",
          establishment_name: "Bistrot Exemple",
        },
      },
    });

    await expect(
      applications.create(workerId, missionId),
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_EXISTS",
    } satisfies Partial<HttpError>);
    expect(emitted).toHaveLength(1);
  });

  it("n'émet pas application.created pour une mission absente ou un brouillon", async () => {
    const workerId = await newWorker();
    const draftId = await missions.create(
      companyId,
      draft("Brouillon sans candidature"),
    );

    await expect(
      applications.create(workerId, crypto.randomUUID()),
    ).rejects.toMatchObject({
      code: "MISSION_NOT_FOUND",
    } satisfies Partial<HttpError>);
    await expect(applications.create(workerId, draftId)).rejects.toMatchObject({
      code: "APPLICATION_CLOSED",
    } satisfies Partial<HttpError>);
    expect(emitted).toEqual([]);
  });

  it("n'émet pas application.created lorsque la mission est pleine", async () => {
    const missionId = await publishedMission("Mission pleine");
    const firstWorker = await newWorker();
    const secondWorker = await newWorker();
    const first = await applications.create(firstWorker, missionId);
    await applications.decide(companyId, missionId, first.id, "accepted");
    emitted.length = 0;

    await expect(
      applications.create(secondWorker, missionId),
    ).rejects.toMatchObject({
      code: "MISSION_FULL",
    } satisfies Partial<HttpError>);
    expect(emitted).toEqual([]);
  });

  it("n'émet pas application.accepted lorsque la capacité est atteinte", async () => {
    const missionId = await publishedMission(
      "Acceptation au-delà de la capacité",
    );
    const first = await applications.create(await newWorker(), missionId);
    const second = await applications.create(await newWorker(), missionId);
    await applications.decide(companyId, missionId, first.id, "accepted");
    emitted.length = 0;

    await expect(
      applications.decide(companyId, missionId, second.id, "accepted"),
    ).rejects.toMatchObject({
      code: "MISSION_FULL",
    } satisfies Partial<HttpError>);
    expect(emitted).toEqual([]);
  });

  it("publie application.accepted une seule fois pour pending → accepted", async () => {
    const missionId = await publishedMission("Candidature acceptée");
    const application = await applications.create(await newWorker(), missionId);
    emitted.length = 0;

    const decided = await applications.decide(
      companyId,
      missionId,
      application.id,
      "accepted",
    );
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.accepted",
      schema_version: "1.0",
      data: {
        application_id: application.id,
        application: {
          id: application.id,
          status: "accepted",
          updated_at: new Date(decided.updated_at).toISOString(),
        },
        mission: { id: missionId, title: "Candidature acceptée" },
        company: { id: companyId, establishment_name: "Bistrot Exemple" },
      },
    });

    await expect(
      applications.decide(companyId, missionId, application.id, "accepted"),
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_DECIDED",
    } satisfies Partial<HttpError>);
    await expect(
      applications.decide(companyId, missionId, application.id, "rejected"),
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_DECIDED",
    } satisfies Partial<HttpError>);
    expect(emitted).toHaveLength(1);
  });

  it("publie application.rejected une seule fois pour pending → rejected", async () => {
    const missionId = await publishedMission("Candidature refusée");
    const application = await applications.create(await newWorker(), missionId);
    emitted.length = 0;

    const decided = await applications.decide(
      companyId,
      missionId,
      application.id,
      "rejected",
    );
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.rejected",
      schema_version: "1.0",
      data: {
        application_id: application.id,
        application: {
          id: application.id,
          status: "rejected",
          updated_at: new Date(decided.updated_at).toISOString(),
        },
        mission: { id: missionId, title: "Candidature refusée" },
        company: { id: companyId, establishment_name: "Bistrot Exemple" },
      },
    });

    await expect(
      applications.decide(companyId, missionId, application.id, "rejected"),
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_DECIDED",
    } satisfies Partial<HttpError>);
    await expect(
      applications.decide(companyId, missionId, application.id, "accepted"),
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_DECIDED",
    } satisfies Partial<HttpError>);
    expect(emitted).toHaveLength(1);
  });

  it("ne mélange ni worker ni entreprise et accepte les profils optionnels absents", async () => {
    const missionId = await missions.create(
      otherCompanyId,
      draft("Mission entreprise sans établissement"),
    );
    await missions.publish(otherCompanyId, missionId);
    const bareWorker = (
      await db.query<{ id: string }>(
        `INSERT INTO profiles(email,role,first_name,last_name)
         VALUES('bare-event-worker@example.test','worker','Alex','Durand')
         RETURNING id`,
      )
    ).rows[0].id;
    emitted.length = 0;

    const application = await applications.create(bareWorker, missionId);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.created",
      data: {
        application_id: application.id,
        worker: {
          id: bareWorker,
          first_name: "Alex",
          last_name: "Durand",
          email: "bare-event-worker@example.test",
          main_job: null,
          city: null,
        },
        mission: {
          id: missionId,
          title: "Mission entreprise sans établissement",
        },
        company: {
          id: otherCompanyId,
          email: "other-domain-event-company@example.test",
          legal_name: null,
          establishment_name: null,
          sector: null,
          phone: null,
        },
      },
    });
    expect(emitted[0].data).not.toMatchObject({
      company: { id: companyId },
    });
  });

  it("n'émet rien si la transaction ne peut pas être validée", async () => {
    const missionId = await missions.create(
      companyId,
      draft("Rollback publication"),
    );
    const rollbackDb: Db = {
      query: db.query,
      transaction: (work) =>
        db.transaction(async (tx) => {
          await work(tx);
          throw new Error("simulated commit failure");
        }),
    };
    const rollbackMissions = new MissionService(
      rollbackDb,
      undefined,
      publisher,
    );

    await expect(
      rollbackMissions.publish(companyId, missionId),
    ).rejects.toThrow("simulated commit failure");
    expect(emitted).toEqual([]);
    expect((await missions.get(companyId, missionId)).status).toBe("draft");
  });

  it("limite le contrat aux six types officiels et refuse mission.created", async () => {
    const missionId = await publishedMission("Contrat strict");
    const valid = emitted.find(
      (event) =>
        event.event_type === "mission.published" &&
        event.data.mission_id === missionId,
    );
    expect(businessEventSchema.safeParse(valid).success).toBe(true);
    for (const event_type of [
      "mission.created",
      "candidate.created",
      "candidate.accepted",
      "candidate.refused",
      "candidate.rejected",
    ])
      expect(
        businessEventSchema.safeParse({
          ...valid,
          event_type,
        }).success,
      ).toBe(false);
  });
});
