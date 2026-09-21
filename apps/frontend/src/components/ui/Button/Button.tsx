/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Button
   Tous les états : default / hover / active / focus / disabled / loading
   Variantes : primary / secondary / ghost / danger
   Tailles : sm / md / lg
   ══════════════════════════════════════════════════════════════ */

import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import './Button.css';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  BtnVariant;
  size?:     BtnSize;
  loading?:  boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={[
        'im-btn',
        `im-btn--${variant}`,
        `im-btn--${size}`,
        loading   ? 'im-btn--loading'   : '',
        fullWidth ? 'im-btn--fullwidth' : '',
        className,
      ].filter(Boolean).join(' ')}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      {...rest}
    >
      {/* Icône gauche — masquée en loading */}
      {!loading && iconLeft && (
        <span className="im-btn__icon im-btn__icon--left" aria-hidden="true">
          {iconLeft}
        </span>
      )}

      {/* Spinner en loading */}
      {loading && (
        <span className="im-btn__spinner" aria-hidden="true">
          <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
        </span>
      )}

      {/* Label */}
      <span className="im-btn__label">{children}</span>

      {/* Icône droite */}
      {!loading && iconRight && (
        <span className="im-btn__icon im-btn__icon--right" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
