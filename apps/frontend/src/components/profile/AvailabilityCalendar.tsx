import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { coverageByDay, type DayCoverage } from "../../services/profile";
import type { Availability } from "../../services/session";
import { cn } from "../../lib/cn";

/**
 * Calendrier des disponibilités déclarées.
 *
 * SOURCE : Opensource UI — `BookingSlotCalendar`
 * (https://opensourceui.in/components/booking-slot-calendar). Licence MIT.
 * On en reprend la structure — bande de jours navigable, sélection d'un jour,
 * jours passés désactivés et non simplement grisés, transitions d'entrée au
 * changement de période — ainsi que ses utilitaires de dates.
 *
 * CE QUI A ÉTÉ ADAPTÉ, ET POURQUOI C'EST UN CHANGEMENT DE NATURE.
 * L'original RÉSERVE un créneau dans un agenda dont les disponibilités sont
 * données : sept jours, huit horaires fixes, deux d'entre eux marqués pris.
 * Ici, l'utilisateur DÉCLARE ses propres disponibilités, et elles ne
 * ressemblent pas à des rendez-vous : un créneau InteriMatch est un intervalle
 * daté, qui va de trois heures à trois mois.
 *
 * Trois conséquences :
 * - la bande de sept jours devient une GRILLE MENSUELLE. Une bande hebdomadaire
 *   ne montre pas qu'on est disponible jusqu'en décembre ; la question que se
 *   pose un intérimaire est « où sont mes trous », pas « quel créneau reste
 *   libre mardi » ;
 * - les horaires fixes disparaissent. Le service en hôtellerie-restauration ne
 *   tient pas dans des tranches de trente minutes — une coupure va de 18 h à
 *   2 h du matin ;
 * - un jour porte un ÉTAT de couverture, pas une disponibilité binaire. Deux
 *   créneaux contradictoires le même jour existent, et le calendrier le dit
 *   (`mixed`) plutôt que d'en choisir un.
 *
 * CE CALENDRIER NE DÉCIDE RIEN. Il projette `availabilities` sur des jours et
 * renvoie la date cliquée au composeur. Les écritures passent par les champs du
 * formulaire, qui restent la source de vérité — c'est ce qui les garde
 * atteignables au clavier et vérifiables par la recette.
 */

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthName = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const fullDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Grille de six semaines commençant un lundi, jours voisins compris. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const legend: { key: DayCoverage; label: string; dot: string }[] = [
  { key: "available", label: "Disponible", dot: "bg-forest" },
  { key: "unavailable", label: "Indisponible", dot: "bg-ink-faint" },
  { key: "mixed", label: "Les deux", dot: "bg-clay" },
];

export function AvailabilityCalendar({
  slots,
  selected,
  onPick,
}: {
  slots: Availability[];
  /** Jour actuellement visé par le composeur, au format `YYYY-MM-DD`. */
  selected?: string;
  onPick: (date: Date) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const coverage = useMemo(
    () => coverageByDay(slots, year, month),
    [slots, year, month],
  );
  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <div className="rounded-panel border border-rule bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <strong className="font-display font-semibold text-[0.9375rem] text-ink">
          {monthName.format(cursor).replace(/^./, (c) => c.toUpperCase())}
        </strong>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Mois précédent"
            className="flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Mois suivant"
            className="flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="pb-1 text-center font-semibold text-[0.625rem] text-ink-faint uppercase tracking-[0.06em]"
          >
            {day}
          </span>
        ))}

        {monthGrid(year, month).map((date) => {
          const outside = date.getMonth() !== month;
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const state = outside ? undefined : coverage.get(date.getDate());
          const isToday = date.getTime() === today.getTime();
          const isSelected = selected === iso;
          const past = date.getTime() < today.getTime();

          return (
            <button
              key={iso}
              type="button"
              aria-label={`${fullDate.format(date)}${
                state === "available"
                  ? " — disponible"
                  : state === "unavailable"
                    ? " — indisponible"
                    : state === "mixed"
                      ? " — disponible et indisponible"
                      : ""
              }`}
              aria-pressed={isSelected}
              onClick={() => onPick(date)}
              className={cn(
                "relative flex aspect-square cursor-pointer items-center justify-center rounded-[7px] border border-transparent bg-transparent p-0 text-[0.8125rem] tabular-nums transition-colors",
                outside && "text-ink-faint/45",
                past && !outside && "text-ink-faint",
                !past && !outside && "text-ink hover:bg-paper-deep",
                // Un jour couvert se lit à son APLAT, pas à une pastille : sur
                // une grille de 42 cases, un point de 4 px ne se voit pas.
                state === "available" && "bg-sage-tint font-semibold text-forest",
                state === "unavailable" &&
                  "bg-paper-deep text-ink-faint line-through",
                state === "mixed" &&
                  "bg-clay-tint font-semibold text-clay-ink",
                isToday && "ring-1 ring-forest ring-inset",
                isSelected && "border-forest bg-forest font-semibold text-white",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/*
       * PAS UNE LISTE. C'est une clé de lecture des couleurs, pas une
       * énumération de contenu : l'annoncer comme « liste, 3 éléments » ajoute
       * du bruit pour une synthèse vocale, et fausse tout décompte d'éléments
       * de liste dans la section — ce que la recette a immédiatement attrapé.
       * L'information est déjà portée par le nom accessible de chaque jour.
       */}
      <div
        aria-hidden="true"
        className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-rule border-t pt-3"
      >
        {legend.map((item) => (
          <span
            key={item.key}
            className="flex items-center gap-1.5 text-[0.6875rem] text-ink-faint"
          >
            <span className={cn("size-2 rounded-[3px]", item.dot)} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
