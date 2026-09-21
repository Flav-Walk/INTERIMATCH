/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — EmptyState
   Invitation à l'action, pas un message d'erreur passif
   ══════════════════════════════════════════════════════════════ */

import { type ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      ReactNode;
  size?:        'sm' | 'md' | 'lg';
  className?:   string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={['im-empty-state', `im-empty-state--${size}`, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <div className="im-empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}

      <p className="im-empty-state__title">{title}</p>

      {description && (
        <p className="im-empty-state__desc">{description}</p>
      )}

      {action && (
        <div className="im-empty-state__action">{action}</div>
      )}
    </div>
  );
}
