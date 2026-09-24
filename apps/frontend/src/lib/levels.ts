/**
 * Système de niveaux des jauges : élevé / moyen / faible.
 *
 * Une seule source pour décider la couleur d'une jauge, partout sur le site.
 * Les couleurs elles-mêmes sont dans styles/tokens.css (--level-*), les
 * composants ajoutent seulement la classe `is-high` / `is-mid` / `is-low`.
 */
export type Level = "high" | "mid" | "low";

/**
 * Prérequis du profil (0 à 100 %).
 * 100 % : tout est réuni → élevé. Au moins la moitié → moyen. Sinon faible.
 */
export function levelFromPercent(percent: number): Level {
  if (percent >= 100) return "high";
  if (percent >= 50) return "mid";
  return "low";
}

/**
 * Compatibilité d'une mission : le PALIER vient du serveur, jamais du score
 * arrondi (un 69,6 % affiché « 70 % » reste dans le palier 60).
 */
export function levelFromBand(band: number | null | undefined): Level {
  if (band === 70) return "high";
  if (band === 60) return "mid";
  return "low";
}
