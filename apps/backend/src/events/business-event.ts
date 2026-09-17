import { z } from "zod";
export const businessEventSchema = z
  .object({
    event_id: z.uuid(),
    event_type: z.enum([
      // Profil intérimaire : les deux seuls événements dont la source existe
      // réellement aujourd'hui (lot Profil). Aucun émetteur n'est encore branché.
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
    ]),
    occurred_at: z.iso.datetime(),
    schema_version: z.literal("1.0"),
    idempotency_key: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();
export type BusinessEvent = z.infer<typeof businessEventSchema>;
// Envelope only. No dispatcher, persistence or business payload contract yet.
