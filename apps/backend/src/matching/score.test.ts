import { describe, it, expect } from "vitest";
import {
  BANDS,
  DIMENSION_TONES,
  WEIGHTS,
  bandOf,
  coversMission,
  distanceKm,
  evaluate,
  selectByBands,
  toneOf,
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

  it("reproduit la mission Serveur de Test 2 et exige sa couverture jusqu'à la vraie date de fin", () => {
    const availability = [
      {
        starts_at: "2026-09-18T06:00:00.000Z",
        ends_at: "2026-10-20T08:00:00.000Z",
        status: "available" as const,
      },
    ];
    expect(
      coversMission(availability, {
        starts_at: "2026-09-25T08:00:00.000Z",
        ends_at: "2027-09-25T21:59:00.000Z",
      }),
    ).toBe(false);
    expect(
      coversMission(availability, {
        starts_at: "2026-09-25T08:00:00.000Z",
        ends_at: "2026-09-25T21:59:00.000Z",
      }),
    ).toBe(true);
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

  it("reproduit exactement le profil Test 2 face à Cherche Serveur / Serveuse", () => {
    const required = [
      "accueil",
      "encaissement",
      "mise-en-place",
      "prise-commande",
      "relation-client",
      "service-salle",
    ];
    const result = evaluate(
      mission({
        job: "serveur",
        starts_at: "2026-09-25T08:00:00.000Z",
        ends_at: "2027-09-25T21:59:00.000Z",
        required_skill_ids: required,
        desired_skill_ids: ["hygiene"],
      }),
      worker({
        main_job: "cuisinier",
        secondary_jobs: ["commis_cuisine"],
        years_experience: 6,
        skill_ids: [...required, "hygiene"],
        availabilities: [
          {
            starts_at: "2026-09-18T06:00:00.000Z",
            ends_at: "2026-10-20T08:00:00.000Z",
            status: "available",
          },
        ],
      }),
    );
    expect(result.score).toBe(78);
    expect(result.blockers).toEqual(["unavailable"]);
    expect(result.compatible).toBe(false);
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
    expect(
      blocked([veille, engagement(T(12, 17), T(12, 18)), lendemain]),
    ).toEqual(["engaged"]);
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

/**
 * Hors zone : le profil reste consultable.
 *
 * D04 le dit explicitement — « Hors rayon : outside_zone=true, score
 * localisation 0, profil toujours consultable » — et l entreprise doit pouvoir
 * elargir volontairement. Le drapeau porte cette information sans changer la
 * nature eliminatoire du critere pour l interimaire, qui a fixe son rayon
 * lui-meme et n a pas a recevoir des missions a 300 km.
 */
describe("indicateur hors zone", () => {
  const lyon = { latitude: 45.75, longitude: 4.85 };
  const paris = { latitude: 48.857, longitude: 2.352 };

  it("ne signale rien quand le profil est dans son rayon", () => {
    const result = evaluate(mission(), worker({ mobility_radius_km: 20 }));
    expect(result.outside_zone).toBe(false);
    expect(result.blockers).toEqual([]);
  });

  it("signale le hors zone et le garde bloquant pour l interimaire", () => {
    const result = evaluate(
      mission(lyon),
      worker({ ...paris, mobility_radius_km: 20 }),
    );
    expect(result.outside_zone).toBe(true);
    expect(result.blockers).toEqual(["out_of_range"]);
    // D04 : le sous-score localisation tombe a zero, il ne devient pas negatif.
    const proximity = result.dimensions.find((d) => d.key === "proximity");
    expect(proximity?.ratio).toBe(0);
    expect(proximity?.points).toBe(0);
  });

  it("laisse le hors zone indetermine faute de coordonnees", () => {
    // D04 : « Geolocalisation inconnue : distance et outside_zone inconnus ».
    // Affirmer « dans la zone » serait aussi faux qu affirmer l inverse.
    expect(
      evaluate(mission({ latitude: null, longitude: null }), worker())
        .outside_zone,
    ).toBeNull();
    expect(
      evaluate(mission(), worker({ latitude: null, longitude: null }))
        .outside_zone,
    ).toBeNull();
  });

  it("laisse le hors zone indetermine faute de rayon declare", () => {
    expect(
      evaluate(mission(), worker({ mobility_radius_km: null })).outside_zone,
    ).toBeNull();
  });
});

/**
 * Decompte des competences.
 *
 * Le moteur savait deja si les competences obligatoires etaient toutes
 * detenues ; il ne savait pas le dire. « 2/3 » se raconte, « false » non.
 */
describe("decompte des competences", () => {
  it("compte les obligatoires detenues sur le total exige", () => {
    const result = evaluate(
      mission({
        required_skill_ids: [SKILL.salle, SKILL.commande, SKILL.hygiene],
      }),
      worker({ skill_ids: [SKILL.salle, SKILL.commande] }),
    );
    expect(result.skills.required).toEqual({ held: 2, total: 3 });
    expect(result.blockers).toContain("missing_required_skills");
  });

  it("compte les souhaitees de la meme facon", () => {
    const result = evaluate(
      mission({ desired_skill_ids: [SKILL.salle, SKILL.hygiene] }),
      worker({ skill_ids: [SKILL.salle] }),
    );
    expect(result.skills.desired).toEqual({ held: 1, total: 2 });
  });

  it("renvoie zero sur zero quand rien n est demande", () => {
    const result = evaluate(mission(), worker());
    expect(result.skills).toEqual({
      required: { held: 0, total: 0 },
      desired: { held: 0, total: 0 },
    });
  });

  it("ne compte pas une competence detenue hors du besoin de la mission", () => {
    const result = evaluate(
      mission({ required_skill_ids: [SKILL.salle] }),
      worker({ skill_ids: [SKILL.salle, SKILL.hygiene, SKILL.commande] }),
    );
    expect(result.skills.required).toEqual({ held: 1, total: 1 });
  });
});

/**
 * Paliers : score non arrondi et tri deterministe.
 *
 * D04 : « Tri deterministe par score puis identifiant ; paliers calcules sur le
 * score non arrondi. Affichage arrondi uniquement. » Sans cela, un profil a
 * 69,6 % entre dans le palier « 70 et plus » par la seule grace de l arrondi,
 * et deux profils a egalite se rangent dans l ordre ou la base les a rendus.
 */
describe("paliers : precision et determinisme", () => {
  const at = (id: string, score: number) => ({ id, score, compatible: true });

  it("classe sur le score reel, pas sur son arrondi", () => {
    // 69,6 s affiche « 70 % » mais n atteint pas le palier.
    const selection = selectByBands([at("a", 69.6), at("b", 64)]);
    expect(selection.band).toBe(60);
    expect(selection.results.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("retient le palier superieur des qu il est reellement atteint", () => {
    const selection = selectByBands([at("a", 70), at("b", 64)]);
    expect(selection.band).toBe(70);
    expect(selection.results.map((r) => r.id)).toEqual(["a"]);
  });

  it("departage deux scores egaux par identifiant", () => {
    const selection = selectByBands([at("c", 80), at("a", 80), at("b", 80)]);
    expect(selection.results.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("garde le meme ordre quel que soit l ordre d arrivee", () => {
    const ids = ["x", "y", "z"];
    const forward = selectByBands(ids.map((id) => at(id, 75)));
    const backward = selectByBands([...ids].reverse().map((id) => at(id, 75)));
    expect(backward.results.map((r) => r.id)).toEqual(
      forward.results.map((r) => r.id),
    );
  });
});

/**
 * Qualification des dimensions — ce qui transforme un score en explication.
 *
 * Le score dit combien ; la qualification dit pourquoi. Elle est calculee ici
 * et nulle part ailleurs : une interface qui redeciderait a partir de quel
 * ratio un critere devient un reproche finirait par contredire le score
 * qu elle pretend commenter.
 */
describe("qualification des dimensions", () => {
  const dimension = (result: ReturnType<typeof evaluate>, key: string) =>
    result.dimensions.find((d) => d.key === key)!;

  it("place les frontieres exactement ou elles sont declarees", () => {
    expect(toneOf(DIMENSION_TONES.strength)).toBe("strength");
    expect(toneOf(DIMENSION_TONES.limitation)).toBe("limitation");
  });

  it("laisse neutre ce qui est juste sous le point fort", () => {
    // Une frontiere doit etre franche des deux cotes, sinon elle se deplace au
    // gre des arrondis de celui qui la lit.
    expect(toneOf(DIMENSION_TONES.strength - 0.0001)).toBe("neutral");
    expect(toneOf(DIMENSION_TONES.limitation + 0.0001)).toBe("neutral");
  });

  it("qualifie de point fort un critere pleinement satisfait", () => {
    const result = evaluate(
      mission({ desired_skill_ids: [SKILL.salle, SKILL.commande] }),
      worker({ skill_ids: [SKILL.salle, SKILL.commande] }),
    );
    expect(dimension(result, "desired_skills").tone).toBe("strength");
  });

  it("qualifie de point limitant un critere largement manque", () => {
    const result = evaluate(
      mission({
        desired_skill_ids: [SKILL.salle, SKILL.commande, SKILL.hygiene],
      }),
      worker({ skill_ids: [SKILL.salle] }),
    );
    // Une competence sur trois : 33 %, sous le seuil des 40 %.
    expect(dimension(result, "desired_skills").tone).toBe("limitation");
  });

  it("qualifie de neutre un critere a moitie satisfait", () => {
    const result = evaluate(
      mission({ desired_skill_ids: [SKILL.salle, SKILL.commande] }),
      worker({ skill_ids: [SKILL.salle] }),
    );
    expect(dimension(result, "desired_skills").tone).toBe("neutral");
  });

  it("signale un metier absent du profil comme point limitant", () => {
    const result = evaluate(
      mission({ job: "barman" }),
      worker({ main_job: "serveur" }),
    );
    expect(dimension(result, "job").tone).toBe("limitation");
  });

  it("ne qualifie pas de point fort un metier seulement secondaire", () => {
    // 0,6 : le candidat sait faire, ce n est pas son metier. Ni eloge ni
    // reproche — exactement ce que « neutre » veut dire.
    const result = evaluate(
      mission({ job: "barman" }),
      worker({ main_job: "serveur", secondary_jobs: ["barman"] }),
    );
    expect(dimension(result, "job").tone).toBe("neutral");
  });

  it("chiffre ce que chaque dimension laisse sur la table", () => {
    const result = evaluate(
      mission({ desired_skill_ids: [SKILL.salle, SKILL.commande] }),
      worker({ skill_ids: [SKILL.salle] }),
    );
    const desired = dimension(result, "desired_skills");
    expect(desired.points).toBeCloseTo(WEIGHTS.desired_skills / 2, 10);
    expect(desired.lost).toBeCloseTo(WEIGHTS.desired_skills / 2, 10);
  });

  it("maintient points + lost egal au poids, sur toutes les dimensions", () => {
    // L invariant qui garantit qu une explication ne peut pas mentir sur ce
    // qu un critere a coute : les deux moities couvrent exactement le poids.
    const result = evaluate(
      mission({
        desired_skill_ids: [SKILL.salle, SKILL.commande, SKILL.hygiene],
        min_years_experience: 4,
      }),
      worker({ skill_ids: [SKILL.salle], years_experience: 1 }),
    );
    expect(result.dimensions.length).toBeGreaterThan(0);
    for (const d of result.dimensions)
      expect(d.points + d.lost).toBeCloseTo(d.weight, 10);
  });

  it("n oppose aucun point limitant a un profil ideal", () => {
    const result = evaluate(
      mission({
        desired_skill_ids: [SKILL.salle],
        min_years_experience: 2,
      }),
      worker({ skill_ids: [SKILL.salle], years_experience: 5 }),
    );
    expect(result.score).toBe(100);
    expect(result.dimensions.every((d) => d.tone === "strength")).toBe(true);
  });

  it("accorde toujours la qualification avec le sens du score", () => {
    // Le garde-fou contre l explication mensongere : un point fort ne peut pas
    // sortir d une dimension majoritairement perdue, ni l inverse.
    const cases = [
      evaluate(mission(), worker()),
      evaluate(
        mission({ desired_skill_ids: [SKILL.salle, SKILL.hygiene] }),
        worker({ skill_ids: [SKILL.salle] }),
      ),
      evaluate(
        mission({ job: "barman", min_years_experience: 6 }),
        worker({ years_experience: 1, mobility_radius_km: 400 }),
      ),
    ];
    for (const result of cases)
      for (const d of result.dimensions) {
        if (d.tone === "strength") expect(d.points).toBeGreaterThan(d.lost);
        if (d.tone === "limitation") expect(d.lost).toBeGreaterThan(d.points);
      }
  });

  it("qualifie chaque dimension, sans exception", () => {
    // Une dimension sans qualification laisserait une ligne muette dans
    // l explication : presente dans le score, absente des raisons.
    const result = evaluate(
      mission({ desired_skill_ids: [SKILL.salle], min_years_experience: 3 }),
      worker({ skill_ids: [SKILL.salle], years_experience: 3 }),
    );
    expect(result.dimensions).toHaveLength(4);
    for (const d of result.dimensions)
      expect(["strength", "neutral", "limitation"]).toContain(d.tone);
  });
});

/**
 * Rayon nul : le cas qui faisait mentir le score.
 *
 * Un rayon de zéro kilomètre n'est pas une absence de contrainte, c'est la
 * contrainte la plus stricte : seule la mission sur place convient. Le moteur
 * accordait pourtant la proximité parfaite à tout le monde dès que le rayon
 * valait zéro, au motif que le filtre avait déjà fait son office — alors que le
 * filtre n'écarte personne, il pose un bloqueur.
 */
describe("rayon nul", () => {
  const proximity = (result: ReturnType<typeof evaluate>) =>
    result.dimensions.find((d) => d.key === "proximity");

  it("refuse la proximité à une mission éloignée", () => {
    // Paris vu de Lyon : environ 390 km, avec un rayon de 0.
    const result = evaluate(
      mission({ latitude: 48.85, longitude: 2.35 }),
      worker({ mobility_radius_km: 0 }),
    );
    expect(result.outside_zone).toBe(true);
    expect(result.blockers).toContain("out_of_range");
    // Le point décisif : plus de ratio 1, donc plus de point fort, donc plus
    // de score parfait contredisant son propre bloqueur.
    expect(proximity(result)!.ratio).toBe(0);
    expect(proximity(result)!.tone).toBe("limitation");
    expect(result.score).toBeLessThan(100);
  });

  it("accorde la proximité à une mission sur place", () => {
    // Le pendant qu'il ne fallait pas casser : rayon 0 et distance 0, c'est
    // exactement le cas que ce rayon autorise.
    const result = evaluate(mission(), worker({ mobility_radius_km: 0 }));
    expect(result.distance_km).toBe(0);
    expect(result.outside_zone).toBe(false);
    expect(result.blockers).not.toContain("out_of_range");
    expect(proximity(result)!.ratio).toBe(1);
    expect(proximity(result)!.tone).toBe("strength");
  });

  it("ne laisse jamais un rayon nul produire un score parfait à distance", () => {
    // Le scénario exact rapporté : profil autrement idéal, très loin.
    const result = evaluate(
      mission({
        latitude: 48.85,
        longitude: 2.35,
        desired_skill_ids: [SKILL.salle],
        min_years_experience: 2,
      }),
      worker({
        mobility_radius_km: 0,
        skill_ids: [SKILL.salle],
        years_experience: 10,
      }),
    );
    expect(result.compatible).toBe(false);
    expect(result.score).not.toBe(100);
  });

  it("garde un rayon nul sans coordonnées hors du calcul", () => {
    // Sans distance, la question n'a pas de réponse : ni bloqueur, ni dimension.
    const result = evaluate(
      mission({ latitude: null, longitude: null }),
      worker({ mobility_radius_km: 0 }),
    );
    expect(result.distance_km).toBe(null);
    expect(result.outside_zone).toBe(null);
    expect(result.blockers).not.toContain("out_of_range");
    expect(proximity(result)).toBeUndefined();
  });
});

/**
 * Palier porté par le résultat lui-même.
 *
 * Le score public est arrondi ; le palier ne peut donc pas s'en déduire. Il
 * voyage avec le résultat pour qu'aucune interface n'ait à le reconstituer —
 * et surtout pour qu'aucune ne le reconstitue différemment.
 */
describe("palier porté par le score", () => {
  it("classe sur la valeur réelle, pas sur l arrondi", () => {
    // Le cas exact de la review : 69,6 s affiche « 70 % » et n atteint pas 70.
    expect(Math.round(69.6)).toBe(70);
    expect(bandOf(69.6)).toEqual({ min: 60, label: "Compatibles" });
  });

  it("retient chaque palier dès sa frontière exacte", () => {
    expect(bandOf(70)).toEqual({ min: 70, label: "Très compatibles" });
    expect(bandOf(60)).toEqual({ min: 60, label: "Compatibles" });
    expect(bandOf(50)).toEqual({ min: 50, label: "Envisageables" });
  });

  it("refuse un palier juste sous sa frontière", () => {
    expect(bandOf(69.999)).toEqual({ min: 60, label: "Compatibles" });
    expect(bandOf(59.999)).toEqual({ min: 50, label: "Envisageables" });
    expect(bandOf(49.999)).toBe(null);
  });

  it("n accorde aucun palier sous 50", () => {
    expect(bandOf(0)).toBe(null);
    expect(bandOf(49)).toBe(null);
  });

  it("pose le palier sur le résultat d une évaluation réelle", () => {
    const parfait = evaluate(mission(), worker());
    expect(parfait.score).toBe(100);
    expect(parfait.band).toBe(70);
    expect(parfait.band_label).toBe("Très compatibles");
  });

  it("accorde toujours le palier annoncé avec le score non arrondi", () => {
    // L invariant qui interdit la contradiction : le palier déclaré est
    // exactement celui que `raw_score` atteint, jamais celui de l affichage.
    const cases = [
      evaluate(mission(), worker()),
      evaluate(
        mission({ job: "barman", min_years_experience: 6 }),
        worker({ years_experience: 1 }),
      ),
      evaluate(
        mission({ desired_skill_ids: [SKILL.salle, SKILL.hygiene] }),
        worker({ skill_ids: [SKILL.salle] }),
      ),
    ];
    for (const result of cases) {
      const expected = bandOf(result.raw_score);
      expect(result.band).toBe(expected?.min ?? null);
      expect(result.band_label).toBe(expected?.label ?? null);
    }
  });
});

/**
 * Deux scores que l arrondi confond.
 *
 * Le pendant pur du classement worker : ici, aucune base, aucun identifiant,
 * aucun tri — seulement la démonstration que l affichage perd une information
 * que le moteur possède. C est cette information qui doit servir à classer.
 */
describe("arrondi et score reel", () => {
  const atDistance = (km: number) => {
    // Un décalage de latitude vaut environ 111,19 km par degré.
    const result = evaluate(
      mission({ latitude: 45.75 + km / 111.19, longitude: 4.85 }),
      worker({ mobility_radius_km: 100 }),
    );
    return result;
  };

  it("affiche le meme pourcentage pour deux scores reels distincts", () => {
    const proche = atDistance(1);
    const loin = atDistance(2);
    expect(proche.score).toBe(loin.score);
    expect(proche.raw_score).toBeGreaterThan(loin.raw_score);
  });

  it("garde le meme palier des deux cotes quand l ecart est mince", () => {
    // L écart de distance ne doit pas faire changer de palier : ce qu il change,
    // c est l ordre. Les deux propriétés sont distinctes et doivent le rester.
    const proche = atDistance(1);
    const loin = atDistance(2);
    expect(proche.band).toBe(loin.band);
  });
});

/**
 * Le cas exact de la review, produit par le moteur et non posé à la main.
 *
 * `bandOf(69.6)` était testé isolément, et le rendu de la pastille aussi. Ce qui
 * manquait, c est la démonstration qu evaluate() produit bien les trois valeurs
 * ENSEMBLE — c est leur coexistence qui créait la contradiction à l écran, pas
 * chacune prise séparément.
 *
 * COMMENT 69,6 EST OBTENU, SANS RIEN FORCER. La mission n a pas de coordonnées :
 * la proximité sort donc du calcul, et il reste trois dimensions pesant
 * 45 + 20 + 10 = 75 points.
 *
 *   compétences souhaitées  3 sur 5      → 45 × 0,60 = 27,0
 *   métier principal        exact         → 20 × 1,00 = 20,0
 *   expérience              13 ans sur 25 → 10 × 0,52 =  5,2
 *                                            total     = 52,2
 *
 *   52,2 / 75 × 100 = 69,6
 *
 * Aucune valeur n est injectée : ce sont des données de profil ordinaires, et
 * le 69,6 tombe du calcul.
 */
describe("69,6 % — le cas qui contredisait l ecran", () => {
  const SKILLS = ["s-1", "s-2", "s-3", "s-4", "s-5"];

  const cas = () =>
    evaluate(
      mission({
        // Sans coordonnées, la proximité n est pas jugeable et sort du calcul.
        latitude: null,
        longitude: null,
        desired_skill_ids: SKILLS,
        min_years_experience: 25,
      }),
      worker({
        latitude: null,
        longitude: null,
        skill_ids: SKILLS.slice(0, 3),
        years_experience: 13,
      }),
    );

  it("produit un score reel de 69,6", () => {
    expect(cas().raw_score).toBeCloseTo(69.6, 10);
  });

  it("affiche 70 % apres arrondi", () => {
    expect(cas().score).toBe(70);
  });

  it("reste au palier 60, celui que le score reel atteint", () => {
    const result = cas();
    expect(result.band).toBe(60);
    expect(result.band_label).toBe("Compatibles");
  });

  it("montre les trois valeurs ensemble, puisque c est leur coexistence qui posait probleme", () => {
    const result = cas();
    expect({
      arrondi: result.score,
      palier: result.band,
      depasse: result.score >= 70,
    }).toEqual({ arrondi: 70, palier: 60, depasse: true });
    // Le score affiché franchit 70 ; le palier, non. Toute interface qui
    // déduirait l un de l autre se contredirait ici, et nulle part ailleurs de
    // façon aussi visible.
  });

  it("n est pas un profil incompatible : la contradiction touche un cas réel", () => {
    // Le cas ne vaudrait rien s il décrivait un profil écarté : il ne serait
    // jamais affiché, donc jamais contradictoire.
    expect(cas().compatible).toBe(true);
  });
});
