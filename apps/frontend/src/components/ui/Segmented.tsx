import { useCallback, useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";

/**
 * Sélecteur segmenté, avec indicateur qui glisse d'un onglet à l'autre.
 *
 * SOURCE : SmoothUI — `animated-tabs` (https://smoothui.dev/docs/components/animated-tabs),
 * récupéré depuis https://smoothui.dev/r/animated-tabs.json. Licence MIT.
 *
 * CE QUI A ÉTÉ REPRIS TEL QUEL, PARCE QUE C'EST LA PARTIE DIFFICILE.
 * - Le `layoutId` : l'indicateur n'est pas déplacé, il est DÉMONTÉ puis
 *   remonté sous l'onglet actif, et Motion interpole la transition entre les
 *   deux positions. C'est ce qui le fait glisser sans mesurer quoi que ce soit.
 * - La navigation au clavier complète — flèches, Home, End — avec `tabIndex`
 *   roving : un seul onglet est atteignable à la tabulation, les flèches
 *   circulent entre eux. C'est ce qu'exige le motif ARIA `tablist`, et c'est
 *   ce que presque aucun onglet maison n'implémente.
 * - `useReducedMotion`, déjà présent dans la source.
 *
 * CE QUI A ÉTÉ ADAPTÉ.
 * - Les trois variantes d'origine (underline / pill / segment) sont réduites à
 *   DEUX, et renommées : `rail` (un filet sous l'onglet actif, pour naviguer
 *   entre des vues) et `switch` (un bloc plein dans un cadre, pour filtrer une
 *   liste). Garder les trois revenait à laisser chaque écran choisir, et donc
 *   à voir apparaître les trois sur la même page.
 * - Les couleurs `bg-muted` / `text-foreground` de shadcn sont remplacées par
 *   les jetons InteriMatch.
 * - Ajout d'un compteur facultatif par onglet. Un filtre « Candidatures » qui
 *   ne dit pas combien il en reste oblige à cliquer pour savoir s'il y a
 *   quelque chose à voir.
 * - `aria-controls` accepté : la source déclare `role="tab"` sans jamais lier
 *   l'onglet à son panneau, ce qui laisse le motif ARIA incomplet.
 * - DEUX SÉMANTIQUES, et c'est le seul ajout de fond. La source ne connaît que
 *   `tablist` / `tab`. Or la moitié des usages du produit ne sont pas des
 *   onglets : filtrer une liste de missions par statut ne change pas de
 *   panneau, cela restreint le même. Le motif juste y est un groupe de boutons
 *   à deux états — `aria-pressed` — et non `aria-selected` sur un `tab`. Les
 *   annoncer comme des onglets ferait attendre à une synthèse vocale un
 *   contenu qui ne vient jamais.
 */
export interface SegmentedItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function Segmented({
  items,
  value,
  onChange,
  variant = "rail",
  className,
  label,
  controls,
  mode = "tabs",
}: {
  items: SegmentedItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "rail" | "switch";
  className?: string;
  /** Intitulé du groupe, pour les synthèses vocales. */
  label: string;
  /** `id` du panneau gouverné, quand il y en a un seul. */
  controls?: string;
  /**
   * `tabs` : on change de vue. `filters` : on restreint la même liste, et les
   * entrées sont alors de simples boutons à deux états.
   */
  mode?: "tabs" | "filters";
}) {
  const still = useReducedMotion();
  const uid = useId().replace(/:/g, "");

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const step =
        event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowLeft"
            ? -1
            : event.key === "Home"
              ? -index
              : event.key === "End"
                ? items.length - 1 - index
                : null;
      if (step === null) return;
      event.preventDefault();
      const next = items[(index + step + items.length) % items.length];
      onChange(next.id);
      document.getElementById(`${uid}-${next.id}`)?.focus();
    },
    [items, onChange, uid],
  );

  const rail = variant === "rail";

  return (
    <div
      role={mode === "tabs" ? "tablist" : "group"}
      aria-label={label}
      className={cn(
        "relative inline-flex max-w-full overflow-x-auto",
        rail
          ? "gap-1 border-rule border-b"
          : "gap-0.5 rounded-[10px] border border-rule bg-paper-deep p-1",
        className,
      )}
    >
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            id={`${uid}-${item.id}`}
            type="button"
            role={mode === "tabs" ? "tab" : undefined}
            aria-selected={mode === "tabs" ? active : undefined}
            aria-pressed={mode === "filters" ? active : undefined}
            aria-controls={controls}
            tabIndex={mode === "tabs" && !active ? -1 : 0}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              // `border-0 bg-transparent` N'EST PAS DÉCORATIF : Preflight est
              // désactivé, donc un `<button>` nu conserve la bordure en relief
              // et le fond gris du navigateur. Sans ce retrait, les quatre
              // entrées apparaissent encadrées et l'indicateur actif ne se
              // distingue plus de rien.
              "relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 font-semibold text-[0.8125rem] transition-colors",
              rail ? "pb-2.5 pt-2" : "rounded-[7px] py-1.5",
              active ? "text-forest" : "text-ink-soft hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                layoutId={`seg-${uid}`}
                className={cn(
                  "absolute",
                  rail
                    ? "inset-x-0 -bottom-px h-[2px] rounded-full bg-forest"
                    : "inset-0 rounded-[7px] border border-rule bg-surface shadow-lift",
                )}
                transition={
                  still
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0.05, duration: 0.28 }
                }
              />
            )}
            {item.icon && (
              <span className="relative z-10 flex shrink-0">{item.icon}</span>
            )}
            <span className="relative z-10">{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "relative z-10 rounded-full px-1.5 py-px text-[0.6875rem] font-bold tabular-nums",
                  active
                    ? "bg-sage-tint text-forest"
                    : "bg-paper-deep text-ink-faint",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
