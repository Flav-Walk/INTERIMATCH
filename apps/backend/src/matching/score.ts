/**
 * Rapprochement entre une mission et un profil intérimaire.
 *
 * Tout ce fichier est une fonction pure : aucune base, aucun réseau, aucune
 * horloge. Les mêmes entrées donnent toujours le même résultat, ce qui rend le
 * rapprochement testable, rejouable et explicable — trois propriétés qu'un
 * score opaque ne pourrait pas offrir.
 *
 * DEUX FAMILLES DE CRITÈRES, qui ne se compensent jamais.
 *
 * 1. Les **critères bloquants** décident si la mission est envisageable. Un
 *    score élevé ne rachète jamais une incompatibilité : `compatible` est faux
 *    dès qu'un bloqueur est présent, quel que soit le score.
 * 2. Les **critères gradués** ordonnent ce qui reste, de 0 à 100.
 *
 * CE QUI N'EST PAS ÉVALUÉ, ET POURQUOI. La table `missions` ne porte aucune
 * exigence de permis ni de véhicule : ces informations existent côté profil
 * intérimaire, mais aucune mission ne peut les réclamer. Les intégrer
 * reviendrait à inventer un critère que l'entreprise n'a jamais exprimé.
 */

export type BlockerCode =
  | "paused"
  | "missing_required_skills"
  | "unavailable"
  | "out_of_range"
  /** Déjà engagé ailleurs sur ce créneau : une candidature acceptée. */
  | "engaged";

export interface MissionCriteria {
  job: string;
  starts_at: string;
  ends_at: string;
  latitude: number | null;
  longitude: number | null;
  min_years_experience: number | null;
  required_skill_ids: string[];
  desired_skill_ids: string[];
}

export interface AvailabilitySlot {
  starts_at: string;
  ends_at: string;
  status: "available" | "unavailable";
}

/**
 * Un créneau déjà réservé par une candidature acceptée.
 *
 * Distinct d'une indisponibilité déclarée : l'intérimaire n'a rien retiré de
 * son calendrier, il s'est engagé. La nuance compte, parce qu'un engagement se
 * déduit d'un fait vérifiable — une décision d'entreprise — tandis qu'une
 * indisponibilité est une intention que lui seul peut exprimer.
 */
export interface Engagement {
  starts_at: string;
  ends_at: string;
}

export interface WorkerCriteria {
  main_job: string | null;
  secondary_jobs: string[];
  latitude: number | null;
  longitude: number | null;
  mobility_radius_km: number | null;
  years_experience: number | null;
  open_to_missions: boolean;
  skill_ids: string[];
  availabilities: AvailabilitySlot[];
  /** Missions déjà acceptées. Elles bloquent leur intervalle, et lui seul. */
  engagements: Engagement[];
}

/**
 * Pondérations, en points sur 100.
 *
 * Le cahier des charges fixait 45 / 25 / 20 / 10 pour compétences, localisation,
 * disponibilité et expérience. Deux de ces critères ont changé de nature en
 * devenant bloquants : les compétences **obligatoires** et la disponibilité ne
 * se notent plus, elles se vérifient. Les 45 points des compétences reviennent
 * donc aux compétences **souhaitées**, qui sont précisément celles que
 * l'entreprise a désignées comme « faisant la différence », et les 20 points de
 * la disponibilité vont au métier — le signal que le cahier n'avait pas prévu
 * de noter, alors que c'est la première chose qu'une entreprise déclare.
 *
 * Les rangs d'importance du cahier sont ainsi conservés, et chaque point est
 * attribué à un critère que les données permettent réellement de mesurer.
 */
export const WEIGHTS = {
  desired_skills: 45,
  proximity: 25,
  job: 20,
  experience: 10,
} as const;

export type DimensionKey = keyof typeof WEIGHTS;

export interface Dimension {
  key: DimensionKey;
  /** Formulation destinée à l'intérimaire comme à l'entreprise. */
  label: string;
  weight: number;
  /** Part obtenue, de 0 à 1. */
  ratio: number;
  /** Points réellement acquis, arrondis à l'affichage seulement. */
  points: number;
}

export interface MatchResult {
  compatible: boolean;
  /** 0 à 100. Calculé même lorsqu'un bloqueur est présent, pour pouvoir l'expliquer. */
  score: number;
  blockers: BlockerCode[];
  /** Uniquement les dimensions que les données permettent d'évaluer. */
  dimensions: Dimension[];
  /** Distance à vol d'oiseau, arrondie au kilomètre, ou null si incalculable. */
  distance_km: number | null;
}

/* ------------------------------------------------------------------ */
/* Distance                                                            */
/* ------------------------------------------------------------------ */

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Distance orthodromique. Suffisante ici : à l'échelle d'un bassin d'emploi,
 * l'écart avec une distance routière ne change pas l'ordre des candidats, et
 * elle se calcule sans appeler le moindre service.
 */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------------------------------------------ */
/* Disponibilité                                                       */
/* ------------------------------------------------------------------ */

type Interval = [number, number];

const merge = (intervals: Interval[]): Interval[] => {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
};

/** Retire des plages déclarées indisponibles ; le reste demeure disjoint. */
const subtract = (base: Interval[], cuts: Interval[]): Interval[] => {
  let remaining = base;
  for (const [cutStart, cutEnd] of merge(cuts)) {
    const next: Interval[] = [];
    for (const [start, end] of remaining) {
      if (cutEnd <= start || cutStart >= end) {
        next.push([start, end]);
        continue;
      }
      if (cutStart > start) next.push([start, cutStart]);
      if (cutEnd < end) next.push([cutEnd, end]);
    }
    remaining = next;
  }
  return remaining;
};

/**
 * L'intérimaire doit être disponible sur **toute** la durée de la mission.
 *
 * Un service ne se quitte pas en cours de route : une couverture partielle ne
 * rend pas la mission réalisable. C'est le sens strict de « disponible sur la
 * plage nécessaire », et il englobe le cas d'une incompatibilité totale.
 */
export function coversMission(
  slots: AvailabilitySlot[],
  mission: { starts_at: string; ends_at: string },
) {
  const window: Interval = [
    Date.parse(mission.starts_at),
    Date.parse(mission.ends_at),
  ];
  const toInterval = (s: AvailabilitySlot): Interval => [
    Date.parse(s.starts_at),
    Date.parse(s.ends_at),
  ];
  const available = merge(
    slots.filter((s) => s.status === "available").map(toInterval),
  );
  const unavailable = slots
    .filter((s) => s.status === "unavailable")
    .map(toInterval);
  return subtract(available, unavailable).some(
    ([start, end]) => start <= window[0] && end >= window[1],
  );
}

/* ------------------------------------------------------------------ */
/* Engagements                                                         */
/* ------------------------------------------------------------------ */

/**
 * Deux intervalles se chevauchent si et seulement si chacun commence avant que
 * l'autre ne finisse.
 *
 * Les bornes sont semi-ouvertes [début, fin), comme en base : une mission qui
 * s'achève à 16 h et une autre qui débute à 16 h ne se disputent aucune minute.
 * C'est la convention qui permet d'enchaîner un service du midi et un service
 * du soir, situation ordinaire du métier — et la seule qui rende l'algèbre
 * cohérente avec `merge` et `subtract` employés plus haut.
 *
 * Une borne illisible produit `NaN`, et toute comparaison avec `NaN` est
 * fausse : l'intervalle est alors ignoré. C'est délibéré. On ne peut pas
 * affirmer un chevauchement qu'on est incapable de situer, et refuser une
 * mission sur une date qu'on n'a pas su lire serait une exclusion muette.
 */
export function overlaps(
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string },
) {
  return (
    Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
    Date.parse(b.starts_at) < Date.parse(a.ends_at)
  );
}

/* ------------------------------------------------------------------ */
/* Évaluation                                                          */
/* ------------------------------------------------------------------ */

const ratioOfCoverage = (needed: string[], held: Set<string>) =>
  needed.length === 0
    ? null
    : needed.filter((id) => held.has(id)).length / needed.length;

/**
 * Évalue une mission pour un intérimaire.
 *
 * Le score est la moyenne des dimensions **applicables**, pondérée puis ramenée
 * sur 100. Une dimension qu'aucune donnée ne permet de juger — une mission sans
 * compétence souhaitée, une adresse jamais géocodée — est écartée du calcul au
 * lieu de compter zéro : la pénaliser reviendrait à reprocher à un candidat une
 * information que personne ne lui a demandée, et fausserait les paliers.
 */
export function evaluate(
  mission: MissionCriteria,
  worker: WorkerCriteria,
): MatchResult {
  const held = new Set(worker.skill_ids);
  const blockers: BlockerCode[] = [];

  // --- Critères bloquants ---
  if (!worker.open_to_missions) blockers.push("paused");
  if (!mission.required_skill_ids.every((id) => held.has(id)))
    blockers.push("missing_required_skills");
  if (!coversMission(worker.availabilities, mission))
    blockers.push("unavailable");
  // Un engagement n'ampute pas les disponibilités : il réserve son propre
  // intervalle. L'intérimaire reste donc proposable avant et après.
  if (worker.engagements.some((taken) => overlaps(taken, mission)))
    blockers.push("engaged");

  // La distance ne peut exclure que si elle est connue. Faute de coordonnées,
  // on ne peut pas affirmer que la mission est hors zone : la retenir serait
  // masquer une mission peut-être toute proche. La dimension est alors écartée
  // du score, et l'absence est signalée par `distance_km: null`.
  const locatable =
    mission.latitude !== null &&
    mission.longitude !== null &&
    worker.latitude !== null &&
    worker.longitude !== null;
  const distance = locatable
    ? distanceKm(
        { latitude: worker.latitude!, longitude: worker.longitude! },
        { latitude: mission.latitude!, longitude: mission.longitude! },
      )
    : null;
  const radius = worker.mobility_radius_km;
  if (distance !== null && radius !== null && distance > radius)
    blockers.push("out_of_range");

  // --- Critères gradués ---
  const dimensions: Dimension[] = [];
  const add = (key: DimensionKey, label: string, ratio: number | null) => {
    if (ratio === null) return;
    const bounded = Math.min(1, Math.max(0, ratio));
    dimensions.push({
      key,
      label,
      weight: WEIGHTS[key],
      ratio: bounded,
      points: WEIGHTS[key] * bounded,
    });
  };

  add(
    "desired_skills",
    "Compétences souhaitées",
    ratioOfCoverage(mission.desired_skill_ids, held),
  );

  add(
    "proximity",
    "Proximité",
    distance !== null && radius !== null && radius > 0
      ? 1 - distance / radius
      : distance !== null && radius === 0
        ? // Rayon nul : seul le point exact convient, et il a déjà passé le filtre.
          1
        : null,
  );

  add(
    "job",
    "Métier",
    worker.main_job === mission.job
      ? 1
      : worker.secondary_jobs.includes(mission.job)
        ? 0.6
        : 0,
  );

  add(
    "experience",
    "Expérience",
    mission.min_years_experience === null || mission.min_years_experience <= 0
      ? null // Rien n'a été demandé : il n'y a rien à juger.
      : (worker.years_experience ?? 0) / mission.min_years_experience,
  );

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const earned = dimensions.reduce((sum, d) => sum + d.points, 0);
  const score =
    totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  return {
    compatible: blockers.length === 0,
    score,
    blockers,
    dimensions,
    distance_km: distance === null ? null : Math.round(distance),
  };
}

/* ------------------------------------------------------------------ */
/* Paliers de recherche                                                */
/* ------------------------------------------------------------------ */

/** Paliers du cahier des charges, du plus exigeant au plus large. */
export const BANDS = [
  { min: 70, label: "Très compatibles" },
  { min: 60, label: "Compatibles" },
  { min: 50, label: "Envisageables" },
] as const;

export interface BandedSelection<T> {
  /** Palier retenu, ou null si aucun candidat n'atteint 50. */
  band: number | null;
  label: string | null;
  results: T[];
}

/**
 * Sélection par élargissement progressif.
 *
 * On cherche d'abord les candidats à 70 et plus. S'il n'y en a aucun, on
 * descend à 60, puis à 50. On ne descend **que** faute de candidat au palier
 * supérieur : le but est de ne jamais laisser une mission sans proposition,
 * pas de mélanger les niveaux.
 *
 * Les bloquants restent bloquants : cette fonction ne voit que des candidats
 * déjà déclarés compatibles, et aucun élargissement ne les réintroduit.
 */
export function selectByBands<T extends { score: number; compatible: boolean }>(
  candidates: T[],
): BandedSelection<T> {
  const eligible = candidates
    .filter((c) => c.compatible)
    .sort((a, b) => b.score - a.score);
  for (const { min, label } of BANDS) {
    const inBand = eligible.filter((c) => c.score >= min);
    if (inBand.length > 0) return { band: min, label, results: inBand };
  }
  return { band: null, label: null, results: [] };
}
