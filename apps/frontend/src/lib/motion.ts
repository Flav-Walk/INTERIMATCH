import type { Variants } from "motion/react";

/*
 * Réglages d'animation communs (Motion), pour que toutes les pages bougent
 * de la même façon. Utilisés par la connexion et la page mission.
 */

/** Courbe douce : ça démarre vite, puis ça freine en douceur. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Conteneur qui lance ses enfants l'un après l'autre (stagger). */
export const cascade: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

/** Un bloc qui monte de 14 px en sortant d'un léger flou. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE },
  },
};

/** Une pastille qui apparaît avec un petit rebond. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 22 },
  },
};

/**
 * Props pour révéler un bloc quand il entre à l'écran (une seule fois).
 * margin négatif : l'animation démarre un peu après l'entrée, quand le bloc
 * est vraiment visible.
 */
export const revealOnScroll = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "0px 0px -60px 0px" },
} as const;
