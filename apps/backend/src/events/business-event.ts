import { randomUUID } from "node:crypto";
import { z } from "zod";

export const businessEventTypes = [
  "worker.profile.updated",
  "worker.onboarding.completed",
  "mission.created",
  "mission.updated",
  "mission.published",
  "matching.completed",
  "candidate.matched",
  "candidate.accepted",
  "candidate.refused",
  "mission.filled",
  "mission.unfilled",
  "mission.completed",
] as const;

export const businessEventSchema = z
  .object({
    event_id: z.uuid(),
    event_type: z.enum(businessEventTypes),
    occurred_at: z.iso.datetime(),
    schema_version: z.literal("1.0"),
    idempotency_key: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

export type BusinessEvent = z.infer<typeof businessEventSchema>;
export type BusinessEventType = BusinessEvent["event_type"];

/** Construit une nouvelle identité logique une seule fois, avant toute livraison. */
export function createBusinessEvent(
  eventType: BusinessEventType,
  data: Record<string, unknown>,
  options: { now?: Date; eventId?: string; idempotencyKey?: string } = {},
): BusinessEvent {
  const eventId = options.eventId ?? randomUUID();
  return businessEventSchema.parse({
    event_id: eventId,
    event_type: eventType,
    occurred_at: (options.now ?? new Date()).toISOString(),
    schema_version: "1.0",
    idempotency_key:
      options.idempotencyKey ??
      `${eventType}:${String(data.worker_id ?? eventId)}:${eventId}`,
    data,
  });
}
