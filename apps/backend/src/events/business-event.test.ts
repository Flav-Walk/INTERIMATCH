import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { businessEventSchema, createBusinessEvent } from "./business-event.js";
// The envelope is the contract handed to the n8n developer: it must stay strict.
const envelope = {
  event_id: randomUUID(),
  event_type: "candidate.matched" as const,
  occurred_at: "2027-01-02T12:00:00Z",
  schema_version: "1.0" as const,
  idempotency_key: "mission-1:candidate-1",
  data: { mission_id: "mission-1" },
};
describe("business event envelope", () => {
  it("accepts a complete versioned envelope", () => {
    expect(businessEventSchema.parse(envelope).event_type).toBe(
      "candidate.matched",
    );
  });
  it("requires an idempotency key so a retried workflow cannot duplicate work", () => {
    expect(
      businessEventSchema.safeParse({ ...envelope, idempotency_key: "" })
        .success,
    ).toBe(false);
  });
  it("pins the schema version", () => {
    expect(
      businessEventSchema.safeParse({ ...envelope, schema_version: "2.0" })
        .success,
    ).toBe(false);
  });
  it("accepte les événements du profil intérimaire", () => {
    // Les deux seuls types dont la source métier existe aujourd'hui.
    for (const event_type of [
      "worker.profile.updated",
      "worker.onboarding.completed",
    ] as const)
      expect(
        businessEventSchema.parse({ ...envelope, event_type }).event_type,
      ).toBe(event_type);
  });
  it("refuses an unknown event type and undeclared fields", () => {
    expect(
      businessEventSchema.safeParse({ ...envelope, event_type: "mission.sold" })
        .success,
    ).toBe(false);
    expect(
      businessEventSchema.safeParse({ ...envelope, extra: true }).success,
    ).toBe(false);
  });
  it("génère un UUID v4 et une enveloppe stable et sérialisable", () => {
    const event = createBusinessEvent(
      "worker.profile.updated",
      { worker_id: "worker-1" },
      { now: new Date("2026-09-18T07:30:00.000Z") },
    );
    expect(event.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(event).toMatchObject({
      event_type: "worker.profile.updated",
      occurred_at: "2026-09-18T07:30:00.000Z",
      schema_version: "1.0",
      data: { worker_id: "worker-1" },
    });
    expect(event.idempotency_key).toContain(event.event_id);
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });
});
