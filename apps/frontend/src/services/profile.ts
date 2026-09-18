import {
  api,
  type Availability,
  type CompletionRule,
  type User,
} from "./session";

/**
 * Appels du profil intérimaire. Toutes les écritures renvoient le profil complet
 * recalculé par le serveur — y compris `onboarding_completed`, que l'interface
 * se contente d'afficher et n'envoie jamais.
 */
export const patchWorker = (body: Record<string, unknown>) =>
  api<User>("/workers/me", { method: "PATCH", body: JSON.stringify(body) });

export const putSkills = (skill_ids: string[]) =>
  api<User>("/workers/me/skills", {
    method: "PUT",
    body: JSON.stringify({ skill_ids }),
  });

export const putExperiences = (
  experiences: { job_title: string; employer: string; years: number }[],
) =>
  api<User>("/workers/me/experiences", {
    method: "PUT",
    body: JSON.stringify({ experiences }),
  });

export const putCertifications = (
  certifications: {
    name: string;
    issuer: string;
    obtained_on: string | null;
  }[],
) =>
  api<User>("/workers/me/certifications", {
    method: "PUT",
    body: JSON.stringify({ certifications }),
  });

export const addAvailability = (slot: {
  starts_at: string;
  ends_at: string;
  status: "available" | "unavailable";
}) =>
  api<Availability>("/workers/me/availabilities", {
    method: "POST",
    body: JSON.stringify(slot),
  });

export const updateAvailability = (
  id: string,
  slot: Partial<Omit<Availability, "id">>,
) =>
  api<Availability>("/workers/me/availabilities/" + id, {
    method: "PATCH",
    body: JSON.stringify(slot),
  });

export const removeAvailability = (id: string) =>
  api<void>("/workers/me/availabilities/" + id, { method: "DELETE" });

/**
 * Retire les champs vides d'une modification partielle.
 *
 * Les sections du profil regroupent des champs indépendants : cocher un métier
 * secondaire ne doit pas exiger d'avoir déjà choisi son métier principal. On
 * n'envoie donc que ce qui est réellement renseigné, et `PATCH /workers/me`
 * laisse le reste intact. Les règles métier du serveur ne changent pas : un
 * profil sans métier principal reste incomplet.
 *
 * `null` est conservé : c'est un effacement volontaire (téléphone, expérience).
 */
export function partial(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (value === undefined) return false;
      if (typeof value === "string") return value.trim() !== "";
      if (typeof value === "number") return Number.isFinite(value);
      return true;
    }),
  );
}

/** Noms des champs de l'API vers les libellés affichés dans le formulaire. */
const fieldLabels: Record<string, string> = {
  first_name: "Prénom",
  last_name: "Nom",
  phone: "Téléphone",
  main_job: "Métier principal",
  secondary_jobs: "Autres métiers exercés",
  years_experience: "Années d’expérience",
  city: "Ville",
  postal_code: "Code postal",
  mobility_radius_km: "Rayon de mobilité",
  has_driving_licence: "Permis de conduire",
  has_vehicle: "Véhicule",
  skill_ids: "Compétences",
  experiences: "Expériences",
  certifications: "Certifications",
  starts_at: "Début",
  ends_at: "Fin",
  status: "Statut",
};

/**
 * Le serveur nomme les champs invalides avec leurs identifiants d'API. On les
 * remplace par les libellés que l'utilisateur voit à l'écran, pour qu'il sache
 * quoi corriger sans deviner.
 */
export function humaniseError(message: string) {
  const match = /^Donnée invalide : (.+)\.$/.exec(message);
  if (!match) return message;
  const labels = match[1]
    .split(", ")
    .map((field) => fieldLabels[field.split(".")[0]] ?? field);
  return labels.length > 1
    ? `Vérifiez ces champs : ${labels.join(", ")}.`
    : `Vérifiez le champ « ${labels[0]} ».`;
}

/** Libellés des règles de complétion, alignés sur completion.ts côté serveur. */
export const requirementLabels: Record<CompletionRule, string> = {
  identity: "Votre prénom et votre nom",
  location: "Votre ville et votre code postal",
  mobility_radius: "Votre rayon de mobilité",
  main_job: "Votre métier principal",
  skills: "Au moins une compétence",
  availability: "Au moins une disponibilité à venir",
};

/**
 * Quelle section porte chaque exigence de complétion.
 *
 * Le profil annonçait ce qui manquait en haut de page, puis laissait chercher :
 * six blocs à parcourir pour retrouver lequel est concerné. La correspondance
 * vit ici, à côté des libellés, pour que les deux ne se contredisent pas.
 */
export const requirementSections: Record<CompletionRule, string> = {
  identity: "Votre identité",
  location: "Votre mobilité",
  mobility_radius: "Votre mobilité",
  main_job: "Votre métier",
  skills: "Vos compétences",
  availability: "Vos disponibilités",
};

/** Exigences non satisfaites portant sur une section donnée. */
export const missingIn = (
  missing: CompletionRule[] | undefined,
  section: string,
) => (missing ?? []).filter((rule) => requirementSections[rule] === section);

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** « lun. 12 janv. · 16:00 – 22:00 » */
export function formatSlot(slot: Availability) {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);
  const endDate =
    start.toDateString() === end.toDateString()
      ? ""
      : `${dateFormat.format(end)} · `;
  return `${dateFormat.format(start)} · ${timeFormat.format(start)} – ${endDate}${timeFormat.format(end)}`;
}

export const isUpcoming = (slot: Availability) =>
  new Date(slot.ends_at).getTime() > Date.now();

/** Créneaux disponibles à venir, du plus proche au plus lointain. */
export function upcomingAvailabilities(slots: Availability[] | undefined) {
  return (slots ?? [])
    .filter((s) => s.status === "available" && isUpcoming(s))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/**
 * « Disponible à partir du … » n'est pas stocké : la date se déduit du premier
 * créneau disponible à venir. Une seule source décrit le « quand ».
 */
export function availableFrom(slots: Availability[] | undefined) {
  const next = upcomingAvailabilities(slots)[0];
  if (!next) return null;
  const start = new Date(next.starts_at);
  return start.getTime() <= Date.now() ? "immediate" : start.toISOString();
}

/** Valeur d'un input datetime-local à partir d'une date ISO UTC. */
export function toLocalInput(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
