import type { CSSProperties } from "react";
import type { CompletionRule } from "../../services/session";
import { requirementLabels } from "../../services/profile";
import { levelFromPercent } from "../../lib/levels";

/*
 * Prérequis missions : jauge SIMPLE (retour de revue).
 *
 * Historique : fer à cheval « 100 » puis barre à 6 segments, refusés tous
 * les deux. On garde le plus lisible : une seule barre horizontale continue,
 * avec au-dessus le libellé et le pourcentage, et en dessous une ligne
 * courte (« Tous réunis » / « 1 à compléter : disponibilité »).
 *
 * Couleur : système de niveaux (lib/levels.ts) — vert à 100 %, ambre dès
 * 50 %, rouge en dessous. Le pourcentage reste écrit : la couleur ne porte
 * jamais l'information seule.
 *
 * La barre se remplit au chargement (coupé si « Réduire les animations »).
 * Le lecteur d'écran lit une phrase entière (role="img" + aria-label).
 */

/** Noms courts, pour la ligne « à compléter ». */
const SHORT: Record<CompletionRule, string> = {
  identity: "identité",
  location: "ville",
  mobility_radius: "rayon de mobilité",
  main_job: "métier",
  skills: "compétence",
  availability: "disponibilité",
};

export function RequirementMeter({
  missing,
  variant = "light",
}: {
  missing: CompletionRule[];
  /** « on-dark » sur la photo verte du bandeau. */
  variant?: "light" | "on-dark";
}) {
  const rules = Object.keys(requirementLabels) as CompletionRule[];
  const todo = rules.filter((rule) => missing.includes(rule));
  const percent = Math.round(((rules.length - todo.length) / rules.length) * 100);
  // Couleur de la barre : système de niveaux (vert / ambre / rouge).
  const level = levelFromPercent(percent);
  const summary =
    todo.length === 0
      ? "Tous réunis"
      : `${todo.length} à compléter : ${todo.map((rule) => SHORT[rule]).join(", ")}`;

  return (
    <div
      className={`requirement-meter requirement-meter--${variant} is-${level}`}
      role="img"
      aria-label={`Prérequis missions : ${percent} %. ${summary}.`}
    >
      <p className="requirement-meter__head" aria-hidden="true">
        <span className="requirement-meter__label">Prérequis missions</span>
        <strong className="requirement-meter__value">{percent} %</strong>
      </p>
      <span
        className="requirement-meter__track"
        style={{ "--value": `${percent}%` } as CSSProperties}
        aria-hidden="true"
      >
        <span className="requirement-meter__fill" />
      </span>
      <p className="requirement-meter__summary" aria-hidden="true">
        {summary}
      </p>
    </div>
  );
}
