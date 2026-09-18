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
let workerSequence = 0;

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
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    ...futureSlot(),
    ...over,
  });

async function newWorker() {
  workerSequence += 1;
  return (
    await db.query<{ id: string }>(
      "INSERT INTO profiles(email,role) VALUES($1,'worker') RETURNING id",
      [`domain-event-worker-${workerSequence}@example.test`],
    )
  ).rows[0].id;
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
}, 30_000);

beforeEach(() => {
  emitted.length = 0;
});

afterAll(() => pg.close());

describe("événements métier missions et candidatures", () => {
  it("publie mission.published une fois seulement après draft → open", async () => {
    const missionId = await missions.create(
      companyId,
      draft("Publication événementielle"),
    );
    expect(emitted).toEqual([]);

    await missions.publish(companyId, missionId);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "mission.published",
      schema_version: "1.0",
      data: { mission_id: missionId },
    });
    expect(emitted[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(Object.keys(emitted[0].data)).toEqual(["mission_id"]);

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
      data: { application_id: application.id },
    });
    expect(Object.keys(emitted[0].data)).toEqual(["application_id"]);

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

    await applications.decide(companyId, missionId, application.id, "accepted");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.accepted",
      schema_version: "1.0",
      data: { application_id: application.id },
    });
    expect(Object.keys(emitted[0].data)).toEqual(["application_id"]);

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

    await applications.decide(companyId, missionId, application.id, "rejected");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      event_type: "application.rejected",
      schema_version: "1.0",
      data: { application_id: application.id },
    });
    expect(Object.keys(emitted[0].data)).toEqual(["application_id"]);

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

  it("limite le contrat aux six types officiels et refuse mission.created", () => {
    for (const event_type of [
      "worker.profile.updated",
      "worker.onboarding.completed",
      "mission.published",
      "application.created",
      "application.accepted",
      "application.rejected",
    ])
      expect(
        businessEventSchema.safeParse({
          event_id: crypto.randomUUID(),
          event_type,
          occurred_at: new Date().toISOString(),
          schema_version: "1.0",
          idempotency_key: `${event_type}:test`,
          data: {},
        }).success,
      ).toBe(true);

    for (const event_type of [
      "mission.created",
      "candidate.created",
      "candidate.accepted",
      "candidate.refused",
      "candidate.rejected",
    ])
      expect(
        businessEventSchema.safeParse({
          event_id: crypto.randomUUID(),
          event_type,
          occurred_at: new Date().toISOString(),
          schema_version: "1.0",
          idempotency_key: `${event_type}:test`,
          data: {},
        }).success,
      ).toBe(false);
  });
});
