import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  missionDaysOfMonth,
  upcomingMissions,
  type Mission,
} from "../../services/missions";

/**
 * Rail droit de la maquette : mini-calendrier du mois puis agenda des prochaines
 * missions. Les données viennent des vraies missions de l'entreprise.
 */

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthName = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });
/** Même notation que les cartes mission. */
const frenchHour = (date: Date) => {
  const minutes = date.getMinutes();
  const hours = String(date.getHours()).padStart(2, "0");
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
};

/** Grille de 6 semaines commençant un lundi, jours voisins compris. */
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

export function PlanningCard({ missions }: { missions: Mission[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const marked = missionDaysOfMonth(missions, year, month);
  const upcoming = upcomingMissions(missions);
  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <section className="rail-card">
      <div className="rail-head">
        <CalendarDays size={18} aria-hidden="true" />
        <h2>Votre planning</h2>
        <Link className="link-more" to="/company/missions">
          Voir l’agenda →
        </Link>
      </div>

      <div className="calendar-head">
        <strong>
          {monthName.format(cursor).replace(/^./, (c) => c.toUpperCase())}
        </strong>
        <div className="calendar-nav">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Mois suivant"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {monthGrid(year, month).map((date) => {
          const outside = date.getMonth() !== month;
          const isToday =
            date.toDateString() === today.toDateString() && !outside;
          const hasMission = !outside && marked.has(date.getDate());
          const classes = [
            "calendar-day",
            outside ? "is-outside" : "",
            hasMission ? "has-mission" : "",
            isToday ? "is-today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span
              className={classes}
              key={date.toISOString()}
              title={hasMission ? "Mission prévue ce jour" : undefined}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>

      {upcoming.length > 0 ? (
        <div className="agenda">
          {upcoming.map((mission) => {
            const start = new Date(mission.starts_at);
            return (
              <Link
                className="agenda-item"
                key={mission.id}
                to={"/company/missions/" + mission.id}
              >
                <span className="agenda-date">
                  <strong>{start.getDate()}</strong>
                  <span>{shortMonth.format(start)}</span>
                </span>
                <span className="agenda-body">
                  <span className="agenda-title">{mission.title}</span>
                  <span>
                    {frenchHour(start)} –{" "}
                    {frenchHour(new Date(mission.ends_at))} · {mission.city}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="agenda">
          <p className="quiet">
            Aucune mission planifiée. Créez une mission pour voir votre agenda
            se remplir.
          </p>
        </div>
      )}
    </section>
  );
}
