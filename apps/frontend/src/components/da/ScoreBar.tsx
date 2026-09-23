import type { CSSProperties } from "react";

/*
 * Compatibilité d'une mission : remplace la jauge en fer à cheval.
 *
 * Une barre fine, à côté du texte « Compatible à 92 % » qui porte déjà le
 * chiffre : la barre donne l'ordre de grandeur d'un coup d'œil, sans
 * redire le nombre. (Les repères 60 / 70 % ont été retirés : sans légende,
 * ils n'étaient pas compris.)
 *
 * La couleur suit le système de niveaux (vert / ambre / rouge) via la classe
 * du badge parent, jamais le score arrondi. Décorative (aria-hidden) : le texte porte l'information.
 */
export function ScoreBar({
  value,
  large = false,
}: {
  value: number;
  large?: boolean;
}) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span
      className={`score-bar${large ? " is-large" : ""}`}
      style={{ "--score": `${score}%` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="score-bar__fill" />
    </span>
  );
}
