import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  businessEventSchema,
  createBusinessEvent,
  type BusinessEventType,
} from "./business-event.js";

const ids = {
  application: "10000000-0000-4000-8000-000000000001",
  worker: "20000000-0000-4000-8000-000000000002",
  mission: "30000000-0000-4000-8000-000000000003",
  company: "40000000-0000-4000-8000-000000000004",
  skill: "50000000-0000-4000-8000-000000000005",
  contract: "60000000-0000-4000-8000-000000000006",
  delivery: "70000000-0000-4000-8000-000000000007",
};
const worker = {
  id: ids.worker,
  first_name: "Camille",
  last_name: "Martin",
  email: "camille@example.test",
  main_job: "serveur",
  city: "Lyon",
};
const company = {
  id: ids.company,
  email: "contact@example.test",
  legal_name: "Bistrot Exemple SAS",
  establishment_name: "Bistrot Exemple",
  sector: "restaurant",
  phone: "+33400000000",
};
const mission = {
  id: ids.mission,
  title: "Service du soir",
  description: "Renfort en salle.",
  status: "open",
  starts_at: "2027-01-02T17:00:00.000Z",
  ends_at: "2027-01-02T23:00:00.000Z",
  address: "10 rue Exemple",
  city: "Lyon",
  postal_code: "69002",
  job: "serveur",
  headcount: 2,
  pay_amount: "15.50",
  pay_unit: "hour",
  published_at: "2026-09-18T07:30:00.000Z",
  skills: [{ id: ids.skill, name: "Service en salle", required: true }],
};
const application = (status: "pending" | "accepted" | "rejected") => ({
  id: ids.application,
  status,
  created_at: "2026-09-18T07:30:00.000Z",
  updated_at: "2026-09-18T08:00:00.000Z",
});
const dataByType: Record<BusinessEventType, Record<string, unknown>> = {
  "worker.profile.updated": { worker_id: ids.worker },
  "worker.onboarding.completed": { worker_id: ids.worker, worker },
  "mission.published": { mission_id: ids.mission, mission, company },
  "mission.cancelled": {
    mission_id: ids.mission,
    // La mission telle qu'elle est APRES la decision : le payload porte l'etat
    // final, jamais celui d'avant.
    mission: { ...mission, status: "cancelled" },
    company,
    applications: [],
  },
  "application.created": {
    application_id: ids.application,
    application: application("pending"),
    worker,
    mission,
    company,
  },
  "application.accepted": {
    application_id: ids.application,
    application: application("accepted"),
    worker,
    mission,
    company,
  },
  "application.rejected": {
    application_id: ids.application,
    application: application("rejected"),
    worker,
    mission,
    company,
  },
  "contract.available": {
    delivery_id: ids.delivery,
    contract: {
      id: ids.contract,
      status: "awaiting_worker_signature",
      document_version: 1,
    },
    mission: {
      id: mission.id,
      title: mission.title,
      starts_at: mission.starts_at,
      ends_at: mission.ends_at,
      address: mission.address,
      city: mission.city,
      postal_code: mission.postal_code,
      job: mission.job,
    },
    worker: {
      id: worker.id,
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
    },
    company: {
      id: company.id,
      name: company.establishment_name,
      legal_name: company.legal_name,
      establishment_name: company.establishment_name,
      email: company.email,
      phone: company.phone,
      address: null,
      city: null,
      postal_code: null,
    },
    links: { document: `https://interimatch.example/worker/documents/${ids.contract}` },
    document: {
      id: ids.contract,
      type: "mission_agreement",
      filename: `interimatch-document-${ids.contract}.pdf`,
      mime_type: "application/pdf",
      download_path: `/api/v1/integrations/n8n/documents/${ids.contract}/deliveries/${ids.delivery}`,
    },
  },
  "contract.worker_signed": {
    delivery_id: ids.delivery,
    contract: {
      id: ids.contract,
      status: "awaiting_company_signature",
      document_version: 1,
    },
    mission: {
      id: mission.id,
      title: mission.title,
      starts_at: mission.starts_at,
      ends_at: mission.ends_at,
      address: mission.address,
      city: mission.city,
      postal_code: mission.postal_code,
      job: mission.job,
    },
    worker: {
      id: worker.id,
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
    },
    company: {
      id: company.id,
      name: company.establishment_name,
      legal_name: company.legal_name,
      establishment_name: company.establishment_name,
      email: company.email,
      phone: company.phone,
      address: null,
      city: null,
      postal_code: null,
    },
    links: { document: `https://interimatch.example/company/documents/${ids.contract}` },
    document: {
      id: ids.contract,
      type: "mission_agreement",
      filename: `interimatch-document-${ids.contract}.pdf`,
      mime_type: "application/pdf",
      download_path: `/api/v1/integrations/n8n/documents/${ids.contract}/deliveries/${ids.delivery}`,
    },
  },
  "contract.completed": {
    delivery_id: ids.delivery,
    contract: {
      id: ids.contract,
      status: "completed",
      document_version: 1,
    },
    mission: {
      id: mission.id,
      title: mission.title,
      starts_at: mission.starts_at,
      ends_at: mission.ends_at,
      address: mission.address,
      city: mission.city,
      postal_code: mission.postal_code,
      job: mission.job,
    },
    recipient: {
      role: "worker",
      name: `${worker.first_name} ${worker.last_name}`,
      email: worker.email,
    },
    worker: {
      id: worker.id,
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
    },
    company: {
      id: company.id,
      name: company.establishment_name,
      legal_name: company.legal_name,
      establishment_name: company.establishment_name,
      email: company.email,
      phone: company.phone,
      address: null,
      city: null,
      postal_code: null,
    },
    links: { document: `https://interimatch.example/worker/documents/${ids.contract}` },
    document: {
      id: ids.contract,
      type: "mission_agreement",
      filename: `interimatch-document-${ids.contract}.pdf`,
      mime_type: "application/pdf",
      download_path: `/api/v1/integrations/n8n/documents/${ids.contract}/deliveries/${ids.delivery}`,
    },
  },
};
const envelope = {
  event_id: randomUUID(),
  event_type: "mission.published" as const,
  occurred_at: "2026-09-18T07:30:00.000Z",
  schema_version: "1.0" as const,
  idempotency_key: "mission.published:test",
  data: dataByType["mission.published"],
};

describe("business event envelope", () => {
  it("accepte une enveloppe enrichie complète et versionnée", () => {
    expect(businessEventSchema.parse(envelope).event_type).toBe(
      "mission.published",
    );
  });

  it("exige la clé d'idempotence et conserve la version 1.0", () => {
    expect(
      businessEventSchema.safeParse({ ...envelope, idempotency_key: "" })
        .success,
    ).toBe(false);
    expect(
      businessEventSchema.safeParse({ ...envelope, schema_version: "2.0" })
        .success,
    ).toBe(false);
  });

  it("valide le payload exact des événements officiels", () => {
    for (const event_type of Object.keys(dataByType) as BusinessEventType[])
      expect(
        businessEventSchema.safeParse({
          ...envelope,
          event_type,
          data: dataByType[event_type],
        }).success,
      ).toBe(true);
  });

  it("refuse les types et champs non déclarés, notamment les données d'authentification", () => {
    expect(
      businessEventSchema.safeParse({
        ...envelope,
        event_type: "mission.created",
      }).success,
    ).toBe(false);
    expect(
      businessEventSchema.safeParse({ ...envelope, extra: true }).success,
    ).toBe(false);
    expect(
      businessEventSchema.safeParse({
        ...envelope,
        event_type: "worker.onboarding.completed",
        data: {
          worker_id: ids.worker,
          worker: { ...worker, password_hash: "forbidden" },
        },
      }).success,
    ).toBe(false);
  });

  it("accepte les champs métier optionnels à null", () => {
    expect(
      businessEventSchema.safeParse({
        ...envelope,
        data: {
          mission_id: ids.mission,
          mission: {
            ...mission,
            pay_amount: null,
            pay_unit: null,
          },
          company: {
            ...company,
            legal_name: null,
            establishment_name: null,
            sector: null,
            phone: null,
          },
        },
      }).success,
    ).toBe(true);
  });

  it("génère un UUID v4 et une enveloppe stable et sérialisable", () => {
    const event = createBusinessEvent(
      "worker.profile.updated",
      { worker_id: ids.worker },
      { now: new Date("2026-09-18T07:30:00.000Z") },
    );
    expect(event.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(event).toMatchObject({
      event_type: "worker.profile.updated",
      occurred_at: "2026-09-18T07:30:00.000Z",
      schema_version: "1.0",
      data: { worker_id: ids.worker },
    });
    expect(event.idempotency_key).toContain(ids.worker);
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });
});
