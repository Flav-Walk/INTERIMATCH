import { describe, it, expect, vi, afterEach } from "vitest";
import {
  listPublicOffers,
  getPublicOffer,
  safeExternalUrl,
} from "./publicOffers";

afterEach(() => vi.unstubAllGlobals());

describe("publicOffers service", () => {
  it("appelle /public-job-offers sans paramètres quand les filtres sont vides", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          offers: [],
          total: 0,
          page: 1,
          limit: 20,
          total_pages: 1,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mock);

    const res = await listPublicOffers();
    expect(res.offers).toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("/public-job-offers");
    expect(url).not.toContain("?");
  });

  it("construit correctement la query string avec tous les filtres", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          offers: [],
          total: 0,
          page: 2,
          limit: 10,
          total_pages: 1,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mock);

    await listPublicOffers({
      search: "barman",
      rome: "G1801",
      location: "69002",
      contract_type: "MIS",
      page: 2,
      limit: 10,
    });

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("search=barman");
    expect(url).toContain("rome=G1801");
    expect(url).toContain("location=69002");
    expect(url).toContain("contract_type=MIS");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });

  it("appelle /public-job-offers/:id avec l'identifiant encodé", async () => {
    const mockOffer = {
      id: "uuid-123",
      source: "france_travail",
      external_id: "5968295",
      title: "Maître d'hôtel",
    };
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockOffer), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mock);

    const res = await getPublicOffer("5968295");
    expect(res.id).toBe("uuid-123");
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain("/public-job-offers/5968295");
  });

  it("n'expose comme liens que les URLs HTTP(S)", () => {
    expect(safeExternalUrl("https://example.test/offre avec espace")).toBe(
      "https://example.test/offre%20avec%20espace",
    );
    expect(safeExternalUrl("http://example.test/offre")).toBe(
      "http://example.test/offre",
    );
    for (const unsafe of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.test/offre",
      "not a url",
    ])
      expect(safeExternalUrl(unsafe)).toBeNull();
  });
});
