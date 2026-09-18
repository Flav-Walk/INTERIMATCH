import { describe, expect, it } from "vitest";
import { matchBlockerLines, matchExplanationLines } from "./MatchExplanation";
import type { MatchDimension, MatchResult } from "../../services/missions";

/**
 * Les raisons d'un score, telles que chaque lecteur doit les recevoir.
 *
 * Rien ici ne recalcule le rapprochement : `tone`, `points` et `lost` sont ce
 * que le serveur a renvoyé, et ces tests vérifient uniquement qu'on les
 * formule et qu'on les ordonne fidèlement. C'est la frontière que SL2c pose —
 * le moteur décide, l'interface raconte.
 */

const dimension = (over: Partial<MatchDimension> = {}): MatchDimension => ({
  key: "job",
  label: "Métier",
  weight: 20,
  ratio: 1,
  points: 20,
  tone: "strength",
  lost: 0,
  ...over,
});

const match = (
  dimensions: MatchDimension[],
  over: Partial<MatchResult> = {},
): MatchResult => ({
  compatible: true,
  score: 80,
  blockers: [],
  dimensions,
  distance_km: 12,
  ...over,
});

describe("formulation des raisons", () => {
  it("parle à l’intérimaire de lui-même", () => {
    const [line] = matchExplanationLines(match([dimension()]), "worker");
    expect(line.text).toBe("C’est votre métier principal.");
  });

  it("parle à l’entreprise du candidat", () => {
    const [line] = matchExplanationLines(match([dimension()]), "company");
    expect(line.text).toBe("Le poste correspond à son métier principal.");
  });

  it("n’attribue jamais à l’entreprise ce qui appartient au candidat", () => {
    // La nuance est celle qui compte. « Ce que vous demandez » est juste :
    // l’exigence est bien celle de l’entreprise qui lit. « Votre profil » ou
    // « chez vous » ne le seraient pas — ce sont le profil et le domicile de
    // quelqu’un d’autre, et ces formulations-là trahiraient une reprise de la
    // version destinée à l’intérimaire.
    const lines = matchExplanationLines(
      match([
        dimension(),
        dimension({ key: "desired_skills", ratio: 0.5, tone: "neutral" }),
        dimension({ key: "proximity", ratio: 0.2, tone: "limitation" }),
        dimension({ key: "experience", ratio: 0.3, tone: "limitation" }),
      ]),
      "company",
    );
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line.text).not.toMatch(/votre profil/i);
      expect(line.text).not.toMatch(/chez vous/i);
      expect(line.text).not.toMatch(/votre rayon/i);
      expect(line.text).not.toMatch(/^Vous /);
    }
    // Et le pendant positif : la plupart des lignes parlent bien d’un tiers.
    expect(
      lines.filter((l) => /(^|\s)(son|sa|ses|elle)(\s|’)/i.test(l.text)).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("reprend la qualification du serveur sans la rejouer", () => {
    // Un ratio de 0,5 serait « positif » avec l’ancien seuil local de 0,5.
    // C’est `tone` qui tranche, et il dit neutre.
    const [line] = matchExplanationLines(
      match([dimension({ ratio: 0.5, tone: "neutral", points: 10, lost: 10 })]),
      "company",
    );
    expect(line.tone).toBe("neutral");
  });

  it("tait la proximité quand la distance est inconnue", () => {
    // Inventer « proche » ou « éloigné » affirmerait une géographie que le
    // serveur n’a pas établie.
    const lines = matchExplanationLines(
      match([dimension({ key: "proximity", ratio: 0.8 })], {
        distance_km: null,
      }),
      "company",
    );
    expect(lines).toHaveLength(0);
  });

  it("dit la distance réelle, jamais une distance arrondie à l’envie", () => {
    const [line] = matchExplanationLines(
      match([dimension({ key: "proximity", ratio: 0.8 })], {
        distance_km: 37,
      }),
      "company",
    );
    expect(line.text).toContain("37 km");
  });
});

describe("ordre des raisons", () => {
  it("place les points forts avant les points limitants", () => {
    const lines = matchExplanationLines(
      match([
        dimension({
          key: "experience",
          ratio: 0,
          tone: "limitation",
          points: 0,
          lost: 10,
        }),
        dimension({
          key: "desired_skills",
          ratio: 0.5,
          tone: "neutral",
          points: 22,
          lost: 23,
        }),
        dimension(),
      ]),
      "company",
    );
    expect(lines.map((l) => l.tone)).toEqual([
      "strength",
      "neutral",
      "limitation",
    ]);
  });

  it("montre d’abord le frein qui coûte le plus", () => {
    // L’entreprise doit lire en premier ce qui pèse réellement sur le score,
    // pas la première dimension que le moteur a calculée.
    const lines = matchExplanationLines(
      match([
        dimension({
          key: "experience",
          tone: "limitation",
          ratio: 0,
          points: 0,
          lost: 10,
        }),
        dimension({
          key: "desired_skills",
          tone: "limitation",
          ratio: 0,
          points: 0,
          lost: 45,
        }),
      ]),
      "company",
    );
    expect(lines.map((l) => l.key)).toEqual(["desired_skills", "experience"]);
  });

  it("montre d’abord l’atout qui rapporte le plus", () => {
    const lines = matchExplanationLines(
      match([
        dimension({ key: "experience", points: 10, lost: 0 }),
        dimension({
          key: "desired_skills",
          tone: "strength",
          ratio: 1,
          points: 45,
          lost: 0,
        }),
      ]),
      "company",
    );
    expect(lines.map((l) => l.key)).toEqual(["desired_skills", "experience"]);
  });

  it("supporte une absence totale de dimensions", () => {
    expect(matchExplanationLines(match([]), "company")).toEqual([]);
  });
});

describe("motifs bloquants", () => {
  it("dit à l’entreprise pourquoi un profil est écarté", () => {
    const lines = matchBlockerLines(
      match([], { compatible: false, blockers: ["out_of_range", "engaged"] }),
      "company",
    );
    expect(lines.map((l) => l.text)).toEqual([
      "Le lieu de la mission dépasse le rayon de déplacement qu’elle a déclaré.",
      "Elle a déjà accepté une autre mission sur ce créneau.",
    ]);
  });

  it("dit la même chose à l’intérimaire, à la première personne", () => {
    const lines = matchBlockerLines(
      match([], { compatible: false, blockers: ["engaged"] }),
      "worker",
    );
    expect(lines[0].text).toContain("Vous avez déjà accepté");
  });

  it("couvre tous les motifs que le serveur sait produire", () => {
    // Un motif sans phrase laisserait une ligne vide à l’écran — exactement la
    // panne que « cancelled » a causée côté missions inactives.
    const every = matchBlockerLines(
      match([], {
        compatible: false,
        blockers: [
          "paused",
          "missing_required_skills",
          "unavailable",
          "out_of_range",
          "engaged",
        ],
      }),
      "company",
    );
    expect(every).toHaveLength(5);
    for (const line of every) expect(line.text.length).toBeGreaterThan(10);
  });
});
