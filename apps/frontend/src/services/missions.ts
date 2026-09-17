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
}

/**
 * Missions offertes, toutes entreprises confondues, de la plus proche à la plus
 * lointaine. Aucun classement par affinité : le rapprochement viendra ensuite,
 * et ordonnera cette même liste sans changer l'appel.
 */
export const listOpenMissions = () =>
  api<{ missions: OpenMission[] }>("/workers/me/missions");

export const getOpenMission = (id: string) =>
  api<OpenMission>("/workers/me/missions/" + id);

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
