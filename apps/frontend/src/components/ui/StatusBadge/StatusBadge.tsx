/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — StatusBadge
   Statuts mission et candidature — 2 modes
   Pensé pour se superposer à un visuel (fond semi-transparent + flou).
   Pour un statut dans le flux de la page (liste, tableau), voir <Badge>.
   ══════════════════════════════════════════════════════════════ */

import './StatusBadge.css';

/* ── Mission statuses ────────────────────────────────────── */

type MissionStatus = 'draft' | 'open' | 'filled' | 'completed' | 'cancelled';
type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export type BadgeStatus = MissionStatus | ApplicationStatus;

const STATUS_CONFIG: Record<BadgeStatus, { label: string; variant: string }> = {
  /* Missions */
  draft:     { label: 'Brouillon',  variant: 'draft'     },
  open:      { label: 'En ligne',   variant: 'open'      },
  filled:    { label: 'Complet',    variant: 'filled'    },
  completed: { label: 'Terminée',   variant: 'completed' },
  cancelled: { label: 'Annulée',    variant: 'cancelled' },
  /* Candidatures */
  pending:   { label: 'En attente', variant: 'pending'   },
  accepted:  { label: 'Acceptée',   variant: 'accepted'  },
  rejected:  { label: 'Refusée',    variant: 'rejected'  },
};

/** Libellés français des statuts — réutilisables hors du badge (titres, aria-label…) */
export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, { label }]) => [status, label]),
) as Record<BadgeStatus, string>;

export interface StatusBadgeProps {
  status:     BadgeStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'draft' };

  return (
    <span
      className={[
        'im-status-badge',
        `im-status-badge--${config.variant}`,
        className,
      ].filter(Boolean).join(' ')}
      role="status"
      aria-label={`Statut : ${config.label}`}
    >
      {config.label}
    </span>
  );
}
