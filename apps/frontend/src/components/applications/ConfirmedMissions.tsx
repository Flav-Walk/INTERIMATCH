import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkerApplication } from "../../services/applications";
import { ApplicationStatus } from "./ApplicationStatus";

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
                <ApplicationStatus status="accepted" />
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
