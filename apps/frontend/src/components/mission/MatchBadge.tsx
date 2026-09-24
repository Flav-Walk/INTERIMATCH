import { cn } from "../../lib/cn";

/**
 * Compatibilité d'un profil avec une mission.
 *
 * LE NIVEAU N'EST PAS DÉDUIT DU SCORE AFFICHÉ. Cette pastille comparait
 * `score >= 70`, sur un nombre déjà arrondi. Un profil à 69,6 % s'affiche
 * « 70 % » : il était donc peint comme « très compatible » alors que le serveur
 * l'avait rangé dans la tranche 60–69, et le même écran annonçait les deux à la
 * fois. Le palier vient du backend, qui le calcule sur le score réel.
 *
 * CE QUI A CHANGÉ VISUELLEMENT. C'était une gélule colorée de plus, identique
 * en forme aux statuts, aux compétences et aux filtres : sur une carte qui en
 * portait déjà deux, plus rien ne se distinguait. C'est désormais un ARC —
 * une géométrie qu'aucun autre élément du produit n'emploie — dont le
 * remplissage suit le score, accompagné du nombre en chiffres tabulaires.
 *
 * Trois paliers, jamais un dégradé continu : un dégradé donnerait l'illusion
 * d'une précision que le score n'a pas. Il ordonne des candidatures, il ne
 * mesure pas une probabilité.
 */
export function MatchBadge({
  score,
  band,
  bandLabel,
  size = "normal",
  on = "light",
}: {
  score: number;
  /** Palier décidé par le serveur. `null` ou absent : sous le premier palier. */
  band?: number | null;
  /** Intitulé du palier, servi par le serveur. Jamais déduit du score. */
  bandLabel?: string | null;
  size?: "normal" | "large";
  /**
   * Fond sur lequel la pastille est posée.
   *
   * La fiche mission l'affiche sur un bandeau vert profond. Sans cette
   * variante, l'arc et le chiffre gardent leurs couleurs d'encre sombre et
   * deviennent illisibles — ce qui est exactement arrivé quand l'ancienne
   * gélule pleine, qui masquait le problème, a été retirée.
   */
  on?: "light" | "dark";
}) {
  const level = band === 70 ? "is-high" : band === 60 ? "is-mid" : "is-low";
  const large = size === "large";
  const diameter = large ? 40 : 28;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const bounded = Math.max(0, Math.min(100, score));

  const dark = on === "dark";
  const stroke = dark
    ? level === "is-low"
      ? "stroke-white/45"
      : "stroke-sage"
    : level === "is-high"
      ? "stroke-forest"
      : level === "is-mid"
        ? "stroke-sage-deep"
        : "stroke-ink-faint";
  const ink = dark
    ? "text-white"
    : level === "is-high"
      ? "text-forest"
      : level === "is-mid"
        ? "text-forest-mid"
        : "text-ink-faint";

  return (
    <span
      className={cn(
        "match-badge inline-flex items-center gap-2 align-middle",
        level,
        large && "is-large",
      )}
    >
      <span
        aria-hidden="true"
        className="relative shrink-0"
        style={{ width: diameter, height: diameter }}
      >
        <svg viewBox="0 0 32 32" className="size-full -rotate-90">
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            strokeWidth="3"
            className={dark ? "stroke-white/20" : "stroke-rule-strong"}
          />
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * bounded) / 100} ${circumference}`}
            className={cn(
              stroke,
              "transition-[stroke-dasharray] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            )}
          />
        </svg>
      </span>
      <span className={cn("leading-tight", ink)}>
        <span
          className={cn(
            "block font-semibold tabular-nums",
            large ? "text-[1.125rem]" : "text-[0.8125rem]",
          )}
        >
          Compatible à {score}&nbsp;%
        </span>
        {/* Le palier ne peut pas tenir à la seule couleur. Deux profils affichés
            « 70 % » — l'un à 70,2 %, l'autre à 69,6 % — portent le même nombre
            et des paliers différents : sans ce rappel, une synthèse vocale les
            restituerait à l'identique. Sur la grande taille, il est aussi
            visible, parce que la place le permet. */}
        {bandLabel &&
          (large ? (
            // Le tiret cadratin fait partie du TEXTE, pas de la mise en forme :
            // « Compatible à 100 % — Très compatibles » se lit d'une traite, et
            // c'est cette phrase entière que la recette entreprise vérifie.
            <span
              className={cn(
                "block text-[0.8125rem]",
                dark ? "text-white/65" : "text-ink-faint",
              )}
            >
              {" — "}
              {bandLabel}
            </span>
          ) : (
            <span className="sr-only"> — {bandLabel}</span>
          ))}
      </span>
    </span>
  );
}
