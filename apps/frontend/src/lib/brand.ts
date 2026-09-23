/**
 * Couleurs InteriMatch pour la Magic Card (Magic UI).
 *
 * La Magic Card a des couleurs violet/rose par défaut. Plutôt que de modifier
 * son code, je lui passe nos couleurs par ses props, depuis ce fichier. Si on
 * veut changer l'effet des cartes un jour, c'est ici et nulle part ailleurs.
 */
export const MAGIC_CARD_COLORS = {
  // Taille du halo autour de la souris, en pixels.
  gradientSize: 220,
  // La bordure passe de l'orange (près du curseur) au vert.
  gradientFrom: "var(--orange)",
  gradientTo: "var(--forest)",
  // Lueur à l'intérieur de la carte : orange très transparent (10 %),
  // pour ne pas gêner la lecture du texte.
  gradientColor: "oklch(0.75 0.17 43 / 0.10)",
  gradientOpacity: 1,
} as const;
