/*
 * Spotlight Button — Hover.dev
 * https://www.hover.dev/components/buttons (composant gratuit)
 *
 * Le principe vient de Hover.dev : un disque lumineux suit le curseur à
 * l'intérieur du bouton, et revient au centre quand la souris sort.
 *
 * Ce que j'ai adapté par rapport au code d'origine :
 * 1. C'est un <Link> de react-router et pas un <button>, parce que nos CTA
 *    changent de page. motion.create(Link) garde l'animation au clic.
 * 2. L'original met un disque blanc sur un fond noir avec un texte en
 *    « mix-blend-difference ». Sur notre orange, ça donnait du bleu. Ici,
 *    le disque est un halo blanc semi-transparent, et le texte ne change pas.
 * 3. L'original lit e.offsetX, qui se trompe quand la souris passe sur
 *    l'icône flèche. Je calcule la position avec getBoundingClientRect().
 * 4. Si l'utilisateur a activé « Réduire les animations », le halo ne bouge pas.
 *
 * Le style du bouton (couleur, padding, arrondi) reste celui de shell.css,
 * via className="home-cta home-cta--primary". Ce fichier n'ajoute que l'effet.
 */
import { useRef, type MouseEvent, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "../../lib/utils";

// Un Link capable de recevoir les props de Motion (whileTap…).
const MotionLink = motion.create(Link);

// On ne reprend que les props utiles de Link : ses événements de drag HTML
// entrent en conflit avec ceux de Motion (onDrag…), TypeScript refuse le mélange.
interface SpotlightLinkProps {
  to: LinkProps["to"];
  children: ReactNode;
  className?: string;
}

export function SpotlightLink({
  to,
  children,
  className,
}: SpotlightLinkProps) {
  const spotRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  // La souris bouge : on place le halo à la même position horizontale.
  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (reduceMotion || !spotRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = `${((e.clientX - rect.left) / rect.width) * 100}%`;
    // Web Animations API, comme dans l'original : fluide et sans re-render React.
    spotRef.current.animate({ left }, { duration: 250, fill: "forwards" });
  };

  // La souris sort : le halo revient au centre.
  const handleMouseLeave = () => {
    if (reduceMotion || !spotRef.current) return;
    spotRef.current.animate(
      { left: "50%" },
      { duration: 100, fill: "forwards" },
    );
  };

  return (
    <MotionLink
      to={to}
      whileTap={{ scale: 0.985 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative isolate overflow-hidden", className)}
    >
      {/* Le texte et l'icône passent au-dessus du halo. */}
      <span className="pointer-events-none relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
      {/* Le halo : un disque flou centré, déplacé par handleMouseMove. */}
      <span
        ref={spotRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-xl"
      />
    </MotionLink>
  );
}
