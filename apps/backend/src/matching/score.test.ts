import { describe, it, expect } from "vitest";
import {
  BANDS,
  WEIGHTS,
  coversMission,
  distanceKm,
  evaluate,
  selectByBands,
  type MissionCriteria,
  type WorkerCriteria,
} from "./score.js";

/**
 * Dates fixes : le rapprochement ne doit dépendre ni de l'heure d'exécution ni
 * du fuseau de la machine. Toutes les plages sont exprimées en UTC.
 */
const T = (day: number, hour: number) =>
  new Date(Date.UTC(2027, 5, day, hour, 0, 0)).toISOString();

const SKILL = {
  salle: "s-salle",
  commande: "s-commande",
  hygiene: "s-hygiene",
};

const mission = (over: Partial<MissionCriteria> = {}): MissionCriteria => ({
  job: "serveur",
  starts_at: T(12, 16),
  ends_at: T(12, 22),
  // Lyon
  latitude: 45.75,
  longitude: 4.85,
  min_years_experience: null,
  required_skill_ids: [],
  desired_skill_ids: [],
  ...over,
});

const worker = (over: Partial<WorkerCriteria> = {}): WorkerCriteria => ({
  main_job: "serveur",
  secondary_jobs: [],
  latitude: 45.75,
  longitude: 4.85,
  mobility_radius_km: 20,
  years_experience: null,
  open_to_missions: true,
  skill_ids: [],
  availabilities: [
    { starts_at: T(12, 8), ends_at: T(13, 2), status: "available" },
  ],
  engagements: [],
  ...over,
});

describe("distance", () => {
  it("annule la distance d'un point à lui-même", () => {
    const lyon = { latitude: 45.75, longitude: 4.85 };
    expect(distanceKm(lyon, lyon)).toBe(0);
  });

  it("retrouve une distance connue entre Lyon et Paris", () => {
    // ~392 km à vol d'oiseau : une marge de 10 km suffit à valider la formule.
    const d = distanceKm(
      { latitude: 45.75, longitude: 4.85 },
      { latitude: 48.8566, longitude: 2.3522 },
    );
    expect(d).toBeGreaterThan(382);
    expect(d).toBeLessThan(402);
  });

  it("est symétrique", () => {
    const a = { latitude: 45.75, longitude: 4.85 };
    const b = { latitude: 43.3, longitude: 5.4 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });
});

describe("couverture des disponibilités", () => {
  const window = { starts_at: T(12, 16), ends_at: T(12, 22) };

  it("accepte un créneau qui englobe la mission", () => {
    expect(
      coversMission(
        [{ starts_at: T(12, 8), ends_at: T(13, 2), status: "available" }],
        window,
      ),
    ).toBe(true);
  });

  it("accepte des créneaux contigus une fois fusionnés", () => {
    expect(
      coversMission(
        [
          { starts_at: T(12, 14), ends_at: T(12, 19), status: "available" },
          { starts_at: T(12, 19), ends_at: T(12, 23), status: "available" },
        ],
        window,
      ),
    ).toBe(true);
  });

  it("refuse une couverture seulement partielle", () => {
    // Un service ne se quitte pas en cours de route.
    expect(
      coversMission(
        [{ starts_at: T(12, 16), ends_at: T(12, 20), status: "available" }],
        window,
      ),
    ).toBe(false);
  });

  it("refuse une absence totale de recouvrement", () => {
    expect(
      coversMission(
        [{ starts_at: T(14, 8), ends_at: T(14, 20), status: "available" }],
        window,
      ),
    ).toBe(false);
  });

  it("refuse quand une indisponibilité déclarée troue le créneau", () => {
    expect(
      coversMission(
        [
          { starts_at: T(12, 8), ends_at: T(13, 2), status: "available" },
          { starts_at: T(12, 18), ends_at: T(12, 19), status: "unavailable" },
        ],
        window,
      ),
    ).toBe(false);
  });

  it("accepte une indisponibilité située hors de la plage de la mission", () => {
    // La coupure ampute le début du créneau, loin de la mission : le morceau
    // restant la couvre toujours, et rien ne doit être bloqué.
    for (const fin of [T(12, 9), T(12, 10)])
      expect(
        coversMission(
          [
            { starts_at: T(12, 8), ends_at: T(13, 2), status: "available" },
            { starts_at: T(12, 8), ends_at: fin, status: "unavailable" },
          ],
          window,
        ),
      ).toBe(true);
  });

  it("refuse un intérimaire sans aucun créneau", () => {
    expect(coversMission([], window)).toBe(false);
  });
});

describe("critères bloquants", () => {
  it("déclare compatible un profil qui satisfait tout", () => {
    const r = evaluate(mission(), worker());
    expect(r.compatible).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("bloque une recherche mise en pause", () => {
    const r = evaluate(mission(), worker({ open_to_missions: false }));
    expect(r.compatible).toBe(false);
    expect(r.blockers).toContain("paused");
  });

  it("bloque une compétence obligatoire manquante", () => {
    const r = evaluate(
      mission({ required_skill_ids: [SKILL.salle, SKILL.commande] }),
      worker({ skill_ids: [SKILL.salle] }),
    );
    expect(r.compatible).toBe(false);
    expect(r.blockers).toContain("missing_required_skills");
  });

  it("accepte quand toutes les compétences obligatoires sont détenues", () => {
    const r = evaluate(
      mission({ required_skill_ids: [SKILL.salle] }),
      worker({ skill_ids: [SKILL.salle, SKILL.hygiene] }),
    );
    expect(r.blockers).not.toContain("missing_required_skills");
  });

  it("bloque une indisponibilité", () => {
    const r = evaluate(
      mission(),
      worker({
        availabilities: [
          { starts_at: T(20, 8), ends_at: T(20, 20), status: "available" },
        ],
      }),
    );
    expect(r.compatible).toBe(false);
    expect(r.blockers).toContain("unavailable");
  });

  it("bloque une mission hors du rayon accepté", () => {
    // Paris pour un intérimaire lyonnais acceptant 20 km.
    const r = evaluate(
      mission({ latitude: 48.8566, longitude: 2.3522 }),
      worker({ mobility_radius_km: 20 }),
    );
    expect(r.compatible).toBe(false);
    expect(r.blockers).toContain("out_of_range");
    expect(r.distance_km).toBeGreaterThan(380);
  });

  it("accepte une mission éloignée si le rayon le permet", () => {
    // Grenoble depuis Lyon : une centaine de kilomètres, soit hors des 20 km
    // par défaut mais bien dans un rayon de 150. Paris, à ~392 km, dépasse le
    // maximum de 250 que le modèle autorise : aucun rayon ne la rend accessible.
    const grenoble = mission({ latitude: 45.1885, longitude: 5.7245 });
    expect(
      evaluate(grenoble, worker({ mobility_radius_km: 20 })).blockers,
    ).toContain("out_of_range");
    expect(
      evaluate(grenoble, worker({ mobility_radius_km: 150 })).blockers,
    ).not.toContain("out_of_range");
  });

  it("cumule les bloqueurs au lieu de s'arrêter au premier", () => {
    const r = evaluate(
      mission({ required_skill_ids: [SKILL.salle] }),
      worker({ open_to_missions: false, skill_ids: [], availabilities: [] }),
    );
    expect(r.blockers.sort()).toEqual([
      "missing_required_skills",
      "paused",
      "unavailable",
    ]);
  });

  it("n'exclut jamais faute de coordonnées, mais le signale", () => {
    // Un géocodage manquant ne prouve pas que la mission est hors zone :
    // la masquer cacherait peut-être une mission toute proche.
    const r = evaluate(mission({ latitude: null, longitude: null }), worker());
    expect(r.blockers).not.toContain("out_of_range");
    expect(r.distance_km).toBeNull();
    expect(r.dimensions.map((d) => d.key)).not.toContain("proximity");
  });

  it("n'exclut pas un intérimaire sans rayon déclaré", () => {
    const r = evaluate(mission(), worker({ mobility_radius_km: null }));
    expect(r.blockers).not.toContain("out_of_range");
  });

  it("ne laisse jamais un score élevé racheter un bloqueur", () => {
    const r = evaluate(
      mission({ desired_skill_ids: [SKILL.salle] }),
      worker({ skill_ids: [SKILL.salle], open_to_missions: false }),
    );
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.compatible).toBe(false);
  });
});

describe("score", () => {
  it("donne 100 au profil idéal sur toutes les dimensions applicables", () => {
    const r = evaluate(
      mission({
        desired_skill_ids: [SKILL.salle, SKILL.commande],
        min_years_experience: 2,
      }),
      worker({
        skill_ids: [SKILL.salle, SKILL.commande],
        years_experience: 5,
        main_job: "serveur",
      }),
    );
    expect(r.score).toBe(100);
    expect(r.compatible).toBe(true);
  });

  it("reste borné entre 0 et 100", () => {
    const worst = evaluate(
      mission({ desired_skill_ids: [SKILL.salle], min_years_experience: 4 }),
      worker({
        main_job: "plongeur",
        skill_ids: [],
        years_experience: 0,
        // Au bord exact du rayon : proximité nulle, sans être hors zone.
        mobility_radius_km: 0,
      }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);

    const best = evaluate(
      mission({ desired_skill_ids: [SKILL.salle], min_years_experience: 1 }),
      worker({ skill_ids: [SKILL.salle], years_experience: 40 }),
    );
    expect(best.score).toBeLessThanOrEqual(100);
    // L'expérience ne dépasse jamais son plafond, même très au-delà du requis.
    expect(best.dimensions.find((d) => d.key === "experience")?.ratio).toBe(1);
  });

  it("note le métier principal au-dessus d'un métier secondaire", () => {
    const principal = evaluate(mission(), worker({ main_job: "serveur" }));
    const secondaire = evaluate(
      mission(),
      worker({ main_job: "plongeur", secondary_jobs: ["serveur"] }),
    );
    const etranger = evaluate(mission(), worker({ main_job: "plongeur" }));
    expect(principal.score).toBeGreaterThan(secondaire.score);
    expect(secondaire.score).toBeGreaterThan(etranger.score);
  });

  it("récompense la couverture des compétences souhaitées", () => {
    const m = mission({
      desired_skill_ids: [SKILL.salle, SKILL.commande, SKILL.hygiene],
    });
    const aucune = evaluate(m, worker({ skill_ids: [] })).score;
    const une = evaluate(m, worker({ skill_ids: [SKILL.salle] })).score;
    const toutes = evaluate(
      m,
      worker({ skill_ids: [SKILL.salle, SKILL.commande, SKILL.hygiene] }),
    ).score;
    expect(aucune).toBeLessThan(une);
    expect(une).toBeLessThan(toutes);
  });

  it("récompense la proximité à l'intérieur du rayon", () => {
    // Deux points lyonnais, l'un plus loin que l'autre.
    const proche = evaluate(mission(), worker({ mobility_radius_km: 50 }));
    const loin = evaluate(
      mission({ latitude: 45.9, longitude: 5.1 }),
      worker({ mobility_radius_km: 50 }),
    );
    expect(proche.score).toBeGreaterThan(loin.score);
    expect(loin.blockers).not.toContain("out_of_range");
  });

  it("écarte du calcul une dimension que rien ne permet de juger", () => {
    // Mission sans compétence souhaitée ni expérience requise : seules le
    // métier et la proximité comptent, et le total reste sur 100.
    const r = evaluate(mission(), worker());
    expect(r.dimensions.map((d) => d.key).sort()).toEqual(["job", "proximity"]);
    expect(r.score).toBe(100);
  });

  it("ne pénalise pas une mission qui ne demande aucune expérience", () => {
    const sansExigence = evaluate(
      mission(),
      worker({ years_experience: null }),
    );
    expect(sansExigence.dimensions.map((d) => d.key)).not.toContain(
      "experience",
    );
    expect(sansExigence.score).toBe(100);
  });

  it("traite une exigence de zéro année comme une absence d'exigence", () => {
    const r = evaluate(mission({ min_years_experience: 0 }), worker());
    expect(r.dimensions.map((d) => d.key)).not.toContain("experience");
  });

  it("compte zéro quand l'expérience est demandée mais inconnue", () => {
    const r = evaluate(
      mission({ min_years_experience: 3 }),
      worker({ years_experience: null }),
    );
    expect(r.dimensions.find((d) => d.key === "experience")?.ratio).toBe(0);
  });

  it("expose une pondération qui totalise exactement 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("donne toujours le même résultat pour les mêmes entrées", () => {
    const m = mission({
      desired_skill_ids: [SKILL.salle],
      min_years_experience: 2,
    });
    const w = worker({ skill_ids: [SKILL.salle], years_experience: 3 });
    const runs = Array.from({ length: 5 }, () => evaluate(m, w).score);
    expect(new Set(runs).size).toBe(1);
  });
});

describe("paliers 70 / 60 / 50", () => {
  const candidate = (score: number, compatible = true) => ({
    id: `c-${score}`,
    score,
    compatible,
  });

  it("expose les paliers du cahier des charges", () => {
    expect(BANDS.map((b) => b.min)).toEqual([70, 60, 50]);
  });

  it("retient d'abord les candidats à 70 et plus", () => {
    const r = selectByBands([candidate(85), candidate(72), candidate(65)]);
    expect(r.band).toBe(70);
    expect(r.results.map((c) => c.id)).toEqual(["c-85", "c-72"]);
  });

  it("élargit à 60 seulement faute de candidat à 70", () => {
    const r = selectByBands([candidate(65), candidate(61), candidate(55)]);
    expect(r.band).toBe(60);
    expect(r.results.map((c) => c.id)).toEqual(["c-65", "c-61"]);
  });

  it("élargit à 50 seulement faute de candidat à 60", () => {
    const r = selectByBands([candidate(58), candidate(51), candidate(40)]);
    expect(r.band).toBe(50);
    expect(r.results.map((c) => c.id)).toEqual(["c-58", "c-51"]);
  });

  it("ne renvoie personne sous 50", () => {
    const r = selectByBands([candidate(49), candidate(10)]);
    expect(r.band).toBeNull();
    expect(r.results).toEqual([]);
  });

  it("ne mélange jamais deux paliers", () => {
    // Un candidat à 85 étant présent, celui à 62 n'apparaît pas.
    const r = selectByBands([candidate(85), candidate(62)]);
    expect(r.results.map((c) => c.id)).toEqual(["c-85"]);
  });

  it("classe du meilleur au moins bon", () => {
    const r = selectByBands([candidate(72), candidate(91), candidate(80)]);
    expect(r.results.map((c) => c.score)).toEqual([91, 80, 72]);
  });

  it("n'élargit jamais jusqu'à réintroduire un candidat incompatible", () => {
    // Le seul candidat à haut score est bloqué : on ne descend pas le repêcher.
    const r = selectByBands([candidate(95, false), candidate(64)]);
    expect(r.band).toBe(60);
    expect(r.results.map((c) => c.id)).toEqual(["c-64"]);
  });

  it("supporte une liste vide", () => {
    expect(selectByBands([])).toEqual({ band: null, label: null, results: [] });
  });
});

/**
 * Engagements déjà acceptés.
 *
 * Une candidature acceptée réserve un intervalle, et rien d'autre. Elle ne
 * retire aucune disponibilité déclarée : l'intérimaire reste proposable avant
 * et après, ce qui est tout l'intérêt de séparer « je suis libre » de « je me
 * suis engagé ».
 *
 * Convention : intervalles semi-ouverts [début, fin), comme en base. Deux
 * missions qui se touchent bout à bout ne se chevauchent donc pas — un service
 * du midi et un service du soir se cumulent, ce qui est le quotidien du métier.
 */
describe("engagements acceptés", () => {
  // La mission de référence court du 12 à 16 h au 12 à 22 h.
  const engagement = (from: string, to: string) => ({
    starts_at: from,
    ends_at: to,
  });
  const blocked = (engagements: { starts_at: string; ends_at: string }[]) =>
    evaluate(mission(), worker({ engagements })).blockers;

  it("laisse passer un intérimaire sans aucun engagement", () => {
    expect(blocked([])).toEqual([]);
  });

  it("exclut un engagement aux mêmes horaires", () => {
    expect(blocked([engagement(T(12, 16), T(12, 22))])).toEqual(["engaged"]);
  });

  it("exclut un chevauchement partiel par la gauche", () => {
    // L'engagement finit après le début de la mission.
    expect(blocked([engagement(T(12, 12), T(12, 18))])).toEqual(["engaged"]);
  });

  it("exclut un chevauchement partiel par la droite", () => {
    expect(blocked([engagement(T(12, 20), T(13, 2))])).toEqual(["engaged"]);
  });

  it("exclut une mission entièrement contenue dans l'engagement", () => {
    expect(blocked([engagement(T(12, 8), T(13, 2))])).toEqual(["engaged"]);
  });

  it("exclut un engagement entièrement contenu dans la mission", () => {
    expect(blocked([engagement(T(12, 18), T(12, 19))])).toEqual(["engaged"]);
  });

  it("exclut un engagement de plusieurs jours recouvrant la mission", () => {
    expect(blocked([engagement(T(10, 6), T(15, 6))])).toEqual(["engaged"]);
  });

  it("accepte un engagement finissant exactement au début de la mission", () => {
    // [8h, 16h) puis [16h, 22h) : aucune minute n'est réclamée deux fois.
    expect(blocked([engagement(T(12, 8), T(12, 16))])).toEqual([]);
  });

  it("accepte un engagement commençant exactement à la fin de la mission", () => {
    expect(blocked([engagement(T(12, 22), T(13, 2))])).toEqual([]);
  });

  it("accepte un engagement qui ne croise pas la mission", () => {
    expect(blocked([engagement(T(10, 16), T(10, 22))])).toEqual([]);
  });

  it("n'exclut que si l'un des engagements chevauche réellement", () => {
    const veille = engagement(T(11, 16), T(11, 22));
    const lendemain = engagement(T(13, 16), T(13, 22));
    expect(blocked([veille, lendemain])).toEqual([]);
    expect(blocked([veille, engagement(T(12, 17), T(12, 18)), lendemain])).toEqual(
      ["engaged"],
    );
  });

  it("laisse les disponibilités déclarées intactes autour de l'engagement", () => {
    // Le scénario validé : une longue disponibilité, un engagement au milieu.
    // Les missions situées avant et après restent proposables ; seule celle qui
    // croise l'engagement disparaît.
    const large = worker({
      availabilities: [
        { starts_at: T(1, 0), ends_at: T(28, 0), status: "available" },
      ],
      engagements: [engagement(T(20, 0), T(22, 0))],
    });
    const before = mission({ starts_at: T(18, 8), ends_at: T(18, 16) });
    const during = mission({ starts_at: T(21, 8), ends_at: T(21, 16) });
    const after = mission({ starts_at: T(23, 8), ends_at: T(23, 16) });

    expect(evaluate(before, large).compatible).toBe(true);
    expect(evaluate(during, large).blockers).toEqual(["engaged"]);
    expect(evaluate(after, large).compatible).toBe(true);
  });

  it("cumule le motif avec les autres sans les remplacer", () => {
    const result = evaluate(
      mission({ required_skill_ids: [SKILL.salle] }),
      worker({
        open_to_missions: false,
        engagements: [engagement(T(12, 16), T(12, 22))],
      }),
    );
    expect(result.compatible).toBe(false);
    expect(new Set(result.blockers)).toEqual(
      new Set(["paused", "missing_required_skills", "engaged"]),
    );
  });

  it("ignore un engagement aux bornes illisibles plutôt que d'exclure à tort", () => {
    // Une date invalide ne doit pas devenir un refus silencieux : on ne peut
    // pas affirmer un chevauchement qu'on est incapable de situer.
    expect(blocked([engagement("pas-une-date", T(12, 22))])).toEqual([]);
  });
});
