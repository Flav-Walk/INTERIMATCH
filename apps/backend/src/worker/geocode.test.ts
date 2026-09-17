import { describe, it, expect, vi, afterEach } from "vitest";
import { createAddressGeocoder, readCoordinates } from "./geocode.js";

const feature = (coordinates: unknown) => ({
  features: [{ geometry: { coordinates } }],
});

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe("lecture de la réponse GeoJSON", () => {
  it("lit les coordonnées dans l'ordre longitude puis latitude", () => {
    // La BAN renvoie [longitude, latitude] : inverser donnerait un point au Yémen.
    expect(readCoordinates(feature([4.85, 45.75]))).toEqual({
      latitude: 45.75,
      longitude: 4.85,
    });
  });

  it.each([
    ["réponse vide", { features: [] }],
    ["charge inattendue", { ok: true }],
    ["valeur nulle", null],
    ["coordonnées incomplètes", feature([4.85])],
    ["coordonnées non numériques", feature(["4.85", "45.75"])],
    ["latitude hors bornes", feature([4.85, 120])],
    ["longitude hors bornes", feature([200, 45.75])],
  ])("renvoie null pour une %s", (_label, payload) => {
    expect(readCoordinates(payload)).toBeNull();
  });
});

describe("géocodeur Base Adresse Nationale", () => {
  it("interroge le service avec la ville et le code postal", async () => {
    respond(feature([4.85, 45.75]));
    const geocode = createAddressGeocoder("https://geo.test/search/");
    expect(await geocode("Lyon", "69002")).toEqual({
      latitude: 45.75,
      longitude: 4.85,
    });
    const url = new URL(
      String(
        (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock
          .calls[0][0],
      ),
    );
    expect(url.searchParams.get("q")).toBe("Lyon");
    expect(url.searchParams.get("postcode")).toBe("69002");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("renonce silencieusement quand le service est en panne", async () => {
    // Une indisponibilité ne doit jamais empêcher d'enregistrer un profil.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    expect(
      await createAddressGeocoder("https://geo.test/search/")("Lyon", "69002"),
    ).toBeNull();
  });

  it("renonce quand le service répond en erreur", async () => {
    respond({ error: "oops" }, 503);
    expect(
      await createAddressGeocoder("https://geo.test/search/")("Lyon", "69002"),
    ).toBeNull();
  });

  it("renonce quand la commune est introuvable", async () => {
    respond({ features: [] });
    expect(
      await createAddressGeocoder("https://geo.test/search/")("Zzz", "00000"),
    ).toBeNull();
  });
});
