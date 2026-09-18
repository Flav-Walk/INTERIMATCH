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
  workerMissionContext,
  type WorkerApplication,
} from "../services/applications";
import { ApplicationStatus } from "../components/applications/ApplicationStatus";
import { workerApplicationSchedule } from "../components/applications/ConfirmedMissions";

export function workerApplicationContext(application: WorkerApplication) {
  return workerMissionContext(application).label;
}

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
      {applications.map((application) => {
        const context = workerMissionContext(application);
        const location = [
          application.mission.postal_code,
          application.mission.city,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li
            key={application.id}
            className={
              ["confirmed", "running"].includes(context.key)
                ? "is-confirmed"
                : context.key === "cancelled" ||
                    context.key === "completed" ||
                    context.key === "filled"
                  ? "is-inactive"
                  : undefined
            }
          >
            <div className="worker-application-main">
              <span className="quiet">
                {application.company.establishment_name ?? "Établissement"}
              </span>
              <h2>{application.mission.title}</h2>
              <strong className={`application-context is-${context.key}`}>
                {context.label}
              </strong>
              <div className="application-meta">
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {location || "Lieu à confirmer"}
                </span>
                <span>
                  <CalendarDays size={14} aria-hidden="true" />
                  {workerApplicationSchedule(application)}
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
        );
      })}
    </ul>
  );
}

export function WorkerApplications() {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
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
  }, [attempt]);

  return (
    <section className="page-wide applications-page">
      <div className="section-head">
        <div>
          <h1>Mes candidatures</h1>
          <p className="quiet">Suivez ici les réponses des entreprises.</p>
        </div>
      </div>
      {error ? (
        <div className="application-load-error">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : loading ? (
        <p className="quiet" role="status">
          Chargement de vos candidatures…
        </p>
      ) : (
        <WorkerApplicationList applications={applications} />
      )}
    </section>
  );
}
