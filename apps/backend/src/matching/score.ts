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

/**
 * Ce qu'une dimension apporte, ou ce qu'elle coûte.
 *
 * Une note seule n'explique rien : « Proximité 40 % » est un chiffre, pas une
 * raison. Cette qualification est ce qui permet d'écrire « point limitant :
 * localisation » sans qu'aucune interface n'ait à redécider, chacune de son
 * côté, à partir de quel ratio un critère devient un reproche.
 */
export type DimensionTone = "strength" | "neutral" | "limitation";

/**
 * Où passent les frontières, en une seule déclaration.
 *
 * Elles portent sur le **ratio**, jamais sur les points : une dimension légère
 * presque entièrement satisfaite reste un point fort, et une dimension lourde
 * largement manquée reste un point limitant, quel que soit son poids. Mélanger
 * les deux ferait dépendre la qualification de la pondération, et un simple
 * changement de poids transformerait un compliment en reproche sans que rien
 * n'ait bougé chez le candidat.
 *
 * À mi-chemin exactement — ratio 0,5 — la dimension est donc **neutre**, et non
 * limitante : elle est à moitié acquise autant qu'à moitié manquante, et la
 * ranger d'un côté plutôt que de l'autre serait un parti pris que les données
 * ne soutiennent pas.
 *
 * Les valeurs sont volontairement asymétriques. Il faut presque tout avoir pour
 * qu'un critère soit mis en avant (75 %), mais il suffit d'en manquer la plus
 * grande part pour qu'il soit signalé (40 %) : une explication doit être
 * prudente dans l'éloge et franche sur ce qui manque. Entre les deux, la
 * dimension existe, compte dans le score, et ne mérite ni l'un ni l'autre.
 */
export const DIMENSION_TONES = { strength: 0.75, limitation: 0.4 } as const;

export function toneOf(ratio: number): DimensionTone {
  if (ratio >= DIMENSION_TONES.strength) return "strength";
  if (ratio <= DIMENSION_TONES.limitation) return "limitation";
  return "neutral";
}

export interface Dimension {
  key: DimensionKey;
  /** Formulation destinée à l'intérimaire comme à l'entreprise. */
  label: string;
  weight: number;
  /** Part obtenue, de 0 à 1. */
  ratio: number;
  /** Points réellement acquis, arrondis à l'affichage seulement. */
  points: number;
  /**
   * Point fort, point limitant, ou ni l'un ni l'autre.
   *
   * Calculé ici, et nulle part ailleurs. C'est la règle qui distingue une
   * explication d'une paraphrase du score, et elle n'a pas à exister en double
   * dans un navigateur.
   */
  tone: DimensionTone;
  /**
   * Points laissés sur la table : `weight - points`.
   *
   * Sert à ordonner les points limitants par ce qu'ils coûtent réellement. Sans
   * lui, une interface qui voudrait afficher « le » frein devrait refaire cette
   * soustraction — donc reconstituer un morceau de moteur.
   */
  lost: number;
}

/** Compétences détenues sur compétences demandées : de quoi écrire « 2/3 ». */
export interface SkillTally {
  held: number;
  total: number;
}

export interface MatchResult {
  compatible: boolean;
  /**
   * 0 à 100, arrondi — c'est la valeur à afficher.
   *
   * Les paliers, eux, se calculent sur `raw_score` : un profil à 69,6 %
   * s'affiche « 70 % » sans pour autant atteindre le palier des 70, faute de
   * quoi l'arrondi ferait entrer dans une tranche que le score n'atteint pas.
   */
  score: number;
  /** Le même score, non arrondi. Sert au classement, jamais à l'affichage. */
  raw_score: number;
  blockers: BlockerCode[];
  /** Uniquement les dimensions que les données permettent d'évaluer. */
  dimensions: Dimension[];
  /** Distance à vol d'oiseau, arrondie au kilomètre, ou null si incalculable. */
  distance_km: number | null;
  /**
   * Au-delà du rayon de déplacement déclaré.
   *
   * `null` lorsque la question n'a pas de réponse — coordonnées manquantes d'un
   * côté ou de l'autre, ou rayon jamais renseigné. Répondre « non » dans ce cas
   * affirmerait une proximité que rien n'établit.
   *
   * Le drapeau ne remplace pas le bloqueur `out_of_range` : pour l'intérimaire,
   * qui a fixé ce rayon lui-même, la mission reste hors de portée. Il permet à
   * l'entreprise d'élargir volontairement sa recherche, ce que le cahier
   * prévoit, sans que le moteur décide à sa place.
   */
  outside_zone: boolean | null;
  /** De quoi dire « 3 compétences obligatoires sur 3 » sans recompter. */
  skills: { required: SkillTally; desired: SkillTally };
  /**
   * Palier atteint par ce score, calculé sur la valeur **non arrondie**.
   *
   * POURQUOI IL VOYAGE AVEC LE RÉSULTAT. Le score public est arrondi : 69,6 %
   * s'affiche « 70 % ». Une interface qui déduirait le palier de ce nombre
   * rangerait ce profil dans les « très compatibles », alors que le serveur l'a
   * placé dans la tranche 60–69 — et l'écran afficherait deux vérités
   * contradictoires sur la même personne.
   *
   * Exposer `raw_score` résoudrait le symptôme en déplaçant le problème : le
   * navigateur referait la comparaison, donc détiendrait une copie de la règle.
   * C'est la conclusion qui traverse la frontière, pas la donnée qui permet de
   * la reconstituer.
   *
   * `null` en dessous de 50 : aucun palier du cahier n'est atteint.
   */
  band: number | null;
  band_label: string | null;
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
/* Paliers                                                             */
/* ------------------------------------------------------------------ */

/** Paliers du cahier des charges, du plus exigeant au plus large. */
export const BANDS = [
  { min: 70, label: "Très compatibles" },
  { min: 60, label: "Compatibles" },
  { min: 50, label: "Envisageables" },
] as const;

/**
 * Dans quel palier tombe un score.
 *
 * Prend le score **non arrondi**, toujours. C'est toute la raison d'être de
 * cette fonction : l'arrondi fait franchir des frontières que le score
 * n'atteint pas, et un palier qui bougerait selon qu'on l'a calculé avant ou
 * après l'affichage ne serait pas un palier.
 */
export function bandOf(rawScore: number) {
  return BANDS.find(({ min }) => rawScore >= min) ?? null;
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
  const tally = (needed: string[]): SkillTally => ({
    held: needed.filter((id) => held.has(id)).length,
    total: needed.length,
  });

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
  // Trois états, pas deux : dans la zone, hors de la zone, ou impossible à dire.
  const outsideZone =
    distance === null || radius === null ? null : distance > radius;
  if (outsideZone === true) blockers.push("out_of_range");

  // --- Critères gradués ---
  const dimensions: Dimension[] = [];
  const add = (key: DimensionKey, label: string, ratio: number | null) => {
    if (ratio === null) return;
    const bounded = Math.min(1, Math.max(0, ratio));
    const points = WEIGHTS[key] * bounded;
    dimensions.push({
      key,
      label,
      weight: WEIGHTS[key],
      ratio: bounded,
      points,
      tone: toneOf(bounded),
      lost: WEIGHTS[key] - points,
    });
  };

  add(
    "desired_skills",
    "Compétences souhaitées",
    ratioOfCoverage(mission.desired_skill_ids, held),
  );

  // Rayon nul : seul le point exact convient.
  //
  // L'ancienne rédaction accordait 1 à tout candidat dès que le rayon valait
  // zéro, au motif qu'il « avait déjà passé le filtre ». C'était faux : le
  // filtre n'écarte personne, il pose un bloqueur. Un profil à 300 km d'une
  // mission, rayon 0, cumulait donc `out_of_range` ET une proximité parfaite,
  // et pouvait atteindre 100 % — un score qui contredisait son propre bloqueur.
  //
  // La distance nulle reste le seul cas qui mérite le point : à rayon zéro, la
  // proximité est satisfaite sur place, et nulle part ailleurs.
  add(
    "proximity",
    "Proximité",
    distance === null || radius === null
      ? null
      : radius > 0
        ? // `add` borne à [0, 1] : au-delà du rayon, la part tombe à zéro.
          1 - distance / radius
        : distance === 0
          ? 1
          : 0,
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
  const raw = totalWeight === 0 ? 0 : (earned / totalWeight) * 100;
  const band = bandOf(raw);

  return {
    compatible: blockers.length === 0,
    score: Math.round(raw),
    raw_score: raw,
    blockers,
    dimensions,
    distance_km: distance === null ? null : Math.round(distance),
    outside_zone: outsideZone,
    skills: {
      required: tally(mission.required_skill_ids),
      desired: tally(mission.desired_skill_ids),
    },
    band: band?.min ?? null,
    band_label: band?.label ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Paliers de recherche                                                */
/* ------------------------------------------------------------------ */

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
 *
 * `score` doit être le score **non arrondi**. Comparer des valeurs arrondies
 * ferait entrer dans le palier des 70 un profil à 69,6 % qui ne l'atteint pas.
 *
 * L'identifiant départage les ex æquo. Sans lui, deux profils au même score
 * s'ordonnent comme la base les a rendus — c'est-à-dire sans garantie, d'une
 * requête à l'autre. Un classement qui change tout seul n'est pas un
 * classement, et aucun test ne pourrait l'affirmer stable.
 */
export function selectByBands<
  T extends { score: number; compatible: boolean; id: string },
>(candidates: T[]): BandedSelection<T> {
  const eligible = candidates
    .filter((c) => c.compatible)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  for (const { min, label } of BANDS) {
    const inBand = eligible.filter((c) => c.score >= min);
    if (inBand.length > 0) return { band: min, label, results: inBand };
  }
  return { band: null, label: null, results: [] };
}
