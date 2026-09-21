import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSignDocument,
  documentStatus,
  getDocument,
  listDocuments,
  signDocument,
} from "./documents";
import { setAccess } from "./session";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  setAccess(null);
});

describe("documents contractuels", () => {
  it("utilise les routes du rôle connecté sans exposer de chemin de stockage", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ documents: [] }))
      .mockResolvedValueOnce(json({ documents: [] }));
    vi.stubGlobal("fetch", fetchMock);
    setAccess("token-test");

    await listDocuments("worker");
    await listDocuments("company");

    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      /\/workers\/me\/documents$/,
    );
    expect(String(fetchMock.mock.calls[1][0])).toMatch(
      /\/company\/me\/documents$/,
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-test");
  });

  it("encode l'identifiant et n'envoie que l'acceptation explicite", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "doc" }))
      .mockResolvedValueOnce(json({ id: "doc" }));
    vi.stubGlobal("fetch", fetchMock);
    await getDocument("a/b");
    await signDocument("a/b");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/documents\/a%2Fb$/);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ accepted: true }),
    });
  });

  it("rend les libellés et actions selon l'ordre des validations", () => {
    expect(documentStatus("awaiting_worker_signature", "worker")).toBe(
      "À valider",
    );
    expect(documentStatus("awaiting_worker_signature", "company")).toBe(
      "En attente de l’intérimaire",
    );
    expect(documentStatus("awaiting_company_signature", "worker")).toBe(
      "En attente de l’entreprise",
    );
    expect(canSignDocument("awaiting_worker_signature", "worker")).toBe(true);
    expect(canSignDocument("awaiting_worker_signature", "company")).toBe(false);
    expect(canSignDocument("awaiting_company_signature", "company")).toBe(true);
    expect(canSignDocument("completed", "company")).toBe(false);
  });
});
