/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Badge
   Étiquette générique de statut, dans le flux de la page (listes,
   tableaux, en-têtes). Pour un statut superposé à un visuel, voir
   <StatusBadge>.
   Variants : success / warning / error / info / neutral / draft
   Tailles  : sm / md
   Le sens est TOUJOURS porté par le texte, jamais par la couleur seule.
   ══════════════════════════════════════════════════════════════ */

import { type HTMLAttributes, type ReactNode } from 'react';
import './Badge.css';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'draft';
export type BadgeSize    = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Couleur sémantique (voir le mapping des statuts dans Badge.css) */
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  /** Petit point coloré avant le label */
  dot?:      boolean;
  children:  ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  className = '',
  ...rest
}: BadgeProps) {
  return (
    <span
      className={['badge', `badge--${variant}`, `badge--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* Décoratif : le label suffit à transmettre l'information */}
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
