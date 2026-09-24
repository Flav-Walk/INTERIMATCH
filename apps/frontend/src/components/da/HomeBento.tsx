import type { ReactNode } from "react";
import { Check, MapPin, UserRound } from "lucide-react";
import type { MissionMedia } from "../../services/missions";
import { UnsplashCredit } from "../mission/MissionPhotoField";
import { BentoGrid, BentoGridItem } from "../ui/bento-grid";
import { Ripple } from "../ui/ripple";
import { AnimatedList } from "../ui/animated-list";
import { NumberTicker } from "../ui/number-ticker";
import { BorderBeam } from "../ui/border-beam";
import CalendarEvent from "../ui/calendar-event";
import { BlurFade } from "../ui/blur-fade";
import { AnimatedTimeline } from "../ui/animated-timeline";
import { cn } from "../../lib/utils";

/*
 * Les avantages de l'accueil, en grille bento (Bento Grid d'Aceternity UI).
 *
 * Retour de revue : la grille bento plaisait, mais ses cases pastel restaient
 * vides. Ici chaque case a un vrai visuel animé, pris dans les librairies :
 *
 *   Intérimaires                          Établissements
 *   ┌────────┬────────────────┐           ┌────────────────┬────────┐
 *   │        │ Zone  (Ripple) │           │ Profils (List) │        │
 *   │ photo  ├───────┬────────┤           ├───────┬────────┤ photo  │
 *   │        │ Match │ Agenda │           │ Besoin│ Suivi  │        │
 *   └────────┴───────┴────────┘           └───────┴────────┴────────┘
 *
 * - Ripple (Magic UI) : des ondes autour de la ville → le rayon de mobilité.
 * - Animated List (Magic UI) : les critères du rapprochement arrivent un par
 *   un, comme des notifications.
 * - Calendar Event (Animata) : un widget agenda façon iOS → les créneaux.
 * - Number Ticker (Magic UI) : le score de compatibilité qui monte.
 * - Border Beam (Magic UI) : un trait de lumière qui fait le tour de la
 *   mission publiée.
 * - Animated Timeline (Animata) : les étapes du suivi d'une candidature.
 *
 * Toutes les données des visuels sont des EXEMPLES (illustration) : les
 * visuels sont masqués aux lecteurs d'écran (aria-hidden), seuls les titres
 * et les textes sont lus.
 */

export interface BentoFeature {
  title: string;
  desc: string;
}

// ── Visuels intérimaires ────────────────────────────────────────────────────

/** Ripple (Magic UI) : ondes concentriques autour de la ville. */
function ZoneVisual() {
  return (
    <div className="relative flex h-full min-h-40 w-full items-center justify-center overflow-hidden rounded-lg bg-tint/60">
      <Ripple mainCircleSize={90} numCircles={5} mainCircleOpacity={0.4} />
      <span className="z-10 flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
        <MapPin size={15} /> Lyon · 20 km
      </span>
      {/* Villes autour, placées à la main pour l'illustration. */}
      <span className="absolute top-5 left-[18%] text-xs font-medium text-forest/70">Villeurbanne</span>
      <span className="absolute right-[16%] bottom-6 text-xs font-medium text-forest/70">Vénissieux</span>
      <span className="absolute top-8 right-[20%] text-xs font-medium text-forest/40">Caluire</span>
    </div>
  );
}

// Une ligne de critère, affichée comme une notification.
function Criterion({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-white">
        <Check size={13} strokeWidth={3} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ml-auto text-xs font-semibold text-forest">{value}</span>
    </div>
  );
}

/** Animated List (Magic UI) : les critères arrivent l'un après l'autre. */
function MatchVisual() {
  return (
    <div className="relative h-full min-h-40 overflow-hidden">
      <AnimatedList delay={1400} className="gap-2">
        <Criterion key="metier" label="Métier" value="Serveur" />
        <Criterion key="competence" label="Compétence" value="Service en salle" />
        <Criterion key="distance" label="Distance" value="12 km" />
        <Criterion key="creneau" label="Créneau" value="Sam. 18 h – 23 h" />
      </AnimatedList>
      {/* Fondu en bas : la liste « sort » de la case en douceur. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-surface" />
    </div>
  );
}

/** Calendar Event (Animata) : les créneaux déclarés, façon widget. */
function AgendaVisual() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <CalendarEvent
        className="size-auto w-full max-w-56 rounded-2xl shadow-sm"
        events={[
          { title: "Service du soir", time: "18:00 – 23:00", variant: "emerald" },
          { title: "Brunch", time: "11:00 – 15:00", variant: "amber" },
        ]}
        maxVisible={2}
      />
    </div>
  );
}

// ── Visuels établissements ──────────────────────────────────────────────────

function Candidate({ name, job, score }: { name: string; job: string; score: number }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-forest">
        <UserRound size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{job}</span>
      </span>
      {/* Number Ticker : le score monte jusqu'à sa valeur. */}
      <span className="ml-auto font-brand text-lg font-semibold text-forest">
        <NumberTicker value={score} />
        <span className="text-xs">%</span>
      </span>
    </div>
  );
}

/** Animated List + Number Ticker : les profils compatibles arrivent. */
function ProfilesVisual() {
  return (
    <div className="relative h-full min-h-40 overflow-hidden">
      <AnimatedList delay={1600} className="gap-2">
        <Candidate key="c1" name="Camille M." job="Serveuse · 8 km" score={92} />
        <Candidate key="c2" name="Yanis B." job="Serveur · 14 km" score={85} />
        <Candidate key="c3" name="Léa D." job="Barmaid · 5 km" score={78} />
      </AnimatedList>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-surface" />
    </div>
  );
}

/** Border Beam (Magic UI) : un trait de lumière fait le tour de la mission. */
function MissionVisual() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <div className="relative w-full max-w-60 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-[11px] font-semibold tracking-wide text-orange-ink uppercase">Mission publiée</p>
        <p className="mt-1 font-brand text-lg leading-tight font-semibold text-foreground">Chef de partie</p>
        <p className="mt-2 text-xs text-muted-foreground">Ven. 12 · 10 h – 15 h · Lyon 2e</p>
        <p className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-forest">
          <span className="rounded-md bg-tint px-2 py-0.5">Cuisine chaude</span>
          <span className="rounded-md bg-tint px-2 py-0.5">HACCP</span>
        </p>
        <BorderBeam size={70} duration={7} colorFrom="oklch(0.75 0.17 43)" colorTo="oklch(0.42 0.085 165)" borderWidth={2} />
      </div>
    </div>
  );
}

/** Animated Timeline (Animata) : le suivi d'une candidature, étape par
 *  étape. initialActiveIndex=1 : « Reçue » et « Examinée » sont allumées. */
function FollowVisual() {
  return (
    <div className="flex h-full min-h-40 items-start">
      <AnimatedTimeline
        className="w-full py-1"
        initialActiveIndex={1}
        events={[
          { id: "recue", title: "Candidature reçue", description: "Camille M. · Serveuse" },
          { id: "examinee", title: "Profil examiné", description: "Critères et disponibilités" },
          { id: "retenue", title: "Mission attribuée", description: "Vous confirmez" },
        ]}
        styles={TIMELINE_STYLES}
        customEventRender={(event) => (
          <div className="-mt-0.5 pb-2">
            <p className="text-sm leading-tight font-semibold text-foreground">{event.title}</p>
            <p className="text-xs leading-tight text-muted-foreground">{event.description}</p>
          </div>
        )}
      />
    </div>
  );
}

// Couleurs de la timeline aux couleurs InteriMatch.
const TIMELINE_STYLES = {
  lineColor: "oklch(0.88 0.008 160)",
  activeLineColor: "oklch(0.32 0.065 165)",
  dotColor: "oklch(0.88 0.008 160)",
  activeDotColor: "oklch(0.32 0.065 165)",
  dotSize: "0.875rem",
};

// ── La grille ────────────────────────────────────────────────────────────────

function Cell({ feature, visual, className }: { feature: BentoFeature; visual: ReactNode; className?: string }) {
  return (
    <BentoGridItem
      className={cn("rounded-2xl border-border bg-surface p-5", className)}
      header={<div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden">{visual}</div>}
      // Vrais titres <h3> : SEO et navigation au lecteur d'écran.
      title={<h3 className="font-brand text-lg font-semibold text-foreground">{feature.title}</h3>}
      description={<p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>}
    />
  );
}

/** La photo du métier, qui occupe une colonne sur deux lignes. */
function PhotoCell({ photo, className }: { photo: MissionMedia; className?: string }) {
  return (
    <figure className={cn("relative m-0 overflow-hidden rounded-2xl md:row-span-2", className)}>
      <img src={photo.url} alt="" loading="lazy" decoding="async" className="size-full min-h-72 object-cover" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 px-4 pt-8 pb-3 text-xs text-white/85">
        <UnsplashCredit media={photo} />
      </figcaption>
    </figure>
  );
}

export function WorkerBento({ features, photo }: { features: BentoFeature[]; photo: MissionMedia }) {
  const [zone, match, agenda] = features;
  return (
    <BlurFade inView duration={0.6}>
      <BentoGrid className="max-w-none md:auto-rows-[21rem]">
        <PhotoCell photo={photo} />
        <Cell feature={zone} visual={<ZoneVisual />} className="md:col-span-2" />
        <Cell feature={match} visual={<MatchVisual />} />
        <Cell feature={agenda} visual={<AgendaVisual />} />
      </BentoGrid>
    </BlurFade>
  );
}

export function CompanyBento({ features, photo }: { features: BentoFeature[]; photo: MissionMedia }) {
  const [profiles, mission, follow] = features;
  return (
    <BlurFade inView duration={0.6}>
      {/* grid-flow-dense + col-start-3 : la photo passe à droite, en miroir. */}
      <BentoGrid className="max-w-none md:auto-rows-[21rem] md:grid-flow-dense">
        <PhotoCell photo={photo} className="md:col-start-3" />
        <Cell feature={profiles} visual={<ProfilesVisual />} className="md:col-span-2" />
        <Cell feature={mission} visual={<MissionVisual />} />
        <Cell feature={follow} visual={<FollowVisual />} />
      </BentoGrid>
    </BlurFade>
  );
}
