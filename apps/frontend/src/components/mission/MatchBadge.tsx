import { ScoreGauge } from "../da/ScoreGauge";

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
 * NOUVELLE DA : plus de pastille colorée. Une jauge en fer à cheval
 * (Gauge Chart d'Animata, via da/ScoreGauge) avec le score écrit au centre,
 * puis « Compatible ». La couleur suit le palier du serveur (vert foncé, vert
 * moyen, gris), jamais le score arrondi.
 *
 * Le texte complet « Compatible à 92 % » reste dans la page (sr-only) : c'est
 * lui que lisent les lecteurs d'écran et que vérifient les tests.
 */
const TONE = { "is-high": "forest", "is-mid": "mid", "is-low": "muted" } as const;
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
      <ScoreGauge value={score} tone={TONE[level]} size={size === "large" ? 52 : 40} />
      <span className="match-badge__text" aria-hidden="true">
        <strong>Compatible</strong>
        {bandLabel && <small>{bandLabel}</small>}
      </span>
      <span className="sr-only">Compatible à {score}&nbsp;%</span>
      {/* Le palier ne peut pas tenir à la seule couleur. Deux profils affichés
          « 70 % » — l'un à 70,2 %, l'autre à 69,6 % — portent le même nombre et
          des paliers différents : sans ce rappel, une synthèse vocale les
          restituerait à l'identique. */}
      {bandLabel && <span className="sr-only"> — {bandLabel}</span>}
    </span>
  );
}
