import type { MissionCapacity, MissionStatus } from "./schemas.js";

/**
 * Où en est une mission — lu, jamais stocké.
 *
 * POURQUOI RIEN N'EST PERSISTÉ ICI. Sur les sept états que le produit doit
 * savoir représenter, un seul n'est pas calculable : `cancelled`. Les six autres
 * se déduisent entièrement de trois informations déjà en base — le statut, les
 * deux bornes du créneau, et le nombre de candidatures acceptées :
 *
 * | État demandé | D'où il vient réellement                        |
 * | ------------ | ----------------------------------------------- |
 * | brouillon    | `status = 'draft'`                              |
 * | publiée      | `status = 'open'`                               |
 * | pourvue      | `capacity.full`, déjà servi par le contrat      |
 * | à venir      | ≥ 1 acceptation et `starts_at` encore devant    |
 * | en cours     | `starts_at <= maintenant < ends_at`             |
 * | terminée     | `ends_at <= maintenant`                         |
 * | annulée      | décision de l'entreprise — rien ne la déduit    |
 *
 * Les stocker demanderait de les tenir à jour, donc un cron qui repasserait sur
 * les missions pour faire dire à une colonne ce que `now()` dit déjà. Entre deux
 * passages, la colonne serait fausse ; au premier incident, elle le resterait.
 * Une valeur calculée à la lecture ne peut pas se désynchroniser : elle n'a pas
 * d'existence propre.
 *
 * C'est aussi pourquoi `filled` et `completed`, présents depuis la migration 004
 * dans la contrainte de `missions.status`, ne sont jamais écrits. Ils y restent
 * — les retirer imposerait une migration destructive pour rien — mais aucune
 * transition n'y mène. Les lire comme un statut ferait exister deux réponses à
 * la même question, et rien ne garantirait qu'elles s'accordent.
 *
 * `cancelled` fait exception parce qu'il n'est pas une observation : c'est une
 * intention. Aucune date, aucun décompte ne peut l'inférer. Il est donc le seul
 * que l'entreprise écrit, et le seul qui survit au calendrier — une mission
 * annulée reste annulée une fois son créneau passé, elle ne devient pas
 * « terminée ».
 */
export const missionPhaseValues = [
  "draft",
  "cancelled",
  "completed",
  "in_progress",
  "upcoming",
  "open",
] as const;

export type MissionPhase = (typeof missionPhaseValues)[number];

/** Le strict nécessaire pour situer une mission. */
export interface MissionTiming {
  status: MissionStatus;
  starts_at: string | Date;
  ends_at: string | Date;
}

/**
 * Phase d'une mission, dans l'ordre de priorité qui la détermine.
 *
 * L'ordre n'est pas arbitraire. Plusieurs états sont vrais en même temps — une
 * mission pourvue dont le créneau n'a pas commencé est à la fois « pourvue » et
 * « à venir » — et il faut bien n'en afficher qu'un. Le classement retenu va du
 * plus décisif au plus circonstanciel :
 *
 *  1. `cancelled` — l'entreprise a retiré son offre ; plus rien d'autre ne compte ;
 *  2. `draft` — jamais publiée, donc jamais entrée dans le cycle. Un brouillon
 *     dont les dates sont passées reste un brouillon : le dire « terminé »
 *     laisserait croire qu'il s'est passé quelque chose ;
 *  3. `completed`, puis `in_progress` — le calendrier, qui prime sur le
 *     recrutement : une mission commencée est en cours, qu'elle ait trouvé tout
 *     son monde ou personne ;
 *  4. `upcoming` — publiée, quelqu'un est retenu, ça n'a pas commencé ;
 *  5. `open` — publiée et encore sans personne.
 *
 * « Pourvue » ne figure pas dans cette liste, volontairement : c'est l'état du
 * recrutement, pas une position dans le temps, et `capacity.full` le dit déjà.
 * L'y ajouter obligerait à choisir entre « pourvue » et « à venir » pour une
 * mission qui est les deux.
 */
export function missionPhase(
  mission: MissionTiming,
  filled: number,
  now: Date = new Date(),
): MissionPhase {
  if (mission.status === "cancelled") return "cancelled";
  if (mission.status === "draft") return "draft";
  const instant = now.getTime();
  if (new Date(mission.ends_at).getTime() <= instant) return "completed";
  if (new Date(mission.starts_at).getTime() <= instant) return "in_progress";
  return filled > 0 ? "upcoming" : "open";
}

/**
 * Pourquoi une mission n'est pas offerte aux intérimaires.
 *
 * `full` est à part : la mission est toujours publiée, toujours active, elle
 * n'a simplement plus de place. La confondre avec `closed` ferait annoncer
 * « cette mission n'est plus ouverte » d'une mission qui l'est encore.
 *
 * `cancelled` est distinct pour la même raison, en sens inverse : une mission
 * annulée n'a pas trouvé tout son monde, elle a été retirée. Les réunir sous
 * `closed` ferait dire à l'écran « tous les postes sont pourvus » d'une mission
 * que personne n'a pourvue.
 *
 * `closed` ne subsiste que pour les statuts que rien n'écrit — `filled` et
 * `completed`. Aucun chemin du produit n'y mène ; il couvre une donnée héritée.
 */
export type NotOpenReason = "draft" | "ended" | "closed" | "cancelled" | "full";

/**
 * Pendant TypeScript du prédicat SQL `openToWorkers`, pour les décisions qui ne
 * passent pas par une requête — typiquement : faut-il rapprocher des profils de
 * cette mission ? Le SQL répond « oui / non » ; ici on veut aussi le motif, pour
 * pouvoir le dire à l'entreprise plutôt que de lui servir une liste vide.
 *
 * Les deux prédicats doivent rester d'accord. `missions.test.ts` le vérifie en
 * confrontant, sur les mêmes missions, ce que `listOpen` retient et ce que
 * cette fonction déclare offert.
 *
 * La cloison démo n'est pas reprise : elle sépare deux univers de comptes, et
 * une entreprise consulte toujours ses propres missions, donc son propre
 * univers. Le partage démo / réel reste appliqué là où il a un sens, sur
 * l'ensemble des intérimaires interrogés.
 *
 * L'annulation passe avant la date : une mission annulée le reste une fois son
 * créneau écoulé. Le créneau passe ensuite avant le statut, car un brouillon
 * dont les dates sont derrière nous ne se publie plus, et lui répondre
 * « publiez-la » serait faux.
 *
 * La capacité est facultative : tous les appelants ne l'ont pas sous la main, et
 * `full` n'est de toute façon pas un motif de fermeture — c'est un motif de
 * suspension. Quand elle est fournie, elle est examinée en dernier, parce
 * qu'être complet ne dit rien d'une mission déjà annulée ou déjà passée.
 */
export function notOpenToWorkers(
  mission: Pick<MissionTiming, "status" | "ends_at">,
  now: Date = new Date(),
  capacity?: Pick<MissionCapacity, "full">,
): NotOpenReason | null {
  if (mission.status === "cancelled") return "cancelled";
  if (new Date(mission.ends_at) <= now) return "ended";
  if (mission.status === "draft") return "draft";
  if (mission.status !== "open") return "closed";
  if (capacity?.full) return "full";
  return null;
}

/**
 * Ce que le frontend doit pouvoir lire sans rejouer la règle métier.
 *
 * Trois champs, et pas un de plus. `phase` situe la mission, `recruiting`
 * répond à la seule question dont dépendent les boutons — peut-on encore
 * postuler, peut-on encore accepter — et `recruiting_blocked` donne le motif
 * quand la réponse est non, pour que l'écran l'explique au lieu de griser sans
 * rien dire.
 */
export interface MissionLifecycle {
  phase: MissionPhase;
  /** Onglet de la liste entreprise où cette mission se range. */
  group: MissionGroup;
  /**
   * La mission peut encore recevoir une candidature **et** une acceptation.
   *
   * Un seul booléen pour les deux, parce que les deux conditions se sont
   * révélées être la même : une mission publiée, non annulée, non terminée et
   * pas encore complète. Une mission commencée continue d'accepter les deux —
   * un remplacement de dernière minute est un cas normal du métier, pas une
   * anomalie à bloquer. En scinder deux ferait croire à une différence qui
   * n'existe pas, et il faudrait ensuite les garder d'accord pour rien.
   */
  recruiting: boolean;
  /** `null` exactement quand `recruiting` vaut vrai. */
  recruiting_blocked: NotOpenReason | null;
}

/**
 * Où cette mission se range dans la liste de l'entreprise.
 *
 * POURQUOI CE CHAMP EXISTE. Les onglets « Publiées / Pourvues / Terminées /
 * Brouillons / Annulées » filtraient sur `missions.status`. Or `filled` et
 * `completed` ne sont jamais écrits : une mission dont tous les postes étaient
 * pris restait `open`, affichait bien « Pourvue » sur sa fiche, et n'apparaissait
 * dans AUCUN onglet correspondant. L'onglet « Pourvues » était vide par
 * construction, et « Terminées également ».
 *
 * La correction ne consiste pas à écrire ces statuts en base — ils redeviendraient
 * faux dès la minute suivante — mais à exposer le regroupement là où il est
 * calculable sans risque de désynchronisation : ici, à la lecture, à partir des
 * trois dimensions que le modèle possède déjà — le statut écrit, les dates, la
 * capacité.
 *
 * LES GROUPES SONT EXCLUSIFS. Chaque mission en occupe exactement un, ce qui
 * permet aux compteurs d'être la taille réelle des listes affichées. L'ordre
 * suit celui de `missionPhase`, pour que les deux ne puissent pas se
 * contredire : l'intention d'abord, le calendrier ensuite, le recrutement en
 * dernier. Une mission complète ET terminée est donc « terminée » — ce qui
 * s'est passé prime sur la façon dont elle s'est remplie.
 */
export const missionGroupValues = [
  "cancelled",
  "draft",
  "completed",
  "filled",
  "open",
] as const;

export type MissionGroup = (typeof missionGroupValues)[number];

export function missionGroup(
  mission: MissionTiming,
  capacity: Pick<MissionCapacity, "full">,
  now: Date = new Date(),
): MissionGroup {
  if (mission.status === "cancelled") return "cancelled";
  if (mission.status === "draft") return "draft";
  if (new Date(mission.ends_at).getTime() <= now.getTime()) return "completed";
  if (capacity.full) return "filled";
  return "open";
}

/** Assemble la lecture complète à partir de la mission et de sa capacité. */
export function missionLifecycle(
  mission: MissionTiming,
  capacity: MissionCapacity,
  now: Date = new Date(),
): MissionLifecycle {
  const blocked = notOpenToWorkers(mission, now, capacity);
  return {
    phase: missionPhase(mission, capacity.filled, now),
    group: missionGroup(mission, capacity, now),
    recruiting: blocked === null,
    recruiting_blocked: blocked,
  };
}
