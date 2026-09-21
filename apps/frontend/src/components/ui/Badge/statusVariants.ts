/* ══════════════════════════════════════════════════════════════
   Correspondance statut métier → variant de <Badge>
   Source unique : évite que chaque écran réinvente ses couleurs.
   Les unions sont redéclarées ici (et non importées de services/) pour que
   le design system reste indépendant de la couche données ; TypeScript
   vérifie qu'elles restent compatibles à l'usage.
   ══════════════════════════════════════════════════════════════ */

import type { BadgeVariant } from './Badge';

type MissionStatus     = 'draft' | 'open' | 'filled' | 'completed' | 'cancelled';
type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export const MISSION_STATUS_VARIANT: Record<MissionStatus, BadgeVariant> = {
  open:      'success',
  filled:    'info',
  draft:     'draft',
  cancelled: 'error',
  completed: 'neutral',
};

export const APPLICATION_STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  pending:  'warning',
  accepted: 'success',
  rejected: 'error',
};
