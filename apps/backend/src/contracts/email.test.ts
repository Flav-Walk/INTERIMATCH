import { afterEach, describe, expect, it, vi } from "vitest";
import { BrevoEmailService, escapeEmailHtml } from "./email.js";

afterEach(() => vi.unstubAllGlobals());

describe("BrevoEmailService", () => {
  it("envoie par l'API v3 et ne journalise ni clé, ni destinataire, ni contenu", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const logger = { info: vi.fn(), error: vi.fn() };
    const key = "test-api-key-never-log";
    const service = new BrevoEmailService(
      key,
      { email: "sender@example.test", name: "InteriMatch" },
      logger,
    );
    await service.send({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      to: { email: "worker@example.test", name: "Camille" },
      subject: "Document",
      text: "Texte privé",
      html: "<p>Texte privé</p>",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init?.headers).toMatchObject({ "api-key": key });
    expect(JSON.parse(String(init?.body)).headers).toEqual({
      "Idempotency-Key": "00000000-0000-4000-8000-000000000001",
    });
    const logs = JSON.stringify(logger.info.mock.calls);
    expect(logs).not.toContain(key);
    expect(logs).not.toContain("worker@example.test");
    expect(logs).not.toContain("Texte privé");
  });

  it("neutralise le HTML injecté dans les modèles", () => {
    expect(escapeEmailHtml(`<img src=x onerror="alert(1)">&'`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;",
    );
  });
});
