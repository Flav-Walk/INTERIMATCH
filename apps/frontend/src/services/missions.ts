import { api } from "./session";

export type MissionStatus =
  "draft" | "open" | "filled" | "completed" | "cancelled";

export interface MissionSkill {
  id: string;
  name: string;
  required: boolean;
}

export interface Mission {
  id: string;
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
  pay_amount: string | null;
  pay_unit: string | null;
  headcount: number;
  min_years_experience: string | null;
  status: MissionStatus;
  published_at: string | null;
  demo: boolean;
  skills: MissionSkill[];
}

export interface MissionList {
  missions: Mission[];
  counts: Partial<Record<MissionStatus, number>>;
}

export const listMissions = (status?: MissionStatus) =>
  api<MissionList>("/missions" + (status ? "?status=" + status : ""));

export const getMission = (id: string) => api<Mission>("/missions/" + id);

/**
 * Une mission telle qu'un intérimaire la voit : la mission elle-même, plus ce
 * que l'entreprise destine aux intérimaires de son établissement. Les
 * coordonnées de contact n'en font pas partie — le serveur ne les envoie pas.
 */
export interface OpenMission extends Mission {
  company: {
    establishment_name: string | null;
    sector: string | null;
    description: string | null;
  };
  /** Rapprochement avec le profil du demandeur, calculé par le serveur. */
  match: MatchResult;
}

/** Motifs d'incompatibilité, tels que le serveur les nomme. */
export type BlockerCode =
  "paused" | "missing_required_skills" | "unavailable" | "out_of_range";

export interface MatchDimension {
  key: "desired_skills" | "proximity" | "job" | "experience";
  label: string;
  weight: number;
  ratio: number;
  points: number;
}

export interface MatchResult {
  compatible: boolean;
  score: number;
  blockers: BlockerCode[];
  dimensions: MatchDimension[];
  distance_km: number | null;
}

/** Ce qu'une entreprise voit d'un profil rapproché, avant toute candidature. */
export interface Candidate {
  id: string;
  first_name: string;
  last_initial: string;
  main_job: string | null;
  city: string | null;
  years_experience: number | null;
  matched_skills: MissionSkill[];
  match: MatchResult;
}

/**
 * Pourquoi le rapprochement ne tourne pas sur une mission, tel que le serveur
 * le nomme. Une mission qui n'est offerte à aucun intérimaire ne peut pas non
 * plus proposer de profils : les deux espaces suivent la même règle.
 */
export type MatchingInactive = "draft" | "ended" | "closed";

export interface CandidateList {
  /** Palier retenu — 70, 60 ou 50 — ou null si personne n'atteint 50. */
  band: number | null;
  band_label: string | null;
  candidates: Candidate[];
  /** `null` quand le rapprochement a bien tourné. */
  inactive: MatchingInactive | null;
}

/**
 * Profils rapprochés d'une mission de l'entreprise. Le serveur applique les
 * paliers du cahier des charges et n'élargit que faute de candidat au-dessus.
 */
export const listCandidates = (missionId: string) =>
  api<CandidateList>(`/missions/${missionId}/candidates`);

/**
 * Missions offertes, toutes entreprises confondues, de la plus proche à la plus
 * lointaine. Aucun classement par affinité : le rapprochement viendra ensuite,
 * et ordonnera cette même liste sans changer l'appel.
 */
export const listOpenMissions = () =>
  api<{ missions: OpenMission[]; excluded: Exclusions }>(
    "/workers/me/missions",
  );

/**
 * Décompte des missions ouvertes qui n'ont pas été proposées, par motif.
 *
 * Des nombres seulement : le serveur ne livre rien d'une mission incompatible.
 * C'est assez pour expliquer un écran vide, et pas assez pour divulguer une
 * offre qui ne concerne pas ce profil.
 *
 * Une mission cumulant deux bloqueurs pèse une fois dans `total` et une fois
 * dans chaque motif : la somme des motifs peut donc dépasser le total.
 */
export interface Exclusions {
  total: number;
  reasons: Partial<Record<BlockerCode, number>>;
}

export const getOpenMission = (id: string) =>
  api<OpenMission>("/workers/me/missions/" + id);

/**
 * Ce qu'on dit à un intérimaire dont l'écran reste vide.
 *
 * L'écran annonçait jusqu'ici « aucune mission disponible » et énumérait les
 * quatre critères possibles, sans dire lequel jouait. La recette de production
 * a montré le coût de ce silence : un profil complet, compatible à 100 %, à qui
 * il manquait un créneau — et qui n'avait aucun moyen de le deviner.
 *
 * Trois règles de rédaction, à tenir si ces textes évoluent :
 *  - ne jamais promettre une mission. Corriger le motif élargit ce qui **peut**
 *    être proposé, rien de plus ;
 *  - ne jamais nommer une mission. On explique un vide, on ne montre pas ce
 *    qu'on refuse de montrer ;
 *  - une seule raison à l'écran. Plusieurs paragraphes de motifs feraient de
 *    l'état vide un rapport, alors qu'il doit tenir en un regard.
 */
export interface EmptyReason {
  code: BlockerCode;
  /** Missions ouvertes écartées pour ce motif. */
  count: number;
  title: string;
  detail: string;
  action: { label: string; to: string };
}

/**
 * Ordre de départage, à nombre de missions égal : du motif le plus large au
 * plus ponctuel. La pause vient à part — elle coupe tout, quel que soit le
 * reste, et c'est la seule dont l'intérimaire tient l'interrupteur.
 */
const blockerOrder: BlockerCode[] = [
  "unavailable",
  "out_of_range",
  "missing_required_skills",
];

const plural = (n: number, word: string) => (n > 1 ? word : "");

const copy: Record<
  BlockerCode,
  (n: number) => Omit<EmptyReason, "code" | "count">
> = {
  paused: () => ({
    title: "Votre recherche est en pause",
    detail:
      "Tant que votre recherche est en pause, aucune mission ne vous est proposée. Vous pouvez la réactiver depuis votre profil.",
    action: {
      label: "Réactiver ma recherche",
      to: "/worker/profile#recherche",
    },
  }),
  unavailable: (n) => ({
    title: "Aucune mission ne correspond à vos disponibilités",
    detail: `${n} mission${plural(n, "s")} ouverte${plural(n, "s")} ne vous ${n > 1 ? "sont" : "est"} pas proposée${plural(n, "s")} faute de créneau qui ${n > 1 ? "les couvre" : "la couvre"}. Ajouter ou modifier vos disponibilités élargit ce qui peut vous être proposé.`,
    action: {
      label: "Modifier mes disponibilités",
      to: "/worker/profile#disponibilites",
    },
  }),
  out_of_range: (n) => ({
    title: "Aucune mission dans votre zone de déplacement",
    detail: `${n} mission${plural(n, "s")} ouverte${plural(n, "s")} se ${n > 1 ? "situent" : "situe"} au-delà de votre rayon de déplacement. Élargir ce rayon ou changer de ville modifie ce qui peut vous être proposé.`,
    action: { label: "Modifier ma mobilité", to: "/worker/profile#mobilite" },
  }),
  missing_required_skills: (n) => ({
    title: "Aucune mission ne correspond à vos compétences",
    detail: `${n} mission${plural(n, "s")} ouverte${plural(n, "s")} ${n > 1 ? "exigent" : "exige"} une compétence qui ne figure pas sur votre profil. Complétez vos compétences pour élargir ce qui peut vous être proposé.`,
    action: {
      label: "Compléter mes compétences",
      to: "/worker/profile#competences",
    },
  }),
};

/**
 * Le motif dominant, ou `null` quand aucune mission ouverte n'a été écartée —
 * auquel cas il n'y a rien à expliquer : il n'y a simplement pas de mission.
 *
 * La pause l'emporte toujours : elle explique l'intégralité du vide à elle
 * seule, et aucun autre motif n'est actionnable tant qu'elle dure. Les autres
 * se départagent au nombre de missions concernées.
 */
export function explainEmpty(
  excluded: Exclusions | undefined,
): EmptyReason | null {
  const reasons = excluded?.reasons;
  if (!reasons) return null;
  const at = (code: BlockerCode) => reasons[code] ?? 0;

  const code = at("paused")
    ? "paused"
    : blockerOrder
        .filter((c) => at(c) > 0)
        .sort((a, b) => at(b) - at(a))[0];
  if (!code) return null;

  const count = at(code);
  return { code, count, ...copy[code](count) };
}

/**
 * Exactement ce que `POST /missions` accepte. Ni `company_id`, ni `status`, ni
 * les coordonnées : le serveur les décide, et les refuserait s'ils étaient
 * envoyés. Ce type est donc aussi la garantie qu'aucun écran ne les demandera.
 */
export interface MissionInput {
  title: string;
  description: string;
  job: string;
  starts_at: string;
  ends_at: string;
  address: string;
  city: string;
  postal_code: string;
  pay_amount: number | null;
  pay_unit: string | null;
  headcount: number;
  min_years_experience: number | null;
  required_skill_ids: string[];
  desired_skill_ids: string[];
}

export type MissionPatch = Partial<MissionInput>;

/** Une mission naît toujours en brouillon : la publication est un geste à part. */
export const createMission = (input: MissionInput) =>
  api<Mission>("/missions", { method: "POST", body: JSON.stringify(input) });

export const updateMission = (id: string, patch: MissionPatch) =>
  api<Mission>("/missions/" + id, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

/** Sans corps : la date de publication est posée par le serveur. */
export const publishMission = (id: string) =>
  api<Mission>(`/missions/${id}/publish`, { method: "POST" });

/**
 * Seul un brouillon se publie. Le frontend n'en déduit rien d'autre : il
 * n'existe pas ici de seconde machine à états, le serveur reste l'autorité et
 * ses refus sont affichés tels quels.
 */
export const canPublish = (mission: Mission) => mission.status === "draft";

/**
 * Une mission terminée ou annulée n'a plus à être retouchée. Le serveur, lui,
 * accepterait la modification : ce n'est donc pas une règle, seulement une
 * action qu'on cesse de proposer quand elle n'a plus de sens.
 */
export const canEdit = (mission: Mission) =>
  mission.status === "draft" || mission.status === "open";

/**
 * Onglets de la maquette. « En cours » regroupe les missions pourvues en cours,
 * « À venir » les missions publiées qui n'ont pas commencé.
 */
export const missionTabs = [
  { key: "open", label: "À pourvoir" },
  { key: "filled", label: "En cours" },
  { key: "completed", label: "Terminées" },
  { key: "draft", label: "Brouillons" },
] as const;

export type MissionTab = (typeof missionTabs)[number]["key"];

/** Recherche locale sur les missions déjà chargées : titre, ville, métier. */
export function searchMissions(missions: Mission[], query: string) {
  const needle = query.trim().toLocaleLowerCase("fr");
  if (!needle) return missions;
  return missions.filter((m) =>
    [m.title, m.city, m.postal_code, m.job]
      .join(" ")
      .toLocaleLowerCase("fr")
      .includes(needle),
  );
}

/** Prochaines missions datées, de la plus proche à la plus lointaine. */
export function upcomingMissions(missions: Mission[], limit = 3) {
  const now = Date.now();
  return missions
    .filter((m) => Date.parse(m.ends_at) > now && m.status !== "cancelled")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, limit);
}

/** Jours du mois portant au moins une mission, pour le mini-calendrier. */
export function missionDaysOfMonth(
  missions: Mission[],
  year: number,
  month: number,
) {
  const days = new Set<number>();
  for (const mission of missions) {
    const start = new Date(mission.starts_at);
    if (start.getFullYear() === year && start.getMonth() === month)
      days.add(start.getDate());
  }
  return days;
}

/* -------------------------------------------------------------------------
 * Formulaire de mission : saisie, conversion, écarts.
 * ---------------------------------------------------------------------- */

/**
 * Niveau d'attente pour une compétence. Une compétence absente de la table
 * n'est pas demandée. Représenter le choix par **une seule valeur par
 * compétence** rend impossible de la déclarer à la fois obligatoire et
 * souhaitée : ce n'est pas une règle à vérifier, c'est une forme qui ne permet
 * pas de l'exprimer. Le serveur la vérifie tout de même de son côté.
 */
export type SkillLevel = "required" | "desired";

/** Valeurs telles que les champs les portent : des chaînes, même pour les nombres. */
export interface MissionFormValues {
  title: string;
  description: string;
  job: string;
  starts_at: string;
  ends_at: string;
  address: string;
  city: string;
  postal_code: string;
  pay_amount: string;
  pay_unit: string;
  headcount: string;
  min_years_experience: string;
  skills: Record<string, SkillLevel>;
}

/** Date ISO → valeur d'un `datetime-local`, en heure locale. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valeur d'un `datetime-local` → ISO UTC. Chaîne vide si la saisie est absente. */
export const fromLocalInput = (value: string) =>
  value ? new Date(value).toISOString() : "";

export const emptyMission: MissionFormValues = {
  title: "",
  description: "",
  job: "",
  starts_at: "",
  ends_at: "",
  address: "",
  city: "",
  postal_code: "",
  pay_amount: "",
  pay_unit: "",
  headcount: "1",
  min_years_experience: "",
  skills: {},
};

/** Prérempli le formulaire depuis une mission existante. */
export function missionToForm(mission: Mission): MissionFormValues {
  const skills: Record<string, SkillLevel> = {};
  for (const skill of mission.skills)
    skills[skill.id] = skill.required ? "required" : "desired";
  return {
    title: mission.title,
    description: mission.description,
    job: mission.job,
    starts_at: toLocalInput(mission.starts_at),
    ends_at: toLocalInput(mission.ends_at),
    address: mission.address,
    city: mission.city,
    postal_code: mission.postal_code,
    pay_amount:
      mission.pay_amount === null ? "" : String(Number(mission.pay_amount)),
    pay_unit: mission.pay_unit ?? "",
    headcount: String(mission.headcount),
    min_years_experience:
      mission.min_years_experience === null
        ? ""
        : String(Number(mission.min_years_experience)),
    skills,
  };
}

const idsAtLevel = (skills: Record<string, SkillLevel>, level: SkillLevel) =>
  Object.keys(skills)
    .filter((id) => skills[id] === level)
    .sort();

/** Valeurs de saisie → corps d'API. */
export function formToMission(values: MissionFormValues): MissionInput {
  const number = (raw: string) => (raw.trim() === "" ? null : Number(raw));
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    job: values.job,
    starts_at: fromLocalInput(values.starts_at),
    ends_at: fromLocalInput(values.ends_at),
    address: values.address.trim(),
    city: values.city.trim(),
    postal_code: values.postal_code.trim(),
    pay_amount: number(values.pay_amount),
    pay_unit: values.pay_unit === "" ? null : values.pay_unit,
    headcount: Number(values.headcount || "1"),
    min_years_experience: number(values.min_years_experience),
    required_skill_ids: idsAtLevel(values.skills, "required"),
    desired_skill_ids: idsAtLevel(values.skills, "desired"),
  };
}

/**
 * Champs réellement modifiés. `PATCH` étant partiel, n'envoyer que l'écart
 * évite de réécrire des colonnes intactes — et surtout d'annoncer un
 * changement de ville qui déclencherait un géocodage inutile côté serveur.
 */
export function missionDiff(before: MissionInput, after: MissionInput) {
  const patch: MissionPatch = {};
  for (const key of Object.keys(after) as (keyof MissionInput)[]) {
    const a = before[key];
    const b = after[key];
    const same =
      Array.isArray(a) && Array.isArray(b)
        ? a.length === b.length && a.every((v, i) => v === b[i])
        : a === b;
    if (!same) Object.assign(patch, { [key]: b });
  }
  return patch;
}

/**
 * Contrôles tenus côté navigateur, uniquement ceux qui évitent un aller-retour
 * inutile ou qu'un message serveur exprimerait mal. Le serveur reste l'autorité :
 * tout ce qui passe ici sera revalidé, et ses refus sont affichés tels quels.
 */
export function validateMission(values: MissionFormValues) {
  const errors: Partial<Record<keyof MissionFormValues, string>> = {};
  if (!values.title.trim()) errors.title = "Donnez un intitulé à la mission.";
  if (!values.job) errors.job = "Choisissez le métier recherché.";
  if (!values.starts_at) errors.starts_at = "Indiquez le début de la mission.";
  if (!values.ends_at) errors.ends_at = "Indiquez la fin de la mission.";
  if (
    values.starts_at &&
    values.ends_at &&
    Date.parse(values.ends_at) <= Date.parse(values.starts_at)
  )
    errors.ends_at = "La fin doit suivre le début.";
  if (!values.city.trim()) errors.city = "Indiquez la ville de la mission.";
  if (!/^\d{5}$/.test(values.postal_code.trim()))
    errors.postal_code = "Un code postal compte cinq chiffres.";

  // Le montant et son unité vont par paire : l'un sans l'autre n'a pas de sens.
  const hasAmount = values.pay_amount.trim() !== "";
  const hasUnit = values.pay_unit !== "";
  if (hasAmount !== hasUnit)
    errors.pay_amount = hasAmount
      ? "Précisez si ce montant est horaire, journalier ou forfaitaire."
      : "Indiquez le montant correspondant à cette unité.";

  const headcount = Number(values.headcount);
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > 50)
    errors.headcount = "L’effectif va de 1 à 50 personnes.";
  return errors;
}
