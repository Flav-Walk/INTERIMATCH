import type { ElementType, ReactNode } from "react";
import IconRipple from "../ui/icon-ripple";
import { Ripple } from "../ui/ripple";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

/*
 * État vide (« Aucune mission disponible », « Vous n'avez pas encore
 * postulé »…), partout dans l'espace connecté.
 *
 * Avant : une icône posée dans un carré teinté, un titre, un texte. C'était
 * le motif « tuile d'icône » relevé en revue.
 *
 * Maintenant, deux composants de librairie superposés :
 * 1. Ripple (Magic UI) : des cercles concentriques qui respirent en fond,
 *    fondus vers le bas (masque dégradé).
 * 2. Icon Ripple (Animata) : l'icône au centre, avec un anneau qui s'élargit
 *    et s'efface (animate-ping), comme un sonar : « on attend que quelque
 *    chose arrive ».
 * Le tout apparaît en fondu (Blur Fade, Magic UI).
 *
 * Le contenu (titre h2/h3, texte, bouton) est passé tel quel en children :
 * les pages gardent leurs textes, leurs niveaux de titre et leurs liens.
 */
export function EmptyState({
  icon,
  children,
  className,
}: {
  icon: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BlurFade
      className={cn(
        // « empty » gardée : certaines pages ajustent leurs marges avec.
        "empty relative isolate flex flex-col items-center overflow-hidden text-center",
        className,
      )}
    >
      {/* Décor : les cercles en fond. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56" aria-hidden="true">
        <Ripple mainCircleSize={70} numCircles={4} mainCircleOpacity={0.14} />
      </div>
      <div className="mt-4 mb-6 flex size-16 items-center justify-center rounded-full bg-surface shadow-md" aria-hidden="true">
        <IconRipple icon={icon} iconSize={24} iconColor="var(--forest)" borderColor="var(--orange)" inset="6px" />
      </div>
      <div className="grid max-w-md justify-items-center gap-2">{children}</div>
    </BlurFade>
  );
}
