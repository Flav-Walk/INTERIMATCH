/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Progress
   Barre de complétion (ex. profil complété à 70 %), valeur 0–100.
   • role="progressbar" + aria-valuenow/min/max + nom accessible
   • Le remplissage est animé par transform: scaleX (jamais width)
   • À 100 % la barre passe au vert « succès »
   ══════════════════════════════════════════════════════════════ */

import { useId, type HTMLAttributes } from 'react';
import './Progress.css';

type ProgressSize = 'sm' | 'md';

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Valeur de 0 à 100 (bornée automatiquement) */
  value:      number;
  /** Nom de la barre (obligatoire) — ex. « Complétion du profil » */
  label:      string;
  size?:      ProgressSize;
  /** Affiche le pourcentage à côté du libellé */
  showValue?: boolean;
  /** Masque le libellé visuellement (il reste lu par les lecteurs d'écran) */
  hideLabel?: boolean;
}

export function Progress({
  value,
  label,
  size = 'md',
  showValue = true,
  hideLabel = false,
  className = '',
  ...rest
}: ProgressProps) {
  const labelId = useId();
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      {...rest}
      className={[
        'im-progress',
        `im-progress--${size}`,
        clamped === 100 ? 'im-progress--complete' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="im-progress__head">
        <span
          id={labelId}
          className={['im-progress__label', hideLabel ? 'im-progress__label--hidden' : ''].filter(Boolean).join(' ')}
        >
          {label}
        </span>
        {showValue && <span className="im-progress__value" aria-hidden="true">{clamped}%</span>}
      </div>

      <div
        className="im-progress__track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${clamped} %`}
      >
        <div className="im-progress__fill" style={{ transform: `scaleX(${clamped / 100})` }} />
      </div>
    </div>
  );
}
