/**
 * Règles de complétion du profil intérimaire — source unique.
 *
 * `profiles.onboarding_completed` n'est jamais envoyé par le client : il est
 * recalculé par le serveur après chaque écriture, dans la même transaction.
 * Un champ obligatoire qui redevient vide fait repasser le profil à `false`.
 *
 * Chaque règle est justifiée, et rien d'autre n'est exigé :
 *
 * | Règle                      | Justification                                        |
 * | -------------------------- | ---------------------------------------------------- |
 * | prénom + nom               | cahier §7.2, identité affichée à l'entreprise         |
 * | ville + code postal        | cahier §7.2, et localisation du scoring (D04, 25 pts) |
 * | rayon de mobilité          | cahier §7.2, borne la distance acceptable (D04)       |
 * | métier principal           | cahier §7.2 « métiers »                               |
 * | au moins une compétence    | D04 : compétences = 45 pts, le poids le plus lourd    |
 * | au moins un créneau à venir| D04 éligibilité : sans disponibilité, jamais éligible |
 *
 * Volontairement **non** obligatoires : latitude/longitude (données techniques
 * dérivées du géocodage, jamais saisies), téléphone (« si retenu » au cahier),
 * métiers secondaires, expériences, certifications, permis, véhicule
 * (enrichissements), et `open_to_missions` — un profil peut être complet alors
 * que son titulaire met sa recherche en pause.
 */

export interface CompletionInput {
  first_name: string;
  last_name: string;
  city: string | null;
  postal_code: string | null;
  mobility_radius_km: number | null;
  main_job: string | null;
  skill_count: number;
  upcoming_availability_count: number;
}

export type CompletionRule =
  | "identity"
  | "location"
  | "mobility_radius"
  | "main_job"
  | "skills"
  | "availability";

const filled = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;

/** Règles non satisfaites, dans l'ordre du parcours utilisateur. */
export function missingRules(input: CompletionInput): CompletionRule[] {
  const missing: CompletionRule[] = [];
  if (!filled(input.first_name) || !filled(input.last_name))
    missing.push("identity");
  if (!filled(input.city) || !/^\d{5}$/.test(input.postal_code ?? ""))
    missing.push("location");
  if (
    input.mobility_radius_km === null ||
    input.mobility_radius_km === undefined
  )
    missing.push("mobility_radius");
  if (!filled(input.main_job)) missing.push("main_job");
  if (input.skill_count < 1) missing.push("skills");
  if (input.upcoming_availability_count < 1) missing.push("availability");
  return missing;
}

export const isProfileComplete = (input: CompletionInput) =>
  missingRules(input).length === 0;

/** Libellés destinés à l'interface : ce qu'il reste concrètement à faire. */
export const ruleLabels: Record<CompletionRule, string> = {
  identity: "Votre prénom et votre nom",
  location: "Votre ville et votre code postal",
  mobility_radius: "Votre rayon de mobilité",
  main_job: "Votre métier principal",
  skills: "Au moins une compétence",
  availability: "Au moins une disponibilité à venir",
};
