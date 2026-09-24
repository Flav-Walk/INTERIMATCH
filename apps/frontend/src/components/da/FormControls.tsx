import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Check, CircleX, Plus } from "lucide-react";
import type { ReactNode } from "react";
import AnimatedToggle from "../ui/animated-toggle";
import { cn } from "../../lib/utils";

/*
 * Les contrôles du formulaire de profil, montés sur les composants SmoothUI.
 *
 * Règle commune : on garde de VRAIES cases à cocher et de vrais boutons radio
 * (<input>) pour que le formulaire, le clavier, les lecteurs d'écran et les
 * tests e2e (getByRole("checkbox"), getByLabel(...).check()) marchent comme
 * avant. L'input est posé par-dessus le visuel, en transparent
 * (opacity-0 absolute inset-0) : un clic sur le visuel coche l'input.
 */

// ── 1. Étiquettes à choisir : Animated Tags (SmoothUI) ──────────────────────

export interface TagOption {
  value: string;
  label: string;
}

/*
 * Adapté d’Animated Tags de SmoothUI (https://smoothui.dev/docs/components/animated-tags) :
 * le composant d’origine utilise des <div> cliquables sans case à cocher, donc
 * je reprends son principe et ses animations ici, avec de vrais <input>.
 *
 * Comme dans SmoothUI : les étiquettes choisies (fond vert, croix pour
 * retirer) d'un côté, les disponibles (plus pour ajouter) de l'autre. Quand on
 * clique, l'étiquette GLISSE d'un groupe à l'autre (layout de Motion), avec
 * le même fondu flou que SmoothUI.
 */
export function ChoiceTags({
  name,
  options,
  selected,
  onToggle,
  groupLabel,
  emptyText = "Aucune sélection pour l’instant.",
}: {
  name: string;
  options: TagOption[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  /** Nom du groupe pour les lecteurs d'écran (« Compétences »…). */
  groupLabel: string;
  emptyText?: string;
}) {
  const reduceMotion = useReducedMotion();
  const chosen = options.filter((option) => selected.includes(option.value));
  const available = options.filter((option) => !selected.includes(option.value));

  // Le fondu flou de SmoothUI, désactivé si « Réduire les animations ».
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, filter: "blur(4px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        transition: { type: "spring" as const, bounce: 0, duration: 0.3 },
      };

  const tag = (option: TagOption, checked: boolean) => (
    <motion.label
      key={option.value}
      layout={!reduceMotion}
      {...motionProps}
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        checked
          ? "border-forest bg-forest text-white"
          : "border-border bg-surface text-foreground hover:border-forest/50",
      )}
    >
      {/* La vraie case à cocher, invisible, par-dessus toute l'étiquette. */}
      <input
        type="checkbox"
        name={name}
        value={option.value}
        checked={checked}
        onChange={(event) => onToggle(option.value, event.target.checked)}
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
      />
      {option.label}
      {checked ? (
        <CircleX size={15} aria-hidden="true" className="opacity-80" />
      ) : (
        <Plus size={15} aria-hidden="true" className="text-muted-foreground" />
      )}
    </motion.label>
  );

  return (
    <LayoutGroup id={name}>
      {/* UN SEUL conteneur : React déplace les étiquettes au lieu de les
          recréer. L'input coché reste donc le même élément (important pour
          le clavier et les tests e2e), et Motion anime le déplacement. Les
          étiquettes choisies passent devant, puis un séparateur, puis les
          autres : c'est la version « une zone » des deux cadres SmoothUI. */}
      <div
        role="group"
        aria-label={groupLabel}
        className="da-scope flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-forest/25 bg-tint/40 p-2.5"
      >
        {chosen.map((option) => tag(option, true))}
        {chosen.length === 0 && (
          <motion.span layout key="empty" className="px-1 py-1.5 text-sm text-muted-foreground">
            {emptyText}
          </motion.span>
        )}
        {available.length > 0 && (
          <motion.span
            layout={!reduceMotion}
            key="divider"
            aria-hidden="true"
            className="mx-1 h-6 w-px bg-forest/20"
          />
        )}
        {available.map((option) => tag(option, false))}
      </div>
    </LayoutGroup>
  );
}

// ── 1 bis. Grille de tuiles à cocher (vue « tout d'un coup d'œil ») ───────

/*
 * Variante de ChoiceTags pour la carte Bento « Compétences & Métiers ».
 *
 * Différence volontaire : ici les tuiles NE BOUGENT PAS quand on les coche.
 * Chaque option garde sa place dans une grille régulière (2 → 3 → 4
 * colonnes), donc l'œil retrouve « Relation client » toujours au même
 * endroit : saisie plus rapide, pas de saut de mise en page.
 *
 * - Forme « bulle » (pastille ronde) conservée, comme les anciens chips.
 * - Au repos : fond gris clair, texte sombre, anneau vide.
 * - Cochée : fond vert foncé, texte blanc, coche (✓) qui apparaît.
 *
 * Le groupe est un <fieldset> + <legend> : il est exposé comme « group »
 * nommé par sa légende (getByRole("group", { name: "Vos compétences" })).
 */
export function ChoiceGrid({
  name,
  legend,
  options,
  selected,
  onToggle,
  optional = false,
  hint,
}: {
  name: string;
  /** Titre visible du groupe, aussi son nom accessible. */
  legend: string;
  options: TagOption[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  optional?: boolean;
  hint?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // On ne compte que les choix encore présents dans le référentiel.
  const count = options.filter((option) => selected.includes(option.value)).length;

  return (
    <fieldset className="profile-chip-group da-scope m-0 grid min-w-0 gap-2 border-0 bg-transparent p-0">
      <legend className="mb-1 flex w-full flex-wrap items-baseline gap-x-2 p-0 font-sans text-base font-bold text-foreground">
        <span>{legend}</span>
        {optional && (
          <span className="text-sm font-medium text-muted-foreground">(facultatif)</span>
        )}
        {/* Compteur : repère immédiat de ce qui est déjà choisi. */}
        <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
          {count} / {options.length}
        </span>
      </legend>
      {hint && <p className="m-0 text-sm text-muted-foreground">{hint}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-full border py-2 pl-2.5 pr-4 text-sm leading-tight",
                "transition-colors duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                checked
                  ? "border-forest bg-forest font-bold text-white"
                  : "border-transparent bg-foreground/[0.05] font-semibold text-foreground hover:border-forest/40 hover:bg-tint/70",
              )}
            >
              {/* La vraie case à cocher, invisible, par-dessus toute la tuile. */}
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={(event) => onToggle(option.value, event.target.checked)}
                className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
              />
              {/* Indicateur : anneau vide → pastille blanche avec coche. */}
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] transition-colors duration-150",
                  checked
                    ? "border-white bg-white text-forest"
                    : "border-foreground/30 bg-surface",
                )}
              >
                {checked && (
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.35, duration: 0.3 }}
                    className="inline-flex"
                  >
                    <Check size={13} strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── 2. Interrupteur : Animated Toggle (SmoothUI) ────────────────────────────

/*
 * Une ligne « texte + interrupteur ». Le dessin de l'interrupteur vient
 * d'Animated Toggle (SmoothUI, variante morph : pastille carrée → ronde).
 * La vraie case à cocher est invisible, par-dessus l'interrupteur.
 */
export function SwitchField({
  label,
  description,
  checked,
  disabled = false,
  onChange,
  name,
  aside,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  /** Texte à droite (ex. « Recherche active »). */
  aside?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "da-scope relative flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold text-foreground">{label}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </span>
      {aside}
      <span className="relative inline-flex">
        <AnimatedToggle decorative checked={checked} disabled={disabled} variant="morph" size="lg"/>
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </span>
    </label>
  );
}

// ── 3. Choix exclusif : segment d'Animated Tabs (SmoothUI) ──────────────────

/*
 * Deux (ou plus) choix exclusifs, dessinés comme la variante « segment »
 * d'Animated Tabs : le fond blanc GLISSE sous l'option choisie (layoutId).
 * Chaque option est un vrai bouton radio invisible.
 */
export function SegmentedChoice({
  name,
  legend,
  legendId,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  legendId: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="da-scope grid gap-2" role="radiogroup" aria-labelledby={legendId}>
      <span id={legendId} className="choice-label">
        {legend}
      </span>
      <div className="inline-flex w-fit rounded-lg bg-tint p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${name}-segment`}
                  className="absolute inset-0 rounded-md border border-border bg-surface shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.05, duration: 0.25 }}
                />
              )}
              <input
                type="radio"
                name={name}
                checked={active}
                onChange={() => onChange(option.value)}
                className="absolute inset-0 z-20 m-0 size-full cursor-pointer opacity-0"
              />
              <span className="relative z-10">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
