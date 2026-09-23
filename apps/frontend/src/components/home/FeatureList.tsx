import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cascade, revealOnScroll, rise } from "../../lib/motion";

export interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

/*
 * Les 3 avantages d'une section de l'accueil, en liste éditoriale : icône
 * dans un rond teinté, titre, texte, séparés par un trait fin. Remplace la
 * grille « bento » dont les grandes cases pastel restaient vides.
 *
 * Motion : les lignes apparaissent l'une après l'autre quand la liste entre
 * à l'écran (une seule fois).
 */
export function FeatureList({
  features,
  tone = "forest",
}: {
  features: Feature[];
  tone?: "forest" | "orange";
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.ul
      className="home-feature-list"
      variants={cascade}
      {...(reduceMotion ? {} : revealOnScroll)}
    >
      {features.map((feature) => (
        <motion.li key={feature.title} variants={rise}>
          <span
            className={`home-feature-list__icon home-feature-list__icon--${tone}`}
            aria-hidden="true"
          >
            {feature.icon}
          </span>
          <div>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
