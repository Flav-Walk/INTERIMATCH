import { useCallback, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { cn } from "../../lib/cn";

/**
 * Surface qui s'éclaire sous le curseur.
 *
 * SOURCE : Magic UI — `magic-card` (https://magicui.design/docs/components/magic-card),
 * récupéré depuis https://magicui.design/r/magic-card.json. Licence MIT.
 *
 * CE QUI A ÉTÉ ADAPTÉ, ET POURQUOI C'EST BEAUCOUP.
 * - L'original dépend de `next-themes` pour choisir un mode de fusion. Le
 *   produit n'a ni Next ni thème sombre : la dépendance et les 40 lignes de
 *   détection qui l'accompagnent tombent.
 * - Le mode « orb » — un halo flou de 420 px qui suit le curseur avec un
 *   ressort — a été retiré. Sur une grille de missions, c'est un effet de
 *   démonstration : joli isolé, illisible à douze exemplaires.
 * - Le dégradé violet/rose d'origine (#9E7AFF → #FE8BBB) est remplacé par le
 *   vert de marque. L'effet devient une signature du produit au lieu d'être la
 *   signature de la bibliothèque — c'est exactement ce qui trahit un composant
 *   collé sans être adapté.
 * - L'éclat est très fortement atténué (rayon 180 px, opacité 0,5 au lieu de
 *   0,8) et n'agit que sur la BORDURE, pas sur le fond. Une carte dont le fond
 *   s'illumine efface le texte qu'elle porte.
 * - `useReducedMotion` : l'effet disparaît entièrement, la carte garde son
 *   filet.
 * - Les écouteurs globaux `pointerout` / `blur` / `visibilitychange` de
 *   l'original sont supprimés. Ils existent pour rattraper un halo resté
 *   allumé ; avec un éclat qui ne vit que sur `:hover`, le CSS s'en charge.
 */
export function Spotlight({
  children,
  className,
  radius = 180,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(-radius);
  const y = useMotionValue(-radius);

  const track = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      x.set(e.clientX - rect.left);
      y.set(e.clientY - rect.top);
    },
    [x, y],
  );

  // Deux plans dans une seule peinture : le premier remplit la boîte de
  // contenu, le second la boîte de BORDURE. C'est ce qui confine le dégradé au
  // liseré, sans jamais passer sous le texte.
  const surface = useMotionTemplate`linear-gradient(var(--color-surface) 0 0) padding-box, radial-gradient(${radius}px circle at ${x}px ${y}px, var(--color-forest-soft), var(--color-sage), var(--color-rule) 70%) border-box`;

  if (still)
    return (
      <div className={cn("border border-rule", className)}>{children}</div>
    );

  return (
    <motion.div
      onPointerMove={track}
      onPointerLeave={() => {
        x.set(-radius);
        y.set(-radius);
      }}
      className={cn("group relative border border-transparent", className)}
      style={{ background: surface }}
    >
      {children}
    </motion.div>
  );
}
