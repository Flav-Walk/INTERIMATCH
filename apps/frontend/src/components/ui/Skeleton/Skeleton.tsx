/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Skeleton
   Placeholders de chargement, shimmer CSS pur (classe .skeleton
   définie dans animations.css, coupée en prefers-reduced-motion).

   • <Skeleton>       : une forme (text / rect / circle) — décorative
   • <SkeletonGroup>  : regroupe des formes et annonce le chargement
                        une seule fois (role="status" + texte SR)
   ══════════════════════════════════════════════════════════════ */

import { type CSSProperties, type ReactNode } from 'react';
import './Skeleton.css';

type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  variant?:   SkeletonVariant;
  /** Nombre → px, chaîne → valeur CSS ('60%', 'var(--sp-10)') */
  width?:     number | string;
  height?:    number | string;
  /** variant="text" : nombre de lignes (la dernière est plus courte) */
  lines?:     number;
  className?: string;
}

const toCss = (v: number | string | undefined): string | undefined =>
  typeof v === 'number' ? `${v}px` : v;

export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines = 1,
  className = '',
}: SkeletonProps) {
  const style: CSSProperties = { width: toCss(width), height: toCss(height) };

  if (variant === 'text' && lines > 1) {
    return (
      <span className={['im-skeleton-lines', className].filter(Boolean).join(' ')} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="skeleton im-skeleton im-skeleton--text"
            /* Dernière ligne à 60 % : rendu naturel d'un paragraphe */
            style={{ ...style, width: i === lines - 1 ? '60%' : style.width }}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={['skeleton', 'im-skeleton', `im-skeleton--${variant}`, className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}

/* ── Groupe : une seule annonce pour tout l'écran en chargement ── */

export interface SkeletonGroupProps {
  /** Texte lu par les lecteurs d'écran */
  label?:     string;
  className?: string;
  children:   ReactNode;
}

export function SkeletonGroup({
  label = 'Chargement en cours…',
  className = '',
  children,
}: SkeletonGroupProps) {
  return (
    <div
      className={['im-skeleton-group', className].filter(Boolean).join(' ')}
      role="status"
      aria-busy="true"
    >
      <span className="im-skeleton-group__label">{label}</span>
      {children}
    </div>
  );
}
