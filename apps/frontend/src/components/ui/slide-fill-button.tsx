/*
 * Slide Fill — bouton dont le fond glisse de gauche à droite au survol.
 *
 * Inspiré des boutons « slide » de Hover.dev (Rounded Slide Button, réservé
 * à la version Pro, donc code non copié). Ici, c'est du CSS pur, sans JS :
 *
 * 1. Un <span> de la couleur de remplissage est placé DERRIÈRE le texte
 *    (-z-10) et couvre tout le bouton (inset-0).
 * 2. Au repos, il est écrasé à 0 % de largeur (scale-x-0), ancré à gauche
 *    (origin-left).
 * 3. Au survol ou au focus clavier, il passe à 100 % (scale-x-100) en 300 ms.
 *    On anime transform et pas width : c'est le GPU qui travaille, donc fluide.
 * 4. isolate crée un « contexte d'empilement » : le -z-10 reste DANS le
 *    bouton, au lieu de passer derrière la section.
 *
 * La couleur du texte au survol se règle dans motion.css (classe slide-fill).
 * « Réduire les animations » : le fond apparaît d'un coup, sans glisser.
 */
import type { CSSProperties, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { cn } from "../../lib/utils";

interface SlideFillLinkProps extends Omit<LinkProps, "children"> {
  children: ReactNode;
  className?: string;
  /** Couleur qui remplit le bouton (variable de tokens.css de préférence). */
  color?: string;
}

export function SlideFillLink({
  children,
  className,
  color = "var(--forest)",
  style,
  ...rest
}: SlideFillLinkProps) {
  return (
    <Link
      {...rest}
      style={{ "--slide-color": color, ...style } as CSSProperties}
      className={cn("slide-fill group relative isolate overflow-hidden", className)}
    >
      {/* Le fond qui glisse, derrière le texte. */}
      <span
        aria-hidden="true"
        className="slide-fill__bg pointer-events-none absolute inset-0 -z-10 origin-left scale-x-0 bg-[var(--slide-color)] transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />
      {children}
    </Link>
  );
}
