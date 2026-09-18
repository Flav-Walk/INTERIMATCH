import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  workerMissionContext,
  type WorkerApplication,
} from "../../services/applications";

const schedule = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const workerApplicationSchedule = (application: WorkerApplication) =>
  `${schedule.format(new Date(application.mission.starts_at))} – ${schedule.format(new Date(application.mission.ends_at))}`;

export function ConfirmedMissions({
  applications,
}: {
  applications: WorkerApplication[];
}) {
  if (!applications.length) return null;

  return (
    <ul className="confirmed-mission-list">
      {applications.map((application) => {
        const context = workerMissionContext(application);
        const ContextIcon = context.key === "running" ? Activity : CheckCircle2;
        const location = [
          application.mission.postal_code,
          application.mission.city,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={application.id}>
            <div className="confirmed-mission-copy">
              <div className="confirmed-mission-heading">
                <span className={`mission-context-status is-${context.key}`}>
                  <ContextIcon size={14} aria-hidden="true" />
                  {context.label}
                </span>
                <span className="quiet">
                  {application.company.establishment_name ?? "Établissement"}
                </span>
              </div>
              <h3>{application.mission.title}</h3>
              <div className="application-meta">
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {workerApplicationSchedule(application)}
                </span>
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {location || "Lieu à confirmer"}
                </span>
              </div>
            </div>
            <Link
              className="link-more"
              to={`/worker/missions/${application.mission_id}`}
            >
              Voir la mission
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
