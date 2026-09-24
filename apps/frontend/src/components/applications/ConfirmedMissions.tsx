import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import {
  workerMissionContext,
  type WorkerApplication,
} from "../../services/applications";
import { BlurFade } from "../ui/blur-fade";
import { StatusTrack } from "../da/StatusTrack";
import "../../styles/applications.css";

const schedule = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const workerApplicationSchedule = (application: WorkerApplication) =>
  `${schedule.format(new Date(application.mission.starts_at))} – ${schedule.format(new Date(application.mission.ends_at))}`;

// Morceaux de date pour la « page d'agenda » à gauche de chaque mission.
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const month = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const hours = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

/** « aujourd'hui », « demain », « dans 5 jours » : ce qui compte, c'est quand. */
function countdown(iso: string, now = Date.now()) {
  const start = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

/**
 * « Vos prochaines missions » sur le tableau de bord intérimaire.
 *
 * Nouvelle DA (retour de revue : l'ancien bloc « badge + texte » faisait
 * générique) :
 * - À gauche de chaque mission, une page d'agenda : jour de la semaine en
 *   orange, numéro du jour en grand (Fraunces), mois. Même idée que le widget
 *   Calendar Event d'Animata.
 * - La prochaine mission se distingue par un filet orange à gauche, sur fond
 *   uni (retour : pas de dégradé ni de trait lumineux sur cet encart).
 * - Le statut n'est plus un badge : c'est la frise StatusTrack (inspirée de
 *   l'Animated Timeline d'Animata). La classe mission-context-status est
 *   gardée : les tests e2e la cherchent.
 * - Chaque ligne apparaît en fondu (Blur Fade, Magic UI), l'une après l'autre.
 */
export function ConfirmedMissions({
  applications,
}: {
  applications: WorkerApplication[];
}) {
  if (!applications.length) return null;

  return (
    <ul className="next-mission-list">
      {applications.map((application, index) => {
        const context = workerMissionContext(application);
        const start = new Date(application.mission.starts_at);
        const end = new Date(application.mission.ends_at);
        const location = [
          application.mission.postal_code,
          application.mission.city,
        ]
          .filter(Boolean)
          .join(" ");
        const running = context.key === "running";

        return (
          <li key={application.id} className={index === 0 ? "is-next" : undefined}>
            <BlurFade delay={0.08 * index} className="next-mission">
              {/* Page d'agenda : décorative, la date complète est écrite plus loin. */}
              <span className="next-mission__date" aria-hidden="true">
                <span>{weekday.format(start)}</span>
                <strong>{start.getDate()}</strong>
                <span>{month.format(start)}</span>
              </span>

              <div className="next-mission__copy">
                <span className="next-mission__company">
                  {application.company.establishment_name ?? "Établissement"}
                  {" · "}
                  <em>{running ? "en cours" : countdown(application.mission.starts_at)}</em>
                </span>
                <h3>{application.mission.title}</h3>
                <div className="next-mission__meta">
                  <span>
                    <Clock3 size={14} aria-hidden="true" />
                    {/* La date complète pour les lecteurs d'écran et les tests. */}
                    <span className="sr-only">{workerApplicationSchedule(application)}</span>
                    <span aria-hidden="true">
                      {hours.format(start)} – {hours.format(end)}
                    </span>
                  </span>
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {location || "Lieu à confirmer"}
                  </span>
                </div>
              </div>

              <div className="next-mission__side">
                <span className={`mission-context-status is-${context.key}`}>
                  <StatusTrack
                    reached={running ? 2 : 3}
                    tone={running ? "pending" : "done"}
                    label={context.label}
                  />
                </span>
                <Link
                  className="link-more"
                  to={`/worker/missions/${application.mission_id}`}
                >
                  Voir la mission
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </BlurFade>
          </li>
        );
      })}
    </ul>
  );
}
