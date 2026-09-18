import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { Db } from "../db.js";
import { createBusinessEvent } from "../events/business-event.js";
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
const publish = vi.fn(
  (
    eventType: Parameters<typeof createBusinessEvent>[0],
    data: Record<string, unknown>,
  ) => createBusinessEvent(eventType, data),
);
const workers = new WorkerService(db, undefined, { publish });
let workerId = "";
let skillId = "";

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));
  workerId = (
    await db.query<{ id: string }>(
      "INSERT INTO profiles(email) VALUES('events@example.test') RETURNING id",
    )
  ).rows[0].id;
  skillId = (
    await db.query<{ id: string }>(
      "SELECT id FROM skills ORDER BY name LIMIT 1",
    )
  ).rows[0].id;
});

afterAll(() => pg.close());

describe("événements métier du profil intérimaire", () => {
  it("publie profile.updated après une modification effective seulement", async () => {
    publish.mockClear();
    await workers.patch(workerId, {
      first_name: "Jimmy",
      last_name: "Martin",
      city: "Lyon",
      postal_code: "69002",
      mobility_radius_km: 15,
      main_job: "serveur",
    });
    expect(publish).toHaveBeenCalledWith("worker.profile.updated", {
      worker_id: workerId,
    });
    publish.mockClear();
    await workers.patch(workerId, { city: "Lyon" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("publie onboarding.completed une seule fois lors de la transition", async () => {
    await workers.setSkills(workerId, [skillId]);
    publish.mockClear();
    const starts = new Date(Date.now() + 86_400_000);
    const created = (await workers.addAvailability(workerId, {
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 3_600_000).toISOString(),
      status: "available",
    })) as { id: string };
    expect(publish.mock.calls.map(([type]) => type)).toEqual([
      "worker.profile.updated",
      "worker.onboarding.completed",
    ]);
    expect(publish).toHaveBeenNthCalledWith(2, "worker.onboarding.completed", {
      worker_id: workerId,
      worker: {
        id: workerId,
        first_name: "Jimmy",
        last_name: "Martin",
        email: "events@example.test",
        main_job: "serveur",
        city: "Lyon",
      },
    });
    publish.mockClear();
    await workers.updateAvailability(workerId, created.id, {
      status: "available",
    });
    expect(publish).not.toHaveBeenCalled();
    await workers.patch(workerId, { years_experience: 2 });
    expect(publish.mock.calls.map(([type]) => type)).toEqual([
      "worker.profile.updated",
    ]);
  });
});
