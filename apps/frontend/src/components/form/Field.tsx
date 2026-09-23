import { useEffect, useRef, type ReactNode } from "react";

/**
 * Primitives de formulaire partagées.
 *
 * Elles existaient déjà, en un seul exemplaire, à l'intérieur du formulaire de
 * mission. Les sortir ici sert moins à économiser des lignes qu'à garantir
 * qu'un champ se comporte pareil partout : même liaison ARIA, même place pour
 * l'aide, même place pour l'erreur. Un formulaire où l'erreur apparaît tantôt
 * au-dessus tantôt en dessous se relit à chaque écran.
 */

interface Described {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

export function Field({
  name,
  label,
  error,
  hint,
  optional,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /**
   * Mention « facultatif », rendue à part du libellé mais **à l'intérieur** de
   * celui-ci : le nom accessible reste « Description (facultatif) », tel que
   * l'entend un lecteur d'écran et tel que le cherchent les tests. Seule la
   * présentation change — la mention s'efface visuellement au lieu de peser
   * autant que le libellé.
   */
  optional?: boolean;
  children: (props: Described) => ReactNode;
}) {
  const described = [hint && `${name}-hint`, error && `${name}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={"field" + (error ? " has-error" : "")}>
      <label htmlFor={name}>
        {label}
        {/* L'espace est explicite : sans lui, le nom accessible devient
            « Description(facultatif) » d'un seul tenant. */}
        {optional && (
          <>
            {" "}
            <span className="field-optional">(facultatif)</span>
          </>
        )}
      </label>
      {hint && (
        <p className="quiet field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {children({
        id: name,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(described ? { "aria-describedby": described } : {}),
      })}
      {error && (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Récapitulatif des erreurs, en tête du formulaire.
 *
 * Sur un formulaire long — et celui d'une mission l'est — placer le curseur
 * dans le premier champ fautif ne suffit pas : on apprend qu'un champ ne va
 * pas, jamais combien il y en a, ni lesquels. Sur un téléphone, l'envoi semble
 * alors n'avoir eu aucun effet.
 *
 * Le bloc prend le focus à l'apparition, ce qui le fait lire à voix haute, et
 * chaque ligne mène au champ concerné.
 */
export function ErrorSummary<K extends string>({
  errors,
  labels,
  title = "Le formulaire n’a pas pu être envoyé",
}: {
  errors: Partial<Record<K, string>>;
  /** Libellé lisible de chaque champ, pour ne pas afficher un nom technique. */
  labels: Record<K, string>;
  title?: string;
}) {
  const entries = Object.entries(errors) as [K, string][];
  const box = useRef<HTMLDivElement>(null);
  const count = entries.length;

  useEffect(() => {
    if (count > 0) box.current?.focus();
  }, [count]);

  if (!count) return null;
  return (
    <div
      className="form-summary"
      role="alert"
      tabIndex={-1}
      ref={box}
      aria-labelledby="form-summary-title"
    >
      <p id="form-summary-title">
        <strong>{title}</strong> — {count} point{count > 1 ? "s" : ""} à
        corriger.
      </p>
      <ul>
        {entries.map(([key, message]) => (
          <li key={key}>
            <a
              href={`#${key}`}
              onClick={(event) => {
                // Un ancrage suffirait à déplacer la page, pas le focus : sans
                // cela, on arrive au bon endroit sans pouvoir taper.
                event.preventDefault();
                document.getElementById(key)?.focus();
              }}
            >
              {labels[key]}
            </a>
            {" : "}
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Prévient avant de quitter une saisie non enregistrée.
 *
 * Uniquement la fermeture d'onglet et le rechargement : le navigateur ne laisse
 * rien intercepter d'autre, et un formulaire quitté par un lien interne reste
 * de toute façon rechargeable depuis le brouillon enregistré.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
