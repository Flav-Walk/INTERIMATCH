import { AnimatedCircularProgressBar } from "../ui/animated-circular-progress-bar";

/**
 * Pastille de compatibilité — purement présentationnelle.
 *
 * Trois niveaux, alignés sur les paliers du rapprochement. Un dégradé continu
 * donnerait l'illusion d'une précision que le score n'a pas : il ordonne des
 * candidatures, il ne mesure pas une probabilité.
 *
 * LE NIVEAU N'EST PLUS DÉDUIT DU SCORE AFFICHÉ. Cette pastille comparait
 * `score >= 70`, sur un nombre déjà arrondi. Un profil à 69,6 % s'affiche
 * « 70 % » : il était donc peint comme « très compatible » alors que le serveur
 * l'avait rangé dans la tranche 60–69, et le même écran annonçait les deux à la
 * fois. Le palier vient désormais du backend, qui le calcule sur le score réel.
 *
 * NOUVELLE DA : plus de pastille colorée (retour de revue sur les badges).
 * Un petit anneau de progression (Animated Circular Progress Bar, Magic UI)
 * se remplit jusqu'au score, suivi du texte. La couleur de l'anneau suit le
 * palier du serveur (vert foncé, vert moyen, gris), jamais le score arrondi.
 */
const RING = {
  "is-high": "var(--forest)",
  "is-mid": "var(--forest-mid)",
  "is-low": "var(--muted)",
} as const;
export function MatchBadge({
  score,
  band,
  bandLabel,
  size = "normal",
}: {
  score: number;
  /** Palier décidé par le serveur. `null` ou absent : sous le premier palier. */
  band?: number | null;
  /** Intitulé du palier, servi par le serveur. Jamais déduit du score. */
  bandLabel?: string | null;
  size?: "normal" | "large";
}) {
  const level = band === 70 ? "is-high" : band === 60 ? "is-mid" : "is-low";
  return (
    <span
      className={`match-badge ${level}${size === "large" ? " is-large" : ""}`}
    >
      {/* Anneau décoratif : le texte à côté dit déjà le score. */}
      <span className="match-badge__ring" aria-hidden="true">
        <AnimatedCircularProgressBar
          value={score}
          gaugePrimaryColor={RING[level]}
          gaugeSecondaryColor="oklch(0.32 0.065 165 / 0.12)"
        />
      </span>
      Compatible à {score}&nbsp;%
      {/* Le palier ne peut pas tenir à la seule couleur. Deux profils affichés
          « 70 % » — l'un à 70,2 %, l'autre à 69,6 % — portent le même nombre et
          des paliers différents : sans ce rappel, une synthèse vocale les
          restituerait à l'identique. */}
      {bandLabel && <span className="sr-only"> — {bandLabel}</span>}
    </span>
  );
}
