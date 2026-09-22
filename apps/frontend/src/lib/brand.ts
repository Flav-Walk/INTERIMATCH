/**
 * Réglages communs des composants importés, aux couleurs InteriMatch.
 *
 * Ce fichier est à nous (pas copié d'une bibliothèque) : c'est ici qu'on
 * « réadapte les couleurs », sans toucher au code des composants.
 */

/** Magic Card (Magic UI) : bordure orange → vert, halo orange très léger. */
export const MAGIC_CARD_COLORS = {
  gradientSize: 220,
  gradientFrom: "var(--orange)",
  gradientTo: "var(--forest)",
  gradientColor: "oklch(0.75 0.17 43 / 0.10)",
  gradientOpacity: 1,
} as const;
