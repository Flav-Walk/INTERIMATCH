/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — SearchInput
   Champ de recherche contrôlé avec états loading / empty.
   • Nom accessible via `label` (aria-label) — pas de label visible
   • Bouton « Effacer » (X) quand le champ n'est pas vide ; Échap efface
   • loading : l'icône loupe devient un spinner, annoncé une fois
   • empty   : message visible « Aucun résultat », annoncé (role="status")
   • Pas de debounce ici : c'est au parent de décider quand lancer la requête
   ══════════════════════════════════════════════════════════════ */

import { useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import './SearchInput.css';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  value:         string;
  onValueChange: (value: string) => void;
  /** Nom accessible du champ (ex. « Rechercher une mission ») */
  label:         string;
  /** Recherche en cours */
  loading?:      boolean;
  /** Recherche terminée sans résultat */
  empty?:        boolean;
  emptyText?:    string;
  clearLabel?:   string;
  /** Appelé après l'effacement (en plus de onValueChange('')) */
  onClear?:      () => void;
}

export function SearchInput({
  value,
  onValueChange,
  label,
  loading = false,
  empty = false,
  emptyText = 'Aucun résultat',
  clearLabel = 'Effacer la recherche',
  onClear,
  disabled,
  className = '',
  onKeyDown,
  ...rest
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  const clear = () => {
    onValueChange('');
    onClear?.();
    inputRef.current?.focus(); /* le focus reste dans le champ après effacement */
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && hasValue) {
      e.preventDefault();
      clear();
    }
  };

  const statusText = loading ? 'Recherche en cours…' : empty ? emptyText : '';

  return (
    <div className={['im-search', className].filter(Boolean).join(' ')}>
      <div className="im-search__control">
        <span className="im-search__icon" aria-hidden="true">
          {loading
            ? <Loader2 className="im-search__spinner" size={18} />
            : <Search size={18} />}
        </span>

        <input
          {...rest}
          ref={inputRef}
          type="search"
          className="im-search__field"
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-busy={loading || undefined}
          onChange={e => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {hasValue && !disabled && (
          <button
            type="button"
            className="im-search__clear"
            aria-label={clearLabel}
            onClick={clear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Toujours présent dans le DOM : une zone live doit exister avant que son
          contenu change pour être annoncée. Visible uniquement pour « vide ». */}
      <p
        role="status"
        className={['im-search__status', empty && !loading ? 'im-search__status--visible' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {statusText}
      </p>
    </div>
  );
}
