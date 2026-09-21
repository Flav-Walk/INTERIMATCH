/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — FilterChip
   Chip de filtre à bascule (actif / inactif) — <button aria-pressed>.
   • L'état actif est porté par aria-pressed ET par une coche visible :
     jamais la couleur seule.
   • Grouper les chips dans un conteneur `role="group" aria-label="…"`.
   • Pour une navigation entre vues (onglets), utiliser <Tabs>.
   ══════════════════════════════════════════════════════════════ */

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import './FilterChip.css';

export interface FilterChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-pressed'> {
  selected?: boolean;
  /** Compteur affiché dans la pastille (ex. nombre de résultats) */
  count?:    number;
  children:  ReactNode;
}

export function FilterChip({
  selected = false,
  count,
  className = '',
  children,
  ...rest
}: FilterChipProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={selected}
      className={['im-filter-chip', selected ? 'im-filter-chip--selected' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {selected && <Check className="im-filter-chip__check" size={14} strokeWidth={3} aria-hidden="true" />}
      <span className="im-filter-chip__label">{children}</span>
      {count !== undefined && <span className="im-filter-chip__count">{count}</span>}
    </button>
  );
}
