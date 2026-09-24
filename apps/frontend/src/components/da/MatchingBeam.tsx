import { forwardRef, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  BedDouble,
  Check,
  ChefHat,
  ConciergeBell,
  Martini,
  Store,
  Wine,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedBeam } from "../ui/animated-beam";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

/*
 * Visuel du haut de l'accueil : le rapprochement, montré en action.
 *
 * Refonte (revue du 24/09) :
 * - 3 métiers ↔ 3 établissements : le schéma est enfin symétrique.
 * - Un panneau vert dépoli isole le schéma de la photo de fond (les verres
 *   prenaient le dessus, et les libellés blancs manquaient de contraste).
 * - Le centre porte le wordmark « InteriMatch » et plus le monogramme « IM »
 *   (cf. Logo.tsx : pas de monogramme redondant).
 * - Toutes les 3,6 s, une paire métier → établissement s'allume et une
 *   carte affiche les critères du rapprochement. C'est la
 *   promesse du titre (« critères visibles ») rendue concrète.
 *
 * Rien n'est une vraie donnée : c'est une illustration, d'où aria-hidden
 * sur tout le bloc.
 *
 * Composant utilisé : Animated Beam de Magic UI
 * https://magicui.design/docs/components/animated-beam
 * Il mesure la position de deux éléments (refs) dans le conteneur et trace
 * une courbe SVG entre leurs centres, sur laquelle glisse un dégradé.
 */

// Durée d'affichage de chaque paire, en millisecondes.
const CYCLE_MS = 3600;

// Les paires qui défilent. `from` = index du métier, `to` = index de
// l'établissement. Les villes restent dans la zone couverte (AURA).
const PAIRS = [
  { from: 0, to: 1, place: "Lyon 2e", distance: "3 km", slot: "Ce soir · 19h–23h" },
  { from: 1, to: 0, place: "Annecy", distance: "6 km", slot: "Samedi · 7h–15h" },
  { from: 2, to: 2, place: "Grenoble", distance: "2 km", slot: "Vendredi · 20h–2h" },
] as const;

const JOBS = [
  { label: "Serveur", icon: <ConciergeBell size={20} /> },
  { label: "Cuisinier", icon: <ChefHat size={20} /> },
  { label: "Barman", icon: <Wine size={20} /> },
];

const PLACES = [
  { label: "Hôtel", icon: <BedDouble size={20} /> },
  { label: "Restaurant", icon: <Store size={20} /> },
  { label: "Bar", icon: <Martini size={20} /> },
];

// Couleurs des faisceaux : orange de marque vers vert clair.
const BEAM_BASE = {
  pathColor: "rgb(255 255 255)",
  pathOpacity: 0.14,
  pathWidth: 2,
};
const BEAM_LIGHT = {
  gradientStartColor: "oklch(0.75 0.17 43)",
  gradientStopColor: "oklch(0.9 0.08 160)",
};
const BEAM_OFF = {
  gradientStartColor: "transparent",
  gradientStopColor: "transparent",
};

// Courbure par position (haut, milieu, bas) : les traits du haut et du bas
// se bombent vers le centre, celui du milieu reste droit.
const CURVES = [-28, 0, 28];

// Une tuile blanche avec une icône et son libellé dans une pastille sombre
// (contraste AA garanti, quelle que soit la photo derrière).
// forwardRef : Animated Beam mesure la tuile elle-même, pas le libellé.
const Node = forwardRef<
  HTMLDivElement,
  { children: ReactNode; label: string; active: boolean }
>(({ children, label, active }, ref) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-12 items-center justify-center rounded-2xl bg-white text-forest shadow-[0_8px_24px_rgb(0_0_0/0.25)] transition-all duration-500 sm:size-14",
        active
          ? "scale-110 ring-2 ring-orange ring-offset-2 ring-offset-forest"
          : "opacity-80",
      )}
    >
      {children}
    </div>
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors duration-500 sm:text-xs",
        active ? "bg-orange text-forest" : "bg-black/35 text-white",
      )}
    >
      {label}
    </span>
  </div>
));
Node.displayName = "Node";

export function MatchingBeam() {
  // « Réduire les animations » : une seule paire, fixe, sans lumière.
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % PAIRS.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const containerRef = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  // Une ref par tuile, dans l'ordre de JOBS et PLACES.
  const jobRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const placeRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  const pair = PAIRS[active];
  const light = reduceMotion ? BEAM_OFF : BEAM_LIGHT;

  // Trait côté établissement : on le trace de l'établissement vers le
  // centre, avec la même courbure que côté métier, pour un dessin en miroir.
  // Le dégradé avance toujours de gauche à droite : visuellement, la lumière
  // va bien du centre vers l'établissement.
  const beam = (
    from: RefObject<HTMLDivElement | null>,
    to: RefObject<HTMLDivElement | null>,
    curve: number,
  ) => ({ containerRef, fromRef: from, toRef: to, curvature: curve });

  return (
    <BlurFade delay={0.35} duration={0.7} className="w-full max-w-[520px]">
      {/* aria-hidden : c'est un dessin, le texte à gauche dit déjà tout. */}
      <div
        aria-hidden="true"
        className="w-full rounded-[28px] border border-white/10 bg-[oklch(0.24_0.05_165/0.6)] p-4 shadow-[0_24px_60px_rgb(0_0_0/0.35)] backdrop-blur-md sm:p-6"
      >
        <div
          ref={containerRef}
          className="relative flex h-[260px] w-full items-center justify-between sm:h-[290px]"
        >
          <div className="flex h-full flex-col justify-between py-1">
            {JOBS.map((job, i) => (
              <Node key={job.label} ref={jobRefs[i]} label={job.label} active={pair.from === i}>
                {job.icon}
              </Node>
            ))}
          </div>

          {/* Le centre : le wordmark, qui « pulse » à chaque nouvelle paire. */}
          <motion.div
            ref={hub}
            key={reduceMotion ? "hub" : `hub-${active}`}
            initial={reduceMotion ? false : { scale: 0.94 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="z-10 rounded-2xl border border-orange/50 bg-forest px-3 py-2.5 font-brand text-base font-semibold text-white shadow-[0_0_0_6px_oklch(0.75_0.17_43/0.12),0_10px_30px_rgb(0_0_0/0.35)] sm:px-4 sm:py-3 sm:text-lg"
          >
            InteriMatch
          </motion.div>

          <div className="flex h-full flex-col justify-between py-1">
            {PLACES.map((place, i) => (
              <Node key={place.label} ref={placeRefs[i]} label={place.label} active={pair.to === i}>
                {place.icon}
              </Node>
            ))}
          </div>

          {/* Traits de fond : les 6 liaisons possibles, sans lumière. */}
          {jobRefs.map((ref, i) => (
            <AnimatedBeam key={`job-${i}`} {...beam(ref, hub, CURVES[i])} {...BEAM_BASE} {...BEAM_OFF} />
          ))}
          {placeRefs.map((ref, i) => (
            <AnimatedBeam key={`place-${i}`} {...beam(ref, hub, CURVES[i])} {...BEAM_BASE} {...BEAM_OFF} />
          ))}

          {/* La paire active : la clé change à chaque paire, donc les deux
              faisceaux repartent de zéro (métier → centre, puis centre →
              établissement, 0,9 s plus tard). */}
          <AnimatedBeam
            key={`on-job-${active}`}
            {...beam(jobRefs[pair.from], hub, CURVES[pair.from])}
            {...BEAM_BASE}
            {...light}
            pathOpacity={0.35}
            duration={1.8}
            repeatDelay={0.4}
          />
          <AnimatedBeam
            key={`on-place-${active}`}
            {...beam(placeRefs[pair.to], hub, CURVES[pair.to])}
            {...BEAM_BASE}
            {...light}
            pathOpacity={0.35}
            duration={1.8}
            delay={0.9}
            repeatDelay={0.4}
          />
        </div>

        {/* Carte résultat : ce que le rapprochement a vérifié. Hauteur fixe
            pour que le hero ne saute pas à chaque changement. */}
        <div className="relative mt-4 h-[92px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_30px_rgb(0_0_0/0.25)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-forest">
                  {JOBS[pair.from].label} → {PLACES[pair.to].label}
                  <span className="font-normal text-muted-foreground"> · {pair.place}</span>
                </p>
                <span className="shrink-0 rounded-full bg-orange/15 px-2 py-0.5 text-[11px] font-semibold text-orange-ink">
                  {pair.slot}
                </span>
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {["Métier", `À ${pair.distance}`, "Disponible"].map((c) => (
                  <li
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-forest"
                  >
                    <Check size={12} strokeWidth={3} className="text-forest" />
                    {c}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </BlurFade>
  );
}
