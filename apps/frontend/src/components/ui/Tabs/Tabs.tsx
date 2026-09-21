/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Tabs
   Composant composé : <Tabs> <TabsList> <TabsTrigger> <TabsContent>

   • État interne (defaultValue) OU contrôlé (value + onValueChange)
   • Indicateur glissant : pseudo-élément ::after de la liste, déplacé
     avec transform (translateX + scaleX) — jamais width/left.
     La position est mesurée en JS et passée en variables CSS
     (--indicator-x, --indicator-w).
   • RGAA / WAI-ARIA « Tabs » : tablist / tab / tabpanel, aria-selected,
     aria-controls, aria-labelledby, tabindex itinérant, flèches ← →,
     Début / Fin (l'onglet suivi par le focus est activé).
   ══════════════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import './Tabs.css';

/* ── Contexte ─────────────────────────────────────────────── */

interface TabsContextValue {
  /** Préfixe unique des id (tab ↔ panel) */
  baseId:   string;
  value:    string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> doit être utilisé à l'intérieur de <Tabs>`);
  return ctx;
}

/* Les valeurs peuvent contenir des espaces : un id HTML ne le peut pas. */
const slug = (value: string): string => value.replace(/\s+/g, '-');
const tabId   = (baseId: string, value: string): string => `${baseId}-tab-${slug(value)}`;
const panelId = (baseId: string, value: string): string => `${baseId}-panel-${slug(value)}`;

/* ── <Tabs> ───────────────────────────────────────────────── */

interface TabsBaseProps {
  /** Appelé à chaque changement d'onglet (mode interne ou contrôlé) */
  onValueChange?: (value: string) => void;
  className?:     string;
  children:       ReactNode;
}

/* Exactement l'un des deux modes : contrôlé (value) ou interne (defaultValue). */
export type TabsProps = TabsBaseProps &
  (
    | { value: string;     defaultValue?: never }
    | { value?: undefined; defaultValue: string }
  );

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className = '',
  children,
}: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue ?? '');

  const isControlled = value !== undefined;
  const current      = isControlled ? value : internal;

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ baseId, value: current, setValue }}>
      <div className={['tabs', className].filter(Boolean).join(' ')}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ── <TabsList> ───────────────────────────────────────────── */

export type TabsListProps = HTMLAttributes<HTMLDivElement>;

/** Donner un `aria-label` (ex. « Sections de la mission ») : c'est le nom du tablist. */
export function TabsList({ className = '', children, onKeyDown, ...rest }: TabsListProps) {
  const { value } = useTabsContext('TabsList');
  const listRef = useRef<HTMLDivElement>(null);

  /* Mesure de l'onglet actif → variables CSS lues par ::after.
     useLayoutEffect : la position est posée avant le premier rendu écran. */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let cancelled = false;

    const update = () => {
      if (cancelled) return;
      const active = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      list.style.setProperty('--indicator-x', `${active?.offsetLeft ?? 0}px`);
      list.style.setProperty('--indicator-w', String(active?.offsetWidth ?? 0));
    };

    update();

    /* La transition ne s'active qu'après la première mesure :
       pas de glissement depuis 0 au chargement. */
    const raf = requestAnimationFrame(() => { list.dataset.ready = 'true'; });

    /* Largeurs qui changent sans changement d'onglet : redimensionnement,
       chargement de la police, contenu d'un onglet qui évolue. */
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(list);
      list.querySelectorAll('[role="tab"]').forEach(tab => observer?.observe(tab));
    }
    void document.fonts?.ready.then(update);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [value]);

  /* Navigation clavier : ← → (en boucle), Début, Fin. */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
    );
    const index = tabs.findIndex(tab => tab === document.activeElement);
    if (index === -1) return;

    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft')  next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home')       next = 0;
    if (e.key === 'End')        next = tabs.length - 1;

    e.preventDefault();
    tabs[next].focus();
    tabs[next].click(); /* activation automatique : le focus suit la sélection */
  };

  return (
    <div
      {...rest}
      ref={listRef}
      role="tablist"
      className={['tabs__list', className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

/* ── <TabsTrigger> ────────────────────────────────────────── */

export interface TabsTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'role'> {
  /** Identifiant de l'onglet — doit correspondre à un <TabsContent value> */
  value: string;
}

export function TabsTrigger({
  value,
  className = '',
  onClick,
  children,
  ...rest
}: TabsTriggerProps) {
  const ctx      = useTabsContext('TabsTrigger');
  const selected = ctx.value === value;

  return (
    <button
      type="button"
      {...rest}
      role="tab"
      id={tabId(ctx.baseId, value)}
      aria-selected={selected}
      aria-controls={panelId(ctx.baseId, value)}
      /* Tabindex itinérant : seul l'onglet actif est dans l'ordre de tabulation */
      tabIndex={selected ? 0 : -1}
      className={['tabs__trigger', className].filter(Boolean).join(' ')}
      onClick={e => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.setValue(value);
      }}
    >
      {children}
    </button>
  );
}

/* ── <TabsContent> ────────────────────────────────────────── */

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Identifiant de l'onglet auquel ce panneau appartient */
  value: string;
  /** Garder le contenu monté quand le panneau est masqué (conserve son état) */
  keepMounted?: boolean;
}

export function TabsContent({
  value,
  keepMounted = false,
  className = '',
  children,
  ...rest
}: TabsContentProps) {
  const ctx      = useTabsContext('TabsContent');
  const selected = ctx.value === value;

  return (
    <div
      {...rest}
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      tabIndex={0}
      hidden={!selected}
      className={['tabs__panel', className].filter(Boolean).join(' ')}
    >
      {selected || keepMounted ? children : null}
    </div>
  );
}
