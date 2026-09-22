import { describe, expect, it, vi } from "vitest";
import { N8nWebhookDelivery } from "../events/dispatcher.js";
import {
  N8nContractNotificationSender,
  type ContractNotification,
} from "./notification.js";

const notification: ContractNotification = {
  deliveryId: "70000000-0000-4000-8000-000000000007",
  occurredAt: "2026-09-21T12:00:00.000Z",
  eventType: "contract.available",
  data: {
    delivery_id: "70000000-0000-4000-8000-000000000007",
    contract: {
      id: "60000000-0000-4000-8000-000000000006",
      status: "awaiting_worker_signature",
      document_version: 1,
    },
    mission: {
      id: "30000000-0000-4000-8000-000000000003",
      title: "Service du soir",
      starts_at: "2027-01-02T17:00:00.000Z",
      ends_at: "2027-01-02T23:00:00.000Z",
      address: "10 rue Exemple",
      city: "Lyon",
      postal_code: "69002",
    },
    worker: { first_name: "Camille", email: "camille@example.test" },
    company: { name: "Bistrot Exemple" },
    links: {
      document:
        "https://interimatch.example/worker/documents/60000000-0000-4000-8000-000000000006",
    },
  },
};

const logger = { info: vi.fn(), error: vi.fn() };
const response = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("notifications contractuelles n8n", () => {
  it("accepte une réponse duplicate sans changer l'identité de livraison", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(200, {
        status: "duplicate",
        event_id: notification.deliveryId,
      }),
    );
    const sender = new N8nContractNotificationSender(
      new N8nWebhookDelivery(
        "https://n8n.test/webhook",
        "test-secret",
        logger,
        fetchMock as typeof fetch,
        async () => undefined,
      ),
    );

    await expect(sender.send(notification)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
    const event = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(event).toMatchObject({
      event_id: notification.deliveryId,
      idempotency_key: `contract.available:${notification.deliveryId}`,
    });
  });

  it.each([
    [400, "N8N_INVALID_PAYLOAD"],
    [401, "N8N_INVALID_SIGNATURE"],
  ])(
    "classe un HTTP %i comme erreur permanente sans retry immédiat",
    async (status, code) => {
      const fetchMock = vi.fn().mockResolvedValue(response(status, {}));
      const sender = new N8nContractNotificationSender(
        new N8nWebhookDelivery(
          "https://n8n.test/webhook",
          "test-secret",
          logger,
          fetchMock as typeof fetch,
          async () => undefined,
        ),
      );

      await expect(sender.send(notification)).rejects.toMatchObject({ code });

      expect(fetchMock).toHaveBeenCalledOnce();
      const event = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(event).toMatchObject({
        event_id: notification.deliveryId,
        idempotency_key: `contract.available:${notification.deliveryId}`,
      });
    },
  );

  it("reprend après correction une livraison refusée avec la même identité", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(400, {}))
      .mockResolvedValueOnce(response(200, { status: "accepted" }));
    const sender = new N8nContractNotificationSender(
      new N8nWebhookDelivery(
        "https://n8n.test/webhook",
        "test-secret",
        logger,
        fetchMock as typeof fetch,
        async () => undefined,
      ),
    );

    await expect(sender.send(notification)).rejects.toMatchObject({
      code: "N8N_INVALID_PAYLOAD",
    });
    await expect(sender.send(notification)).resolves.toBeUndefined();

    const events = fetchMock.mock.calls.map((call) =>
      JSON.parse(String(call[1]?.body)),
    );
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.event_id))).toEqual(
      new Set([notification.deliveryId]),
    );
    expect(new Set(events.map((event) => event.idempotency_key))).toEqual(
      new Set([`contract.available:${notification.deliveryId}`]),
    );
  });

  it("réessaie un 5xx avec la même identité puis accepte la livraison", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(200, { status: "accepted" }));
    const sender = new N8nContractNotificationSender(
      new N8nWebhookDelivery(
        "https://n8n.test/webhook",
        "test-secret",
        logger,
        fetchMock as typeof fetch,
        async () => undefined,
      ),
    );

    await sender.send(notification);

    const events = fetchMock.mock.calls.map((call) =>
      JSON.parse(String(call[1]?.body)),
    );
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.event_id)).size).toBe(1);
    expect(events[0]).toMatchObject({
      event_id: notification.deliveryId,
      event_type: "contract.available",
      occurred_at: notification.occurredAt,
      idempotency_key: `contract.available:${notification.deliveryId}`,
      data: notification.data,
    });
  });

  it("classe un timeout épuisé comme indisponibilité n8n", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const sender = new N8nContractNotificationSender(
      new N8nWebhookDelivery(
        "https://n8n.test/webhook",
        "test-secret",
        logger,
        fetchMock as typeof fetch,
        async () => undefined,
      ),
    );

    await expect(sender.send(notification)).rejects.toMatchObject({
      code: "N8N_UNAVAILABLE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchMock.mock.calls as unknown as [
      RequestInfo | URL,
      RequestInit,
    ][];
    expect(
      new Set(calls.map((call) => String(call[1]?.body))).size,
    ).toBe(1);
  });
});
