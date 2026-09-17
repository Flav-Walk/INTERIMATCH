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

/** Libellés des règles de complétion, alignés sur completion.ts côté serveur. */
export const requirementLabels: Record<CompletionRule, string> = {
  identity: "Votre prénom et votre nom",
  location: "Votre ville et votre code postal",
  mobility_radius: "Votre rayon de mobilité",
  main_job: "Votre métier principal",
  skills: "Au moins une compétence",
  availability: "Au moins une disponibilité à venir",
};

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
