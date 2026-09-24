import { MapPin } from "lucide-react";
import CalendarEvent, { type CalendarEventItem } from "../ui/calendar-event";
import { Ripple } from "../ui/ripple";
import { NumberTicker } from "../ui/number-ticker";
import type { Availability } from "../../services/session";

/*
 * Les visuels des cartes de droite du tableau de bord intérimaire.
 *
 * Avant, chaque carte commençait par une icône dans un carré teinté (calendrier,
 * épingle…) : c'est le motif « tuile d'icône » relevé en revue. Chaque carte
 * a maintenant un vrai visuel, tiré des librairies :
 *
 * - AvailabilityWidget : widget agenda Calendar Event (Animata), rempli avec
 *   les VRAIS créneaux de l'intérimaire.
 * - MobilityRadar : Ripple (Magic UI), des cercles autour de la ville → le
 *   rayon de mobilité.
 * - LeadNumber : Number Ticker (Magic UI), le chiffre qui défile jusqu'à sa
 *   valeur.
 */

const day = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const time = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

/** Calendar Event (Animata) avec les prochains créneaux déclarés. */
export function AvailabilityWidget({ slots }: { slots: Availability[] }) {
  const first = slots[0];
  if (!first) return null;
  // Un créneau = une pastille : le jour en titre, les heures dessous.
  // On alterne vert et ambre pour distinguer deux créneaux qui se suivent.
  const events: CalendarEventItem[] = slots.map((slot, index) => ({
    title: day.format(new Date(slot.starts_at)),
    time: `${time.format(new Date(slot.starts_at))} – ${time.format(new Date(slot.ends_at))}`,
    variant: index % 2 ? "amber" : "emerald",
  }));
  return (
    <CalendarEvent
      className="my-3 size-auto w-full rounded-2xl shadow-none"
      date={new Date(first.starts_at)}
      events={events}
      maxVisible={2}
    />
  );
}

/** Ripple (Magic UI) : la ville au centre, les cercles figurent le rayon. */
export function MobilityRadar({ city, radius }: { city: string; radius?: number | null }) {
  return (
    <div className="relative my-3 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-surface/70" aria-hidden="true">
      <Ripple mainCircleSize={60} numCircles={4} mainCircleOpacity={0.35} />
      <span className="z-10 inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white shadow-md">
        <MapPin size={13} /> {city}
        {radius != null && <span className="text-white/70">· {radius} km</span>}
      </span>
    </div>
  );
}

/** Number Ticker (Magic UI) : le chiffre défile de 0 à sa valeur. */
export function LeadNumber({ value }: { value: number }) {
  return <NumberTicker value={value} />;
}
