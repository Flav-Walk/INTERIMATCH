import { useEffect, useState } from "react";
import { MapPin, UserRoundCheck, Utensils } from "lucide-react";
import { errorMessage } from "../../services/session";
import {
  applicationCandidateName,
  decideApplication,
  listMissionApplications,
  type ApplicationDecision,
  type MissionApplication,
} from "../../services/applications";
import { ApplicationStatus } from "./ApplicationStatus";

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function MissionApplicationList({
  applications,
  busyId,
  onDecision,
}: {
  applications: MissionApplication[];
  busyId: string | null;
  onDecision: (
    application: MissionApplication,
    status: ApplicationDecision,
  ) => void;
}) {
  if (!applications.length)
    return (
      <div className="application-empty">
        <p>Aucune candidature reçue pour cette mission.</p>
        <p className="quiet">
          Cette liste contient uniquement les intérimaires ayant choisi de
          postuler.
        </p>
      </div>
    );

  return (
    <ul className="application-candidate-list">
      {applications.map((application) => (
        <li key={application.id}>
          <div className="application-candidate-main">
            <strong>{applicationCandidateName(application)}</strong>
            <span className="application-meta">
              {application.worker.main_job && (
                <span>
                  <Utensils size={14} aria-hidden="true" />
                  {application.worker.main_job}
                </span>
              )}
              {application.worker.city && (
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {application.worker.city}
                </span>
              )}
              <span>
                Reçue le {date.format(new Date(application.created_at))}
              </span>
            </span>
          </div>
          <div className="application-candidate-decision">
            <ApplicationStatus status={application.status} />
            {application.status === "pending" && (
              <div className="application-candidate-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyId === application.id}
                  onClick={() => onDecision(application, "rejected")}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busyId === application.id}
                  onClick={() => onDecision(application, "accepted")}
                >
                  {busyId === application.id ? "Décision…" : "Accepter"}
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MissionApplications({ missionId }: { missionId: string }) {
  const [applications, setApplications] = useState<MissionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void listMissionApplications(missionId)
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
  }, [missionId]);

  async function decide(
    application: MissionApplication,
    status: ApplicationDecision,
  ) {
    setBusyId(application.id);
    setError("");
    try {
      const updated = await decideApplication(
        missionId,
        application.id,
        status,
      );
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      className="rail-card mission-applications"
      aria-labelledby="applications-title"
    >
      <div className="rail-head">
        <UserRoundCheck size={18} aria-hidden="true" />
        <h2 id="applications-title">Candidatures reçues</h2>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="quiet" role="status">
          Chargement des candidatures…
        </p>
      ) : (
        <MissionApplicationList
          applications={applications}
          busyId={busyId}
          onDecision={(application, status) => void decide(application, status)}
        />
      )}
    </section>
  );
}
