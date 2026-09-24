import { Check, Slash } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";

/**
 * Suivi d'une candidature, étape par étape.
 *
 * SOURCE : SmoothUI — `animated-stepper` (https://smoothui.dev/docs/components/animated-stepper),
 * récupéré depuis https://smoothui.dev/r/animated-stepper.json. Licence MIT.
 * On en reprend la structure — pastilles numérotées, trait de progression
 * animé par ressort, coche dessinée à l'arrivée — et le traitement du
 * `prefers-reduced-motion`.
 *
 * CE QUI A ÉTÉ ADAPTÉ, ET POURQUOI C'ÉTAIT NÉCESSAIRE.
 * Le stepper d'origine décrit un formulaire : les étapes se franchissent en
 * avançant, et l'on peut revenir en arrière. Une candidature ne marche pas
 * comme ça. Elle peut s'ARRÊTER : un refus, une annulation. Il a donc fallu
 * ajouter un quatrième état — `failed` — que la source ne connaît pas, avec sa
 * géométrie propre (contour barré, jamais de coche) et un trait qui s'arrête
 * net au lieu de se remplir. Sans cela, une candidature refusée se serait
 * affichée comme une candidature en cours d'examen.
 *
 * L'ordre des étapes suit le cycle réel, et il n'est jamais déduit ici : le
 * statut vient du serveur, la temporalité de `missionTemporalState`, et
 * `workerMissionContext` en tire déjà la conclusion. Ce composant met en forme,
 * il ne conclut pas.
 */

export type TrackState = "done" | "current" | "todo" | "failed";

export interface TrackStep {
  label: string;
  /** Précision datée ou circonstancielle. Absente quand il n'y a rien à dire. */
  detail?: string;
  state: TrackState;
}

export function ApplicationTrack({
  steps,
  className,
}: {
  steps: TrackStep[];
  className?: string;
}) {
  const still = useReducedMotion();

  // Le trait se remplit jusqu'à la dernière étape franchie. Une étape en cours
  // compte pour une demie : le trait s'arrête sous la pastille active, ce qui
  // se lit « on en est là », et non « c'est terminé ».
  const lastDone = steps.reduce(
    (acc, step, index) => (step.state === "done" ? index : acc),
    -1,
  );
  const currentIndex = steps.findIndex((s) => s.state === "current");
  const failedIndex = steps.findIndex((s) => s.state === "failed");
  const reached =
    failedIndex >= 0
      ? failedIndex
      : currentIndex >= 0
        ? currentIndex
        : lastDone;
  const progress =
    steps.length > 1 ? Math.max(0, reached) / (steps.length - 1) : 0;

  return (
    <ol className={cn("im-bare relative flex", className)}>
      {/* Rail. Il court entre les CENTRES des pastilles extrêmes, pas d'un bord
          à l'autre : un trait qui dépasse sous la dernière pastille laisse
          croire à une étape supplémentaire. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[11px] right-0 left-0 mx-[calc(100%/var(--im-steps)/2)] h-[2px] rounded-full bg-rule-strong"
        style={{ "--im-steps": steps.length } as React.CSSProperties}
      >
        <motion.span
          className={cn(
            "block h-full rounded-full",
            failedIndex >= 0 ? "bg-rule-strong" : "bg-forest",
          )}
          initial={still ? false : { scaleX: 0 }}
          animate={{ scaleX: progress }}
          style={{ originX: 0 }}
          transition={
            still
              ? { duration: 0 }
              : { type: "spring", bounce: 0.05, duration: 0.6 }
          }
        />
      </span>

      {steps.map((step, index) => (
        <li
          key={step.label + index}
          className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-paper transition-colors duration-300",
              step.state === "done" && "border-forest bg-forest text-white",
              step.state === "current" && "border-forest bg-surface text-forest",
              step.state === "todo" && "border-rule-strong bg-surface",
              step.state === "failed" &&
                "border-ink-faint bg-surface text-ink-faint",
            )}
          >
            {step.state === "done" && <Check size={13} strokeWidth={3} />}
            {step.state === "failed" && <Slash size={12} strokeWidth={2.5} />}
            {/* L'étape en cours bat doucement : c'est le seul point de la
                frise qui attend quelque chose de quelqu'un. */}
            {step.state === "current" && (
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-forest opacity-60 [animation-duration:2.4s]" />
                <span className="relative inline-flex size-1.5 rounded-full bg-forest" />
              </span>
            )}
          </span>

          <span className="min-w-0">
            <span
              className={cn(
                "block text-[0.75rem] font-semibold leading-tight",
                step.state === "todo" || step.state === "failed"
                  ? "text-ink-faint"
                  : "text-ink",
              )}
            >
              {step.label}
            </span>
            {step.detail && (
              <span className="mt-0.5 block text-[0.6875rem] text-ink-faint leading-tight">
                {step.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
