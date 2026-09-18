import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createBusinessEvent } from "./business-event.js";
import {
  N8nWebhookDelivery,
  PermanentWebhookError,
  type EventLogger,
} from "./dispatcher.js";

const secret = "test-secret-never-used-outside-tests";
const workerId = "20000000-0000-4000-8000-000000000002";
const event = () =>
  createBusinessEvent(
    "worker.profile.updated",
    { worker_id: workerId },
    {
      eventId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      now: new Date("2026-09-18T07:30:00.000Z"),
    },
  );
const logger = () => ({
  info: vi.fn<EventLogger["info"]>(),
  error: vi.fn<EventLogger["error"]>(),
});
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("N8nWebhookDelivery", () => {
  it.each(["accepted", "duplicate"] as const)(
    "considère %s comme un succès",
    async (status) => {
      const fetchMock = vi.fn(async () => json({ status }));
      const result = await new N8nWebhookDelivery(
        "https://n8n.test/webhook",
        secret,
        logger(),
        fetchMock as typeof fetch,
      ).deliver(event());
      expect(result.status).toBe(status);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("signe exactement le body envoyé et pose tous les headers", async () => {
    const fetchMock = vi.fn(async () => json({ status: "accepted" }));
    await new N8nWebhookDelivery(
      "https://n8n.test/webhook",
      secret,
      logger(),
      fetchMock as typeof fetch,
      async () => undefined,
      () => 1_789_710_600_000,
    ).deliver(event());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = init.body as string;
    const timestamp = "1789710600";
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    expect(url).toBe("https://n8n.test/webhook");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-interimatch-timestamp": timestamp,
      "x-interimatch-signature": `sha256=${expected}`,
      "x-correlation-id": event().event_id,
    });
    expect(JSON.parse(body)).toEqual(event());
  });

  it.each([
    [400, "invalid_payload"],
    [401, "invalid_signature"],
  ] as const)(
    "classe %i comme permanent sans retry",
    async (status, category) => {
      const fetchMock = vi.fn(async () => json({ error: category }, status));
      await expect(
        new N8nWebhookDelivery(
          "https://n8n.test/webhook",
          secret,
          logger(),
          fetchMock as typeof fetch,
        ).deliver(event()),
      ).rejects.toMatchObject<Partial<PermanentWebhookError>>({ category });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("réessaie les 5xx avec le même événement et le même body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ status: "accepted" }));
    const waits: number[] = [];
    await new N8nWebhookDelivery(
      "https://n8n.test/webhook",
      secret,
      logger(),
      fetchMock as typeof fetch,
      async (ms) => {
        waits.push(ms);
      },
    ).deliver(event());
    expect(waits).toEqual([1_000, 5_000]);
    const bodies = fetchMock.mock.calls.map((call) => call[1]?.body);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] as string).event_id).toBe(event().event_id);
  });

  it("réessaie une erreur réseau et ne journalise jamais le secret", async () => {
    const log = logger();
    const failure = Object.assign(new Error("network unavailable"), {
      code: "ECONNRESET",
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(json({ status: "accepted" }));
    await new N8nWebhookDelivery(
      "https://n8n.test/webhook",
      secret,
      log,
      fetchMock as typeof fetch,
      async () => undefined,
    ).deliver(event());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.stringify([log.info.mock.calls, log.error.mock.calls]),
    ).not.toContain(secret);
  });
});
