import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Statut d'une candidature ou d'une mission, dessiné comme une petite frise
 * au lieu d'un badge (retour de revue : les badges « ● Mission confirmée »
 * faisaient trop « UI générée »).
 *
 * Inspiré de l'Animated Timeline d'Animata
 * (https://animata.design/docs/progress/animatedtimeline), mis à l'horizontale
 * et réduit pour tenir dans une ligne de liste :
 *
 *   ●───●───○  En attente        (envoyée, en cours d'examen)
 *   ●───●───●  Acceptée          (tout est allumé, en vert)
 *   ●───●───✕  Non retenue       (la dernière étape est barrée)
 *
 * Comme dans Animata : les ronds s'allument l'un après l'autre et le trait
 * se remplit entre eux (cascade avec un petit délai par étape).
 *
 * Accessibilité : la frise est décorative (aria-hidden). Le libellé à côté
 * reste un vrai texte, lu par les lecteurs d'écran et vérifié par les tests
 * e2e (« Acceptée », « En attente »…).
 */

export type TrackTone = "pending" | "done" | "stopped" | "idle";

const STEP_DELAY = 0.12;

export function StatusTrack({
  steps = 3,
  reached,
  tone,
  label,
  className,
}: {
  /** Nombre de ronds. */
  steps?: number;
  /** Combien de ronds sont allumés (1 à steps). */
  reached: number;
  tone: TrackTone;
  label: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  // Couleur des étapes allumées selon l'état.
  const on =
    tone === "done"
      ? "bg-forest border-forest"
      : tone === "stopped"
        ? "bg-muted-foreground border-muted-foreground"
        : tone === "idle"
          ? "bg-muted-foreground/60 border-muted-foreground/60"
          : "bg-orange-ink border-orange-ink";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex items-center" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => {
          const lit = i < reached;
          const last = i === steps - 1;
          // La dernière étape d'un refus est un ✕, d'un accord une coche.
          const icon =
            last && lit && tone === "stopped" ? (
              <X size={8} strokeWidth={4} />
            ) : last && lit && tone === "done" ? (
              <Check size={8} strokeWidth={4} />
            ) : null;
          return (
            <span key={i} className="flex items-center">
              <motion.span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full border-2 text-white",
                  lit ? on : "border-border bg-surface",
                  // L'étape en cours (dernière allumée d'une attente) pulse.
                  tone === "pending" && i === reached - 1 && !reduceMotion && "animate-pulse",
                )}
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * STEP_DELAY, type: "spring", stiffness: 420, damping: 22 }}
              >
                {icon}
              </motion.span>
              {!last && (
                // Le trait entre deux ronds : gris, et rempli s'il mène à une
                // étape allumée.
                <span className="relative block h-0.5 w-4 bg-border">
                  <motion.span
                    className={cn("absolute inset-0 block origin-left", i + 1 < reached ? on.split(" ")[0] : "")}
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * STEP_DELAY + 0.06, duration: 0.18 }}
                  />
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span
        className={cn(
          "text-sm font-semibold whitespace-nowrap",
          tone === "done" ? "text-forest" : tone === "pending" ? "text-orange-ink" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}
