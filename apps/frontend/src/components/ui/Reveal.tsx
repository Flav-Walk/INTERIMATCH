import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/**
 * Apparition au défilement.
 *
 * SOURCE : Magic UI — `blur-fade` (https://magicui.design/docs/components/blur-fade),
 * récupéré depuis le registre https://magicui.design/r/blur-fade.json. Licence MIT.
 *
 * CE QUI A ÉTÉ ADAPTÉ.
 * - L'original enveloppe systématiquement dans `AnimatePresence`, qui n'a
 *   d'intérêt que pour une sortie. Rien ici ne se démonte en défilant : le
 *   retirer supprime un contexte et un rendu par section.
 * - `useReducedMotion` neutralise l'effet plutôt que de le raccourcir. Un flou
 *   de 6 px joué en 10 ms reste un flou : ce n'est pas ce que la préférence
 *   demande.
 * - Le flou par défaut passe de 6 px à 4 px et le décalage de 6 px à 10 px.
 *   Sur des blocs de texte éditorial, le flou fort donne une impression de
 *   défaut de rendu ; c'est le déplacement qui porte l'effet.
 * - `once: true` conservé : une section qui rejoue son apparition à chaque
 *   passage devient une distraction sur une page longue.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.5,
  offset = 10,
  blur = "4px",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  offset?: number;
  blur?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const still = useReducedMotion();

  const Motion = motion[Tag];

  if (still)
    return (
      <Tag ref={ref} className={className}>
        {children}
      </Tag>
    );

  return (
    <Motion
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: offset, filter: `blur(${blur})` }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y: offset, filter: `blur(${blur})` }
      }
      transition={{ delay, duration, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Motion>
  );
}
