import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Champ de mot de passe avec bascule afficher / masquer.
 *
 * Le bouton est un `type="button"` : sans cela il soumettrait le formulaire,
 * puisque tout bouton dans un `<form>` vaut `submit` par défaut. La bascule ne
 * touche que l'attribut `type` de l'input — la valeur saisie n'est jamais lue,
 * réécrite ni perdue.
 */
export function PasswordField({
  name,
  label,
  toggleFor,
  value,
  onChange,
  autoComplete,
  minLength,
  describedBy,
}: {
  name: string;
  label: string;
  /** Complément du bouton : « Afficher <ceci> ». Écrit, pas dérivé du libellé,
   *  parce que « Afficher le confirmer le mot de passe » ne veut rien dire. */
  toggleFor: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          required
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShown((current) => !current)}
          aria-pressed={shown}
          aria-label={(shown ? "Masquer " : "Afficher ") + toggleFor}
        >
          {shown ? (
            <EyeOff size={17} aria-hidden="true" />
          ) : (
            <Eye size={17} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
