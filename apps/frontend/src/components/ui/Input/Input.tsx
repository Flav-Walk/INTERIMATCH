/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Input
   Champ de formulaire accessible (RGAA 4.1 — critères 11.1 à 11.13)
   • <label> toujours présent (visuellement masquable avec hideLabel)
   • useId : liaison label ↔ champ ↔ aide ↔ erreur sans id manuel
   • aria-invalid + aria-describedby ; l'erreur est annoncée (role="alert")
   • L'erreur combine texte + icône : jamais la couleur seule
   ══════════════════════════════════════════════════════════════ */

import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import './Input.css';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  /** Libellé du champ (obligatoire : un placeholder n'est pas un label) */
  label:      string;
  /** Aide affichée sous le champ (format attendu, exemple…) */
  hint?:      string;
  /** Message d'erreur : passe le champ en état invalide */
  error?:     string;
  /** Icône Lucide décorative à gauche du champ */
  iconLeft?:  ReactNode;
  /** Masque le label visuellement (il reste lu par les lecteurs d'écran) */
  hideLabel?: boolean;
}

export function Input({
  label,
  hint,
  error,
  iconLeft,
  hideLabel = false,
  id,
  className = '',
  required,
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const autoId  = useId();
  const inputId = id ?? autoId;
  const hintId  = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  /* aria-describedby : aide + erreur + ce que le parent a déjà fourni */
  const describedById = [
    describedBy,
    hint  ? hintId  : '',
    error ? errorId : '',
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={[
        'im-input',
        error    ? 'im-input--error'    : '',
        iconLeft ? 'im-input--has-icon' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <label
        htmlFor={inputId}
        className={['im-input__label', hideLabel ? 'im-input__label--hidden' : ''].filter(Boolean).join(' ')}
      >
        {label}
        {/* L'attribut required est lu par les lecteurs d'écran : l'astérisque est visuel */}
        {required && <span className="im-input__required" aria-hidden="true"> *</span>}
      </label>

      <div className="im-input__control">
        {iconLeft && (
          <span className="im-input__icon" aria-hidden="true">{iconLeft}</span>
        )}
        <input
          {...rest}
          id={inputId}
          className="im-input__field"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
        />
      </div>

      {hint && <p id={hintId} className="im-input__hint">{hint}</p>}

      {error && (
        <p id={errorId} className="im-input__error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
