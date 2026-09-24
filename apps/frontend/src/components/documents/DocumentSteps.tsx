import { Check } from "lucide-react";
import type { ContractListItem } from "../../services/documents";

/*
 * Parcours de validation d'un document, lisible d'un coup d'œil :
 *
 *   ✓ Généré ── ● Votre validation ── ○ Établissement ── ○ Finalisé
 *
 * Remplace le simple mot de statut : on voit OÙ en est le document et QUI
 * doit agir. Couleurs = système de niveaux (lib/levels.ts, tokens --level-*) :
 * - étape faite    → vert (niveau élevé) avec une coche ;
 * - étape en cours → ambre (niveau moyen), c'est là que ça attend ;
 * - document annulé → l'étape bloquée passe en rouge (niveau faible).
 *
 * L'ordre suit le serveur : l'intérimaire valide d'abord, puis
 * l'établissement, puis la finalisation. Seul le libellé change selon qui
 * regarde (« Votre validation » / « Intérimaire »).
 *
 * Accessibilité : vraie liste ordonnée, et chaque étape a son état en texte
 * pour les lecteurs d'écran (« fait », « en cours », « à venir »).
 */

type StepState = "done" | "current" | "todo" | "stopped";
type DocumentProgress = Pick<
  ContractListItem,
  "status" | "worker_signed_at" | "company_signed_at"
>;

export function documentSteps(
  document: DocumentProgress,
  role: "worker" | "company",
) {
  const { status } = document;
  const done = [
    status !== "draft",
    Boolean(document.worker_signed_at),
    Boolean(document.company_signed_at),
    status === "completed",
  ];
  const labels = [
    "Généré",
    role === "worker" ? "Votre validation" : "Intérimaire",
    role === "company" ? "Votre validation" : "Établissement",
    "Finalisé",
  ];
  const firstOpen = done.findIndex((value) => !value);
  return labels.map((label, index): { label: string; state: StepState } => {
    if (done[index]) return { label, state: "done" };
    if (index === firstOpen)
      return { label, state: status === "cancelled" ? "stopped" : "current" };
    return { label, state: "todo" };
  });
}

const SR_STATE: Record<StepState, string> = {
  done: "fait",
  current: "en cours",
  todo: "à venir",
  stopped: "arrêté",
};

export function DocumentSteps({
  document,
  role,
}: {
  document: DocumentProgress;
  role: "worker" | "company";
}) {
  const steps = documentSteps(document, role);
  return (
    <ol className="doc-steps" aria-label="Étapes de validation">
      {steps.map((step) => (
        <li key={step.label} className={`doc-steps__step is-${step.state}`}>
          <span className="doc-steps__dot" aria-hidden="true">
            {step.state === "done" && <Check size={10} strokeWidth={3.5} />}
          </span>
          <span className="doc-steps__label">{step.label}</span>
          <span className="sr-only"> : {SR_STATE[step.state]}</span>
        </li>
      ))}
    </ol>
  );
}
