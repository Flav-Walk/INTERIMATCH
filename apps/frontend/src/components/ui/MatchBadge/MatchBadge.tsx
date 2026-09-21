/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — MatchBadge
   Composant identitaire du produit — 3 niveaux visuels
   Usage : <MatchBadge score={87} /> | <MatchBadge score={87} size="lg" animated />
   ══════════════════════════════════════════════════════════════ */

import './MatchBadge.css';

/* ── Types ────────────────────────────────────────────────── */

type MatchLevel = 'high' | 'mid' | 'low';
type MatchSize  = 'sm' | 'md' | 'lg';

export interface MatchBadgeProps {
  /** Score de 0 à 100 */
  score:     number;
  /** Taille du badge */
  size?:     MatchSize;
  /** Afficher le label textuel (ex: "Très compatible") */
  withLabel?: boolean;
  /** Déclenche la micro-animation d'entrée */
  animated?:  boolean;
  className?: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function getLevel(score: number): MatchLevel {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

const LEVEL_LABELS: Record<MatchLevel, string> = {
  high: 'Très compatible',
  mid:  'Compatible',
  low:  'Profil partiel',
};

/* ── Composant ───────────────────────────────────────────── */

export function MatchBadge({
  score,
  size = 'md',
  withLabel = false,
  animated = false,
  className = '',
}: MatchBadgeProps) {
  const level = getLevel(score);
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  return (
    <span
      className={[
        'im-match-badge',
        `im-match-badge--${level}`,
        `im-match-badge--${size}`,
        animated ? 'im-match-badge--animated' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-label={`Score de compatibilité : ${clampedScore}%`}
      role="status"
    >
      {/* Indicateur rond */}
      <span className="im-match-badge__dot" aria-hidden="true" />

      {/* Score */}
      <span className="im-match-badge__score">
        {clampedScore}%
      </span>

      {/* Label optionnel */}
      {withLabel && (
        <span className="im-match-badge__label">
          {LEVEL_LABELS[level]}
        </span>
      )}
    </span>
  );
}

/* ── Loading state ────────────────────────────────────────── */

export function MatchBadgeSkeleton({ size = 'md' }: { size?: MatchSize }) {
  return (
    <span
      className={`im-match-badge im-match-badge--skeleton im-match-badge--${size}`}
      aria-busy="true"
      aria-label="Calcul du score de compatibilité…"
    />
  );
}
