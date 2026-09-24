import { ScoreBar } from "../da/ScoreBar";
import { levelFromBand } from "../../lib/levels";

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
 * NOUVELLE DA : plus de pastille colorée ni de jauge en fer à cheval (jugée
 * « nulle » en revue). Une barre fine (da/ScoreBar) avec les repères des
 * paliers 60 et 70 %, puis « Compatible à 92 % ». La couleur suit le palier
 * du serveur via le système de niveaux (vert / ambre / rouge, voir
 * lib/levels.ts et les tokens --level-*), jamais le score arrondi.
 *
 * Le texte du badge reste exactement « Compatible à 92 % — palier » : les
 * tests e2e le comparent mot pour mot (le chiffre de la jauge est dessiné en
 * CSS, hors du texte).
 */
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
  // Système de niveaux commun (lib/levels.ts) : vert / ambre / rouge.
  const level = `is-${levelFromBand(band)}`;
  return (
    <span
      className={`match-badge ${level}${size === "large" ? " is-large" : ""}`}
    >
      <ScoreBar value={score} large={size === "large"} />
      <span className="match-badge__text">Compatible à {score}&nbsp;%</span>
      {/* Le palier ne peut pas tenir à la seule couleur. Deux profils affichés
          « 70 % » — l'un à 70,2 %, l'autre à 69,6 % — portent le même nombre et
          des paliers différents : sans ce rappel, une synthèse vocale les
          restituerait à l'identique. */}
      {bandLabel && <span className="sr-only"> — {bandLabel}</span>}
    </span>
  );
}
