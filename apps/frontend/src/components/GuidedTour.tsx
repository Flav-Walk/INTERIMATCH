import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export interface TourStep {
  /** Valeur de l'attribut data-tour à mettre en évidence. Absent : bulle centrée. */
  target?: string;
  title: string;
  body: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const GAP = 14;
/** Sous cette largeur la bulle est ancrée en bas de l'écran plutôt que collée à la cible. */
const NARROW = 720;

function readBox(target: string | undefined): Box | null {
  if (!target) return null;
  const node = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

export function GuidedTour({
  steps,
  onClose,
  label,
}: {
  steps: TourStep[];
  /** completed vaut vrai si la visite est allée jusqu'au bout ou a été passée. */
  onClose: (completed: boolean) => void;
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    setBox(readBox(step?.target));
    const node = card.current;
    if (node) setSize({ w: node.offsetWidth, h: node.offsetHeight });
  }, [step]);

  // La cible peut être hors écran : on l'amène dans le viewport avant de mesurer.
  useLayoutEffect(() => {
    if (!step) return;
    const node = step.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null;
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const later = window.setTimeout(measure, 350);
    return () => window.clearTimeout(later);
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => card.current?.focus(), [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose(true);
        return;
      }
      if (event.key === "ArrowRight" && !last) {
        setIndex((i) => i + 1);
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        setIndex((i) => i - 1);
        return;
      }
      if (event.key === "Tab" && card.current) {
        const focusable = card.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (
            document.activeElement === first ||
            document.activeElement === card.current
          ) {
            event.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, last, onClose]);

  if (!step) return null;

  // La bulle n'est ancrée à la cible que si elle y tient entièrement : sinon elle est
  // rangée en bas de l'écran. Elle n'est jamais rognée par le bord du viewport.
  const narrow = typeof window !== "undefined" && window.innerWidth < NARROW;
  const fitsBelow =
    box && size
      ? box.top + box.height + GAP + size.h + GAP <= window.innerHeight
      : false;
  const fitsAbove = box && size ? box.top - GAP - size.h - GAP >= 0 : false;
  const docked = narrow || !box || !size || (!fitsBelow && !fitsAbove);

  const style: React.CSSProperties = docked
    ? {}
    : {
        top: fitsBelow
          ? box!.top + box!.height + GAP
          : box!.top - GAP - size!.h,
        left: Math.min(
          Math.max(GAP, box!.left),
          Math.max(GAP, window.innerWidth - size!.w - GAP),
        ),
      };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={label}>
      <svg className="tour-veil" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {box && (
              <rect
                x={box.left}
                y={box.top}
                width={box.width}
                height={box.height}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" mask="url(#tour-hole)" />
      </svg>
      {box && (
        <div
          className="tour-ring"
          aria-hidden="true"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        />
      )}
      <div
        className={docked ? "tour-card docked" : "tour-card"}
        style={style}
        ref={card}
        tabIndex={-1}
      >
        <p className="tour-progress">
          Étape {index + 1} sur {steps.length}
        </p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="text-button" onClick={() => onClose(true)}>
            Passer
          </button>
          <div className="tour-nav">
            {index > 0 && (
              <button
                className="secondary-button"
                onClick={() => setIndex(index - 1)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Précédent
              </button>
            )}
            <button
              className="button"
              onClick={() => (last ? onClose(true) : setIndex(index + 1))}
            >
              {last ? "Terminer" : "Suivant"}
              {last ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
