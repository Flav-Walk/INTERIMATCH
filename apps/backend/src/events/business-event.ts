import { randomUUID } from "node:crypto";
import { z } from "zod";

export const businessEventTypes = [
  "worker.profile.updated",
  "worker.onboarding.completed",
  "mission.published",
  "mission.cancelled",
  "application.created",
  "application.accepted",
  "application.rejected",
] as const;

const workerSchema = z
  .object({
    id: z.uuid(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.email(),
    main_job: z.string().nullable(),
    city: z.string().nullable(),
  })
  .strict();

const companySchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    legal_name: z.string().nullable(),
    establishment_name: z.string().nullable(),
    sector: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .strict();

const missionSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string(),
    status: z.enum(["draft", "open", "filled", "completed", "cancelled"]),
    starts_at: z.iso.datetime(),
    ends_at: z.iso.datetime(),
    address: z.string(),
    city: z.string(),
    postal_code: z.string(),
    job: z.string(),
    headcount: z.number().int().positive(),
    pay_amount: z.string().nullable(),
    pay_unit: z.string().nullable(),
    published_at: z.iso.datetime().nullable(),
    skills: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          required: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

const applicationDataSchema = (status: "pending" | "accepted" | "rejected") =>
  z
    .object({
      application_id: z.uuid(),
      application: z
        .object({
          id: z.uuid(),
          status: z.literal(status),
          created_at: z.iso.datetime(),
          updated_at: z.iso.datetime(),
        })
        .strict(),
      worker: workerSchema,
      mission: missionSchema,
      company: companySchema,
    })
    .strict();

const envelope = {
  event_id: z.uuid(),
  occurred_at: z.iso.datetime(),
  schema_version: z.literal("1.0"),
  idempotency_key: z.string().min(1),
};

export const businessEventSchema = z.discriminatedUnion("event_type", [
  z
    .object({
      ...envelope,
      event_type: z.literal("worker.profile.updated"),
      data: z.object({ worker_id: z.uuid() }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      event_type: z.literal("worker.onboarding.completed"),
      data: z.object({ worker_id: z.uuid(), worker: workerSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      event_type: z.literal("mission.published"),
      data: z
        .object({
          mission_id: z.uuid(),
          mission: missionSchema,
          company: companySchema,
        })
        .strict(),
    })
    .strict(),
  /**
   * Annulation d'une mission publiée.
   *
   * Même forme que `mission.published`, volontairement : c'est la même mission,
   * au même format, et n8n peut réutiliser tel quel ce qu'il sait déjà en lire.
   * Le payload porte donc `status: "cancelled"` — la mission telle qu'elle est
   * APRÈS la décision, relue dans la transaction qui l'a écrite.
   *
   * Ce que le backend ne fait pas : décider qui prévenir. Les candidatures ne
   * sont pas jointes à l'événement — les lister ici figerait dans un payload une
   * question qui appartient à l'automatisation, et n8n dispose de
   * `mission_id` pour interroger ce dont il a besoin.
   */
  z
    .object({
      ...envelope,
      event_type: z.literal("mission.cancelled"),
      data: z
        .object({
          mission_id: z.uuid(),
          mission: missionSchema,
          company: companySchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      event_type: z.literal("application.created"),
      data: applicationDataSchema("pending"),
    })
    .strict(),
  z
    .object({
      ...envelope,
      event_type: z.literal("application.accepted"),
      data: applicationDataSchema("accepted"),
    })
    .strict(),
  z
    .object({
      ...envelope,
      event_type: z.literal("application.rejected"),
      data: applicationDataSchema("rejected"),
    })
    .strict(),
]);

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
      `${eventType}:${String(data.worker_id ?? data.mission_id ?? data.application_id ?? eventId)}:${eventId}`,
    data,
  });
}
