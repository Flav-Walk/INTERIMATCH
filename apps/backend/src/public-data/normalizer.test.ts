import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { extractRawOffers, normalizeFranceTravailOffer } from "./normalizer.js";
import type { NormalizedPublicJobOffer } from "./types.js";

const FIXTURE_1_PATH = "src/public-data/fixtures/offres_france_travail.json";
const FIXTURE_10_PATH =
  "src/public-data/fixtures/offres_france_travail_10.json";

describe("France Travail normalizer", () => {
  it("extrait correctement l'offre unique de la fixture 1 offre (cas K)", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_1_PATH, "utf8"));
    const list = extractRawOffers(raw);
    expect(list).toHaveLength(1);

    const res = normalizeFranceTravailOffer(list[0]);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.external_id).toBe("5968295");
    expect(res.data.title).toBe("Maître d'hôtel évènementiel (H/F)");
    expect(res.data.rome_code).toBe("G1802");
    expect(res.data.contract_type).toBe("MIS");
    expect(res.data.company_name).toBeNull(); // Entreprise vide (cas A)
    expect(res.data.salary_label).toBeNull(); // Salaire vide (cas B)
    expect(res.data.latitude).toBeNull(); // Coordonnées GPS absentes (cas D)
    expect(res.data.longitude).toBeNull();
    expect(res.data.source_url).toBe(
      "https://candidat.francetravail.fr/offres/recherche/detail/5968295",
    );
  });

  it("extrait et normalise les offres de la fixture 10 offres (cas L)", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_10_PATH, "utf8"));
    const list = extractRawOffers(raw);
    // 12 recherches au total, dont 2 sans résultats (Commis de salle et Employé·e d'étage), donc 10 offres réelles
    expect(list).toHaveLength(10);

    const normalized = list.map((item) => normalizeFranceTravailOffer(item));
    expect(normalized.every((n) => n.success)).toBe(true);

    const offers = normalized
      .filter(
        (n): n is { success: true; data: NormalizedPublicJobOffer } =>
          n.success,
      )
      .map((n) => n.data);

    // Cas G: coordonnées GPS présentes et entreprise renseignée
    const serveur = offers.find((o) => o.external_id === "213HXKM");
    expect(serveur).toBeDefined();
    expect(serveur?.company_name).toBe("RAS 420");
    expect(serveur?.latitude).toBe(45.753267);
    expect(serveur?.longitude).toBe(4.826881);
    expect(serveur?.salary_label).toBe("Horaire de 12.31 Euros sur 12 mois");
    expect(serveur?.skills.length).toBeGreaterThan(0);
    expect(serveur?.professional_qualities.length).toBeGreaterThan(0);

    // Cas "Réceptionniste" -> "Réceptionnaire automobile"
    const reception = offers.find((o) => o.external_id === "6762593");
    expect(reception).toBeDefined();
    expect(reception?.title).toBe("Réceptionnaire automobile H/F");
    expect(reception?.rome_code).toBe("G1703");
    expect(reception?.rome_label).toBe("Réceptionniste");
  });

  it("gère les recherches à 0 résultat (cas I)", () => {
    const payload = {
      recherches: [
        { intitule_recherche: "Commis de salle", nombre_offres: 0, offres: [] },
        {
          intitule_recherche: "Employé·e d'étage",
          nombre_offres: 0,
          offres: [],
        },
      ],
    };
    const list = extractRawOffers(payload);
    expect(list).toEqual([]);
  });

  it("rejette proprement une offre sans external_id (cas O)", () => {
    const res = normalizeFranceTravailOffer({
      intitule: "Serveur",
      description: "Service en salle",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Identifiant externe manquant");
    }
  });

  it("rejette proprement une offre sans intitulé", () => {
    const res = normalizeFranceTravailOffer({
      id: "12345",
      description: "Service en salle",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Intitulé manquant");
    }
  });

  it("supporte les structures racines alternatives (resultats, offres, tableau)", () => {
    expect(extractRawOffers([{ id: "1", intitule: "A" }])).toHaveLength(1);
    expect(
      extractRawOffers({ resultats: [{ id: "2", intitule: "B" }] }),
    ).toHaveLength(1);
    expect(
      extractRawOffers({ offres: [{ id: "3", intitule: "C" }] }),
    ).toHaveLength(1);
    expect(extractRawOffers({ id: "4", intitule: "D" })).toHaveLength(1);
    expect(extractRawOffers({ recherches: [] })).toEqual([]);
    expect(extractRawOffers({ resultats: [] })).toEqual([]);
    expect(extractRawOffers([])).toEqual([]);
  });

  it.each([
    null,
    "invalid string",
    42,
    {},
    { recherches: "foo" },
    { recherches: [{}] },
    { resultats: {} },
  ])("distingue une structure invalide d'un résultat vide : %j", (payload) => {
    expect(() => extractRawOffers(payload)).toThrow(/Structure|tableau|offres/);
  });

  it("gère les champs inconnus supplémentaires sans planter (cas P)", () => {
    const res = normalizeFranceTravailOffer({
      id: "EXTRA_01",
      intitule: "Poste test",
      inconnu_champ: "valeur aléatoire",
      autre_objet_inconnu: { sub: true },
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.external_id).toBe("EXTRA_01");
    expect(res.data.title).toBe("Poste test");
  });

  it("gère les chaînes très longues et caractères accentués sans altération (cas Q & R)", () => {
    const longDesc =
      "Événement spécialisé avec dégustation de pâtisseries & accueil VIP. ".repeat(
        100,
      );
    const res = normalizeFranceTravailOffer({
      id: "ACCENTS_01",
      intitule: "Maître d'hôtel événementiel — H/F été & hôtellerie",
      description: longDesc,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.title).toBe(
      "Maître d'hôtel événementiel — H/F été & hôtellerie",
    );
    expect(res.data.description).toBe(longDesc.trim());
  });

  it("rejette un identifiant externe dépassant la borne SQL", () => {
    expect(
      normalizeFranceTravailOffer({ id: "X".repeat(201), intitule: "Poste" }),
    ).toMatchObject({
      success: false,
      error: "Identifiant externe trop long",
    });
  });

  it("neutralise les URLs dangereuses dans source_url", () => {
    const dangerous = normalizeFranceTravailOffer({
      id: "XSS_01",
      intitule: "Poste test",
      origineOffre: {
        urlOrigine: "javascript:alert('XSS')",
      },
    });
    expect(dangerous.success).toBe(true);
    if (!dangerous.success) return;
    expect(dangerous.data.source_url).toBeNull();

    const valid = normalizeFranceTravailOffer({
      id: "VALID_01",
      intitule: "Poste test",
      origineOffre: {
        urlOrigine: "https://candidat.francetravail.fr/offres/123",
      },
    });
    expect(valid.success).toBe(true);
    if (!valid.success) return;
    expect(valid.data.source_url).toBe(
      "https://candidat.francetravail.fr/offres/123",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,XSS",
    "ftp://example.test/a",
  ])("neutralise le protocole externe %s", (urlOrigine) => {
    const result = normalizeFranceTravailOffer({
      id: "URL_1",
      intitule: "Poste",
      origineOffre: { urlOrigine },
    });
    expect(result.success && result.data.source_url).toBeNull();
  });

  it("rejette les nombres de postes explicites invalides au lieu d'en inventer un", () => {
    for (const nombrePostes of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const result = normalizeFranceTravailOffer({
        id: `POSTES_${String(nombrePostes)}`,
        intitule: "Poste",
        nombrePostes,
      });
      expect(result).toMatchObject({
        success: false,
        error: "Nombre de postes invalide",
      });
    }
  });

  it("ne conserve jamais une demi-paire de coordonnées", () => {
    const result = normalizeFranceTravailOffer({
      id: "COORDS_1",
      intitule: "Poste",
      lieuTravail: { latitude: 91, longitude: 4.8 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.latitude).toBeNull();
    expect(result.data.longitude).toBeNull();
  });

  it("canonise compétences et qualités pour un checksum indépendant de l'ordre", () => {
    const common = { id: "CHECKSUM_1", intitule: "Poste" };
    const first = normalizeFranceTravailOffer({
      ...common,
      competences: [
        { libelle: "Service", exigence: "S" },
        { libelle: "Accueil", exigence: "E" },
        { libelle: "Service", exigence: "E" },
      ],
      qualitesProfessionnelles: [
        { libelle: "Ponctualité" },
        { libelle: "Équipe" },
      ],
    });
    const reordered = normalizeFranceTravailOffer({
      intitule: "Poste",
      id: "CHECKSUM_1",
      qualitesProfessionnelles: [
        { libelle: "Équipe" },
        { libelle: "Ponctualité" },
      ],
      competences: [
        { libelle: "Accueil", exigence: "E" },
        { libelle: "Service", exigence: "E" },
      ],
      champInconnu: "sans effet",
    });
    expect(first.success && reordered.success).toBe(true);
    if (!first.success || !reordered.success) return;
    expect(first.data.skills).toEqual([
      { name: "Accueil", required: true },
      { name: "Service", required: true },
    ]);
    expect(first.data.raw_checksum).toBe(reordered.data.raw_checksum);
  });

  it("inclut les données affichées et la date d'actualisation dans le checksum", () => {
    const base = { id: "CHECKSUM_2", intitule: "Poste" };
    const checksum = (over: Record<string, unknown>) => {
      const result = normalizeFranceTravailOffer({ ...base, ...over });
      expect(result.success).toBe(true);
      return result.success ? result.data.raw_checksum : "";
    };
    expect(checksum({ description: "A" })).not.toBe(
      checksum({ description: "B" }),
    );
    expect(checksum({ dateActualisation: "2026-01-01T00:00:00Z" })).not.toBe(
      checksum({ dateActualisation: "2026-01-02T00:00:00Z" }),
    );
  });

  it.each([
    ["2026-09-15T09:24:15.317Z", "2026-09-15T09:24:15.317Z"],
    ["2026-09-15T09:24:15Z", "2026-09-15T09:24:15.000Z"],
    ["2024-02-29", "2024-02-29T00:00:00.000Z"],
    ["2024-02-29T09:24:15.317Z", "2024-02-29T09:24:15.317Z"],
    ["2026-02-30", null],
    ["2026-02-30T09:24:15.317Z", null],
    ["2025-02-29", null],
    ["2025-02-29T09:24:15Z", null],
    ["date totalement invalide", null],
    [null, null],
    [undefined, null],
  ])(
    "normalise strictement la date source %j",
    (dateActualisation, expected) => {
      const result = normalizeFranceTravailOffer({
        id: "STRICT_DATE",
        intitule: "Poste",
        dateActualisation,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.updated_at_source).toBe(expected);
    },
  );

  it("calcule le même checksum pour une date impossible et une date absente", () => {
    const invalid = normalizeFranceTravailOffer({
      id: "INVALID_DATE_CHECKSUM",
      intitule: "Poste",
      dateActualisation: "2026-02-30T00:00:00Z",
    });
    const absent = normalizeFranceTravailOffer({
      id: "INVALID_DATE_CHECKSUM",
      intitule: "Poste",
    });
    expect(invalid.success && absent.success).toBe(true);
    if (!invalid.success || !absent.success) return;
    expect(invalid.data.raw_checksum).toBe(absent.data.raw_checksum);
  });
});
