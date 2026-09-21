/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — NavigationItem
   Entrée de sidebar : icône Lucide + label + pastille numérique.

   • Avec `to`  → rendu en <Link> (navigation), aria-current="page" si actif
   • Sans `to`  → rendu en <button> (action : déconnexion, ouvrir un menu…)
   • État actif : fond vert léger, texte forest-900, barre gauche de 3 px
     (couleur pilotée par --nav-active-bar dans NavigationItem.css)
   • Survol : translateX(2px). Seuls transform / couleurs sont animés.
   ══════════════════════════════════════════════════════════════ */

import { type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import './NavigationItem.css';

interface NavigationItemBaseProps {
  /** Icône Lucide (le composant, pas un élément) : `icon={Briefcase}` */
  icon:       LucideIcon;
  label:      string;
  /** Pastille numérique (ex. candidatures en attente). Masquée si 0 ou absent. */
  badge?:     number;
  /** Texte lu par les lecteurs d'écran après le nombre (ex. « en attente ») */
  badgeLabel?: string;
  isActive?:  boolean;
  className?: string;
}

export type NavigationItemProps = NavigationItemBaseProps &
  (
    | ({ to: string }     & Omit<LinkProps, 'to' | 'className' | 'children'>)
    | ({ to?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
  );

const BADGE_MAX = 99;

export function NavigationItem({
  icon: Icon,
  label,
  badge,
  badgeLabel,
  isActive = false,
  className = '',
  ...rest
}: NavigationItemProps) {
  const classes = ['im-nav-item', isActive ? 'im-nav-item--active' : '', className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <Icon className="im-nav-item__icon" size={18} aria-hidden="true" />
      <span className="im-nav-item__label">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="im-nav-item__badge">
          {badge > BADGE_MAX ? `${BADGE_MAX}+` : badge}
          {/* Contexte pour les lecteurs d'écran : « Candidatures 3 en attente » */}
          {badgeLabel && <span className="im-nav-item__sr"> {badgeLabel}</span>}
        </span>
      )}
    </>
  );

  if (rest.to !== undefined) {
    return (
      <Link {...rest} className={classes} aria-current={isActive ? 'page' : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...rest} className={classes} aria-current={isActive ? 'true' : undefined}>
      {content}
    </button>
  );
}
