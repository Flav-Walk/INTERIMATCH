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
/**
 * Photo de profil.
 *
 * Le corps EST l'image. Le client ne décrit ni chemin ni URL : le serveur
 * décide du nom de l'objet, en dérive l'adresse publique, et renvoie le profil
 * complet — donc la nouvelle URL et les règles de complétion recalculées. Rien
 * n'est à recomposer ici, et rien ne peut donc diverger.
 *
 * Les deux appels renvoient l'utilisateur à jour : l'écran n'a pas de seconde
 * lecture à faire, ni d'état local à réconcilier.
 */
export const uploadAvatar = async (file: File) =>
  api<User>("/workers/me/avatar", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: await file.arrayBuffer(),
  });

export const removeAvatar = () =>
  api<User>("/workers/me/avatar", { method: "DELETE" });

/** 2 Mio, comme le serveur. Le dire ici évite un aller-retour pour rien. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Contrôles tenus avant d'envoyer quoi que ce soit.
 *
 * Le serveur revérifie tout, et sur les OCTETS plutôt que sur le type déclaré :
 * ce qui est fait ici ne protège de rien, cela évite seulement de téléverser
 * deux méga-octets pour s'entendre répondre non.
 */
export function avatarRejectionReason(file: File): string | null {
  if (!(ACCEPTED_AVATAR_TYPES as readonly string[]).includes(file.type))
    return "Formats acceptés : JPEG, PNG ou WebP.";
  if (file.size > MAX_AVATAR_BYTES)
    return "La photo ne doit pas dépasser 2 Mo.";
  if (file.size === 0) return "Ce fichier est vide.";
  return null;
}

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
  photo: "Une photo de profil",
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
  photo: "Votre photo",
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

/**
 * Couverture d'un mois par les créneaux déclarés.
 *
 * Un créneau InteriMatch n'est pas une case de calendrier : c'est un INTERVALLE
 * daté, qui peut couvrir trois heures comme trois mois. Pour peindre un
 * calendrier, il faut donc savoir, pour chaque jour, ce que les intervalles
 * disent de lui — et ils peuvent se contredire : une disponibilité longue et
 * une indisponibilité ponctuelle le même jour.
 *
 * Trois réponses possibles, et la troisième est la seule honnête quand les deux
 * autres cohabitent :
 *   `available`   — le jour n'est couvert que par des créneaux disponibles ;
 *   `unavailable` — il n'est couvert que par des indisponibilités ;
 *   `mixed`       — les deux, et le calendrier doit le montrer plutôt que de
 *                   choisir.
 *
 * AUCUNE RÈGLE MÉTIER N'EST REJOUÉE. Le serveur reste seul juge de ce qui rend
 * un profil éligible ; cette fonction ne fait que projeter des intervalles sur
 * des jours, pour les donner à voir.
 */
export type DayCoverage = "available" | "unavailable" | "mixed";

export function coverageByDay(
  slots: Availability[] | undefined,
  year: number,
  month: number,
): Map<number, DayCoverage> {
  const days = new Map<number, DayCoverage>();
  if (!slots) return days;
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();

  for (const slot of slots) {
    const from = Date.parse(slot.starts_at);
    const to = Date.parse(slot.ends_at);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    // Hors du mois affiché : rien à peindre.
    if (to <= monthStart || from >= monthEnd) continue;

    // On parcourt les jours civils locaux touchés par l'intervalle. La borne de
    // fin est EXCLUSIVE : un créneau qui s'arrête à minuit pile ne colore pas
    // le jour suivant, exactement comme il n'engage personne ce jour-là.
    const first = new Date(Math.max(from, monthStart));
    first.setHours(0, 0, 0, 0);
    for (
      const cursor = new Date(first);
      cursor.getTime() < Math.min(to, monthEnd);
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (cursor.getMonth() !== month || cursor.getFullYear() !== year)
        continue;
      const day = cursor.getDate();
      const previous = days.get(day);
      const current: DayCoverage =
        slot.status === "available" ? "available" : "unavailable";
      days.set(day, !previous || previous === current ? current : "mixed");
    }
  }
  return days;
}

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
