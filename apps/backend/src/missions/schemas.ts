import { z } from "zod";
import { jobValues, payUnitValues } from "../domain/reference.js";
import type {
  MissionGroup,
  MissionLifecycle,
  MissionPhase,
  NotOpenReason,
} from "./lifecycle.js";

export const missionStatusValues = [
  "draft",
  "open",
  "filled",
  "completed",
  "cancelled",
] as const;

export type MissionStatus = (typeof missionStatusValues)[number];

/**
 * Champs qu'une entreprise peut décrire elle-même. Déclarés une seule fois :
 * la création les rend obligatoires ou leur donne une valeur par défaut, la
 * modification les rend tous facultatifs, mais les bornes restent les mêmes.
 *
 * Tout ce qui n'est pas ici est décidé par le serveur — `company_id`, `status`,
 * `latitude`, `longitude`, `geocoded_at`, `published_at`, `demo` — et `.strict()`
 * suffit alors à les refuser, sans avoir à les énumérer.
 */
const editableFields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  job: z.enum(jobValues),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  address: z.string().trim().max(250),
  city: z.string().trim().min(1).max(120),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal invalide."),
  pay_amount: z.number().min(0).max(999999).nullable(),
  pay_unit: z.enum(payUnitValues).nullable(),
  headcount: z.number().int().min(1).max(50),
  min_years_experience: z.number().min(0).max(60).nullable(),
  required_skill_ids: z.array(z.uuid()).max(20),
  desired_skill_ids: z.array(z.uuid()).max(20),
};

/** État d'une mission suffisant pour juger de sa cohérence d'ensemble. */
export interface MissionConsistency {
  starts_at: string;
  ends_at: string;
  pay_amount: number | null;
  pay_unit: string | null;
  required_skill_ids: string[];
  desired_skill_ids: string[];
}

/**
 * Règles portant sur plusieurs champs à la fois.
 *
 * Elles sont énoncées ici une seule fois parce qu'elles s'appliquent à l'état
 * FINAL d'une mission, jamais à une requête. À la création, l'état final est la
 * requête elle-même. À la modification, non : envoyer `ends_at` seul peut le
 * placer avant un `starts_at` déjà enregistré, et effacer `pay_amount` seul peut
 * laisser une unité orpheline. Le service fusionne donc la modification sur la
 * mission stockée avant d'appeler `brokenRule`.
 */
const consistencyRules: {
  ok: (m: MissionConsistency) => boolean;
  message: string;
}[] = [
  {
    ok: (m) => Date.parse(m.ends_at) > Date.parse(m.starts_at),
    message: "La fin doit suivre le début.",
  },
  {
    ok: (m) =>
      new Set(m.required_skill_ids).size === m.required_skill_ids.length,
    message: "Compétences obligatoires dupliquées.",
  },
  {
    ok: (m) => new Set(m.desired_skill_ids).size === m.desired_skill_ids.length,
    message: "Compétences souhaitées dupliquées.",
  },
  {
    ok: (m) =>
      !m.required_skill_ids.some((id) => m.desired_skill_ids.includes(id)),
    message:
      "Une compétence ne peut pas être à la fois obligatoire et souhaitée.",
  },
  {
    ok: (m) => (m.pay_amount === null) === (m.pay_unit === null),
    message: "Indiquez la rémunération et son unité, ou aucune des deux.",
  },
];

/** Première règle enfreinte par cet état, ou `null` s'il est cohérent. */
export const brokenRule = (mission: MissionConsistency) =>
  consistencyRules.find((rule) => !rule.ok(mission))?.message ?? null;

/**
 * Création d'une mission. Utilisée par le service dès SL1 — le seed de
 * démonstration s'en sert — et exposée par `POST /missions` au SL2a.
 */
export const missionCreateSchema = z
  .object({
    ...editableFields,
    description: editableFields.description.default(""),
    address: editableFields.address.default(""),
    pay_amount: editableFields.pay_amount.default(null),
    pay_unit: editableFields.pay_unit.default(null),
    headcount: editableFields.headcount.default(1),
    min_years_experience: editableFields.min_years_experience.default(null),
    required_skill_ids: editableFields.required_skill_ids.default([]),
    desired_skill_ids: editableFields.desired_skill_ids.default([]),
  })
  .strict()
  .superRefine((mission, ctx) => {
    const message = brokenRule(mission);
    if (message) ctx.addIssue({ code: "custom", message });
  });

/**
 * Modification d'une mission. Aucune valeur par défaut, volontairement : un
 * champ absent signifie « inchangé », jamais « remis à sa valeur initiale ».
 *
 * Les règles croisées ne sont PAS vérifiées ici — la requête seule ne suffit pas
 * à les juger. C'est `MissionService.update` qui les applique, sur l'état final.
 */
export const missionUpdateSchema = z
  .object(editableFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification transmise.");

/** Filtres de la liste des missions. */
export const missionListSchema = z
  .object({
    status: z.enum(missionStatusValues).optional(),
  })
  .strict();

export type MissionInput = z.infer<typeof missionCreateSchema>;
export type MissionPatch = z.infer<typeof missionUpdateSchema>;

/**
 * Capacité de recrutement d'une mission.
 *
 * Distincte du statut : une mission dont tous les postes sont pourvus reste
 * publiée et active. « Complète » décrit son recrutement, pas son cycle de vie.
 */
export interface MissionCapacity {
  /** Postes ouverts au total. */
  headcount: number;
  /** Candidatures acceptées. Un refus n'en consomme aucun. */
  filled: number;
  /** Jamais négatif : un état hérité incohérent ne doit pas s'afficher. */
  remaining: number;
  full: boolean;
}

export interface MissionSkill {
  id: string;
  name: string;
  required: boolean;
}

/**
 * Ce qu'un intérimaire voit d'une mission publiée.
 *
 * `company_id` n'y figure pas : l'identifiant interne de l'entreprise ne lui
 * sert à rien. De l'établissement, seules les informations que l'entreprise
 * destine explicitement aux intérimaires sont reprises — son nom, son secteur
 * et sa présentation. Le téléphone, la raison sociale et l'adresse du siège
 * restent hors de cette vue : ce sont des coordonnées de contact, et rien ne
 * justifie de les donner avant une mise en relation.
 */
export interface OpenMissionCompany {
  establishment_name: string | null;
  sector: string | null;
  description: string | null;
}

export interface OpenMission extends Omit<Mission, "company_id"> {
  company: OpenMissionCompany;
}

/**
 * Une mission telle qu'elle est servie : ce qu'elle contient, plus ce qu'elle
 * signifie. Les trois champs dérivés sont toujours présents dans les réponses
 * de l'API ; ils restent optionnels dans `Mission` parce que ce type décrit
 * aussi une ligne fraîchement lue, avant que le service ne l'ait complétée.
 */
export type MissionView = Mission & MissionLifecycle;

export interface Mission {
  id: string;
  company_id: string;
  title: string;
  description: string;
  job: string;
  starts_at: string;
  ends_at: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  pay_amount: string | null;
  pay_unit: string | null;
  headcount: number;
  /**
   * Postes pourvus et restants, calculés à la lecture.
   *
   * `headcount` seul ne disait rien de l'état du recrutement : pour savoir s'il
   * restait une place, il fallait recompter les candidatures — donc les avoir
   * toutes. C'est une question que le serveur sait trancher, et lui seul.
   */
  capacity?: MissionCapacity;
  /**
   * Où en est la mission, et peut-elle encore recruter. Calculés à la lecture,
   * jamais stockés : voir `lifecycle.ts` pour le raisonnement.
   */
  phase?: MissionPhase;
  /** Onglet de la liste entreprise où cette mission se range. */
  group?: MissionGroup;
  recruiting?: boolean;
  recruiting_blocked?: NotOpenReason | null;
  min_years_experience: string | null;
  /**
   * Statut **écrit**. Trois valeurs seulement sont atteignables : `draft`,
   * `open`, `cancelled`. `filled` et `completed` survivent dans la contrainte
   * SQL depuis la migration 004, mais aucune transition n'y mène — voir
   * `lifecycle.ts`. Un écran qui filtre dessus n'affichera jamais rien : c'est
   * `phase` qu'il doit lire.
   */
  status: MissionStatus;
  published_at: string | null;
  demo: boolean;
  created_at: string;
  updated_at: string;
  skills: MissionSkill[];
}
