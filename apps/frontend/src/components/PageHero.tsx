// Bandeau de tête des pages de l'espace connecté : bandeau clair, titre large.
// Le contenu de la page vient ensuite dans un <div className="page-panel">
// qui chevauche le bandeau.

import type { ReactNode } from "react";

interface PageHeroProps {
  eyeline?: string;
  title: string;
  lead?: ReactNode;
  /** Lien de retour, affiché au-dessus du titre */
  back?: ReactNode;
  /** Élément à droite du titre (badge de statut…) */
  badge?: ReactNode;
  /** Boutons d'action sous le titre */
  actions?: ReactNode;
}

export function PageHero({
  eyeline,
  title,
  lead,
  back,
  badge,
  actions,
}: PageHeroProps) {
  return (
    <div className="page-hero">
      <div className="page-hero__inner">
        {back}
        {eyeline && <span className="eyeline">{eyeline}</span>}
        <div className="page-hero__title-row">
          <h1>{title}</h1>
          {badge}
        </div>
        {lead && <p className="page-hero__lead">{lead}</p>}
        {actions && <div className="page-hero__actions">{actions}</div>}
      </div>
    </div>
  );
}
