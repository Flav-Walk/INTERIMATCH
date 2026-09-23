import type { ReactNode } from "react";
import { BentoGrid, BentoGridItem } from "../ui/bento-grid";

/**
 * FeatureBento — les 3 avantages de l'accueil, en grille « bento ».
 *
 * Avant, les avantages étaient 3 blocs identiques (icône + titre + texte)
 * alignés à l'identique : c'est exactement le « triptyque symétrique » qu'on
 * voit sur toutes les landing pages. Ici j'utilise le Bento Grid d'Aceternity
 * avec des cases de tailles différentes :
 *
 *   ┌───────────────┬───────┐
 *   │   1 (large)   │       │
 *   ├───────────────┤   2   │
 *   │   3 (large)   │(haute)│
 *   └───────────────┴───────┘
 *
 * Pour les établissements (tone="orange"), la case haute passe à gauche :
 * les deux sections de la page ne se ressemblent pas.
 *
 * Mêmes props que l'ancienne FeatureList de Home.tsx : on peut remplacer
 * l'une par l'autre sans toucher aux données.
 */

export interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

export function FeatureBento({
  features,
  tone = "forest",
}: {
  features: Feature[];
  tone?: "forest" | "orange";
}) {
  return (
    <BentoGrid className={`feature-bento feature-bento--${tone}`}>
      {features.map((feature, index) => (
        <BentoGridItem
          key={feature.title}
          className="feature-bento__item"
          // Le visuel du haut : l'icône en grand sur un fond à pois de la
          // couleur de la section. Décoratif, donc caché aux lecteurs d'écran.
          header={
            <div
              className={`feature-bento__visual feature-bento__visual--${index + 1}`}
              aria-hidden="true"
            >
              {feature.icon}
            </div>
          }
          // Le titre reste un vrai <h3>, comme avant, pour le SEO et la
          // navigation au lecteur d'écran.
          title={<h3 className="feature-bento__title">{feature.title}</h3>}
          description={<p className="feature-bento__desc">{feature.desc}</p>}
        />
      ))}
    </BentoGrid>
  );
}
