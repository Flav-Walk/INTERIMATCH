import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { errorMessage } from "../services/session";
import {
  listMyApplications,
  type WorkerApplication,
} from "../services/applications";
import { ApplicationStatus } from "../components/applications/ApplicationStatus";

const schedule = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const applicationSchedule = (application: WorkerApplication) =>
  `${schedule.format(new Date(application.mission.starts_at))} – ${schedule.format(new Date(application.mission.ends_at))}`;

export function WorkerApplicationList({
  applications,
}: {
  applications: WorkerApplication[];
}) {
  if (!applications.length)
    return (
      <div className="empty application-page-empty">
        <BriefcaseBusiness aria-hidden="true" />
        <h2>Vous n’avez pas encore postulé</h2>
        <p>
          Consultez les missions disponibles et ouvrez celle qui vous intéresse.
        </p>
        <Link className="button" to="/worker/missions">
          Voir les missions
        </Link>
      </div>
    );

  return (
    <ul className="worker-application-list">
      {applications.map((application) => (
        <li key={application.id}>
          <div className="worker-application-main">
            <span className="quiet">
              {application.company.establishment_name ?? "Établissement"}
            </span>
            <h2>{application.mission.title}</h2>
            <div className="application-meta">
              <span>
                <MapPin size={14} aria-hidden="true" />
                {application.mission.postal_code} {application.mission.city}
              </span>
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                {applicationSchedule(application)}
              </span>
            </div>
          </div>
          <div className="worker-application-side">
            <ApplicationStatus status={application.status} />
            <Link
              className="link-more"
              to={`/worker/missions/${application.mission_id}`}
            >
              Voir la mission
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WorkerApplications() {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void listMyApplications()
      .then((result) => {
        if (live) setApplications(result.applications);
      })
      .catch((cause) => {
        if (live) setError(errorMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="page-wide applications-page">
      <div className="section-head">
        <div>
          <h1>Mes candidatures</h1>
          <p className="quiet">Suivez ici les réponses des entreprises.</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="quiet" role="status">
          Chargement de vos candidatures…
        </p>
      ) : (
        <WorkerApplicationList applications={applications} />
      )}
    </section>
  );
}
