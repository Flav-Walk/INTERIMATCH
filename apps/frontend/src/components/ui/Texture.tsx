import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Trame de points, en fond de section.
 *
 * SOURCE : Magic UI — `dot-pattern` (https://magicui.design/docs/components/dot-pattern),
 * récupéré depuis https://magicui.design/r/dot-pattern.json. Licence MIT.
 *
 * CE QUI A ÉTÉ ADAPTÉ.
 * - L'original calcule la position de CHAQUE point en JavaScript et rend un
 *   `<motion.circle>` par point : sur un bandeau de 1 400 × 600 px avec un pas
 *   de 16 px, cela fait plus de 3 000 nœuds animés dans le DOM. C'est un coût
 *   réel au défilement, pour une texture de fond. Ici, un unique `<pattern>`
 *   SVG est répété par le navigateur — un nœud, quelle que soit la surface.
 * - L'option `glow`, qui fait scintiller les points avec des délais
 *   aléatoires, est retirée. Une trame de fond qui bouge attire l'œil
 *   exactement là où il n'y a rien à lire.
 * - Le masque en dégradé est intégré : sans lui, la trame s'arrête net au bord
 *   de la section et se voit comme un aplat rapporté.
 *
 * Le `useId` reste indispensable : deux trames sur la même page avec le même
 * identifiant de motif, et la seconde reprend les réglages de la première.
 */
export function DotTexture({
  className,
  gap = 18,
  radius = 1,
}: {
  className?: string;
  gap?: number;
  radius?: number;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full text-sage",
        "[mask-image:radial-gradient(75%_60%_at_50%_35%,black,transparent)]",
        className,
      )}
    >
      <defs>
        <pattern
          id={`dots-${id}`}
          width={gap}
          height={gap}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={radius} cy={radius} r={radius} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dots-${id})`} />
    </svg>
  );
}

/**
 * Cadre dont la bordure est parcourue par une lueur.
 *
 * SOURCE : Magic UI — `border-beam` (https://magicui.design/docs/components/border-beam),
 * récupéré depuis https://magicui.design/r/border-beam.json. Licence MIT.
 *
 * POURQUOI LA TECHNIQUE D'ORIGINE A ÉTÉ ABANDONNÉE.
 * Magic UI confine la lueur au liseré avec un masque composite :
 * `mask: linear-gradient(...), linear-gradient(...)` plus `mask-clip:
 * padding-box, border-box` et `mask-composite: intersect`. C'est élégant, et
 * c'est exactement ce qui a échoué ici : la première intégration a produit un
 * demi-disque vert franchement posé SUR le haut de la carte, la composition
 * n'ayant pas pris. Un effet décoratif qui se dégrade en artefact visible au
 * milieu du contenu n'a pas sa place sur une page d'accueil.
 *
 * CE QUI LE REMPLACE. Deux plans empilés, sans masque : un dégradé conique qui
 * tourne, et par-dessus un rectangle opaque en retrait d'un pixel. Ce qui
 * dépasse du rectangle EST la bordure. C'est la méthode la plus ancienne et
 * la plus robuste, elle ne dépend d'aucune composition de masque, et elle se
 * dégrade en simple bordure si l'animation est refusée.
 *
 * L'animation est une `@keyframes` CSS, donc mise en pause par le navigateur
 * dès que l'élément quitte le champ. Aucun rendu React n'est déclenché.
 */
export function BeamFrame({
  children,
  className,
  surface = "bg-white/6",
  duration = 9,
}: {
  children: ReactNode;
  className?: string;
  /** Aplat du cadre, posé par-dessus la lueur. Doit être OPAQUE au vert. */
  surface?: string;
  duration?: number;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-20 motion-reduce:hidden"
      >
        <span
          className="absolute top-1/2 left-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0_72%,var(--color-sage)_86%,var(--color-forest-soft)_94%,transparent_100%)]"
          style={{ animation: `im-turn ${duration}s linear infinite` }}
        />
      </span>
      {/* Le liseré : ce rectangle recouvre tout sauf un pixel de pourtour. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-px -z-10 rounded-[inherit] border border-white/10",
          surface,
        )}
      />
      {children}
      <style>{`@keyframes im-turn { to { transform: translate(-50%,-50%) rotate(1turn); } }`}</style>
    </div>
  );
}
