/**
 * Pastille de compatibilité.
 *
 * Trois niveaux seulement, alignés sur les paliers du rapprochement : au-delà
 * de 70, entre 60 et 70, en dessous. Un dégradé continu donnerait l'illusion
 * d'une précision que le score n'a pas — il ordonne des candidatures, il ne
 * mesure pas une probabilité.
 */
export function MatchBadge({
  score,
  size = "normal",
}: {
  score: number;
  size?: "normal" | "large";
}) {
  const level = score >= 70 ? "is-high" : score >= 60 ? "is-mid" : "is-low";
  return (
    <span
      className={`match-badge ${level}${size === "large" ? " is-large" : ""}`}
    >
      Compatible à {score}&nbsp;%
    </span>
  );
}
