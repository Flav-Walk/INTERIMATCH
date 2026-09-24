/*
 * Bouton d'envoi à 3 états, animé avec Motion :
 *   idle    → le libellé normal (« Me connecter ») ;
 *   busy    → un anneau qui tourne + « Connexion… » ;
 *   success → une coche qui se dessine + « Connecté ».
 *
 * AnimatePresence fait sortir l'ancien contenu (vers le haut, en fondu)
 * pendant que le nouveau arrive (par le bas). mode="popLayout" : le nouveau
 * contenu n'attend pas la fin de la sortie, l'enchaînement reste vif.
 * Au clic, le bouton s'enfonce légèrement (whileTap).
 *
 * « Réduire les animations » : on garde le changement de texte, sans
 * mouvement.
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "../../lib/utils";

export type SubmitState = "idle" | "busy" | "success";

interface SubmitButtonProps {
  state: SubmitState;
  children: ReactNode;
  busyLabel?: string;
  successLabel?: string;
  className?: string;
}

export function SubmitButton({
  state,
  children,
  busyLabel = "Veuillez patienter…",
  successLabel = "C’est fait",
  className,
}: SubmitButtonProps) {
  const reduceMotion = useReducedMotion();
  // Chaque contenu entre par le bas et sort par le haut.
  const swap = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -14, filter: "blur(4px)" },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <motion.button
      type="submit"
      disabled={state !== "idle"}
      aria-busy={state === "busy"}
      whileTap={reduceMotion || state !== "idle" ? undefined : { scale: 0.97 }}
      className={cn(
        "submit-button relative overflow-hidden",
        state === "success" && "submit-button--success",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {state === "idle" && (
          <motion.span key="idle" className="submit-button__content" {...swap}>
            {children}
          </motion.span>
        )}
        {state === "busy" && (
          <motion.span key="busy" className="submit-button__content" {...swap}>
            {/* Anneau de chargement : un cercle dont un quart est visible. */}
            <motion.svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            >
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </motion.svg>
            {busyLabel}
          </motion.span>
        )}
        {state === "success" && (
          <motion.span key="success" className="submit-button__content" {...swap}>
            {/* Coche qui se dessine (pathLength de 0 à 1). */}
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <motion.path
                d="M5 12.5l4.2 4.2L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
              />
            </svg>
            {successLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
