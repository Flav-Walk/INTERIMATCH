/*
 * Draw Outline Button — Hover.dev
 * https://www.hover.dev/components/buttons (composant gratuit)
 *
 * Au survol, un trait fait le tour du bouton : haut, droite, bas, puis
 * gauche. Chaque côté démarre 100 ms après le précédent (delay-100, 200, 300).
 * C'est du CSS pur, sans JavaScript : 4 <span> qui passent de 0 à 100 %.
 *
 * Ce que j'ai adapté par rapport au code d'origine :
 * 1. C'est un <Link> de react-router et pas un <button>.
 * 2. La couleur du trait vient de nos tokens (orange par défaut) via la
 *    variable CSS --draw-color, au lieu du indigo-300 de Hover.dev.
 * 3. Nos boutons ont déjà une bordure (1 px ou 2 px). La prop borderWidth
 *    place le trait PAR-DESSUS cette bordure plutôt qu'à l'intérieur.
 * 4. « Réduire les animations » : motion.css coupe les transitions.
 */
import type { CSSProperties, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { cn } from "../../lib/utils";

interface DrawOutlineLinkProps extends Omit<LinkProps, "children"> {
  children: ReactNode;
  className?: string;
  /** Épaisseur de la bordure existante du bouton, en px. */
  borderWidth?: number;
  /** Couleur du trait (une variable de tokens.css de préférence). */
  color?: string;
}

export function DrawOutlineLink({
  children,
  className,
  borderWidth = 0,
  color = "var(--orange)",
  style,
  ...rest
}: DrawOutlineLinkProps) {
  // On passe les réglages en variables CSS, lues par les 4 traits.
  const vars = {
    "--draw-color": color,
    "--draw-offset": `-${borderWidth}px`,
    "--draw-size": `${Math.max(2, borderWidth)}px`,
    ...style,
  } as CSSProperties;

  // Classes communes aux 4 traits.
  const line =
    "draw-outline__line pointer-events-none absolute bg-[var(--draw-color)] transition-all duration-100";

  return (
    <Link
      {...rest}
      style={vars}
      className={cn("draw-outline group relative", className)}
    >
      {children}
      {/* HAUT : de gauche à droite */}
      <span
        aria-hidden="true"
        className={cn(
          line,
          "left-[var(--draw-offset)] top-[var(--draw-offset)] h-[var(--draw-size)] w-0 group-hover:w-[calc(100%_-_2*var(--draw-offset))] group-focus-visible:w-[calc(100%_-_2*var(--draw-offset))]",
        )}
      />
      {/* DROITE : de haut en bas */}
      <span
        aria-hidden="true"
        className={cn(
          line,
          "right-[var(--draw-offset)] top-[var(--draw-offset)] h-0 w-[var(--draw-size)] delay-100 group-hover:h-[calc(100%_-_2*var(--draw-offset))] group-focus-visible:h-[calc(100%_-_2*var(--draw-offset))]",
        )}
      />
      {/* BAS : de droite à gauche */}
      <span
        aria-hidden="true"
        className={cn(
          line,
          "bottom-[var(--draw-offset)] right-[var(--draw-offset)] h-[var(--draw-size)] w-0 delay-200 group-hover:w-[calc(100%_-_2*var(--draw-offset))] group-focus-visible:w-[calc(100%_-_2*var(--draw-offset))]",
        )}
      />
      {/* GAUCHE : de bas en haut */}
      <span
        aria-hidden="true"
        className={cn(
          line,
          "bottom-[var(--draw-offset)] left-[var(--draw-offset)] h-0 w-[var(--draw-size)] delay-300 group-hover:h-[calc(100%_-_2*var(--draw-offset))] group-focus-visible:h-[calc(100%_-_2*var(--draw-offset))]",
        )}
      />
    </Link>
  );
}
