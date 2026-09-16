import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { businessEventSchema } from "./business-event.js";
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
  it("refuses an unknown event type and undeclared fields", () => {
    expect(
      businessEventSchema.safeParse({ ...envelope, event_type: "mission.sold" })
        .success,
    ).toBe(false);
    expect(
      businessEventSchema.safeParse({ ...envelope, extra: true }).success,
    ).toBe(false);
  });
});
