import { useEffect, useState } from "react";
import { CalendarX2, MapPin, UserRoundCheck, Utensils } from "lucide-react";
import { errorMessage } from "../../services/session";
import { useAuth } from "../../hooks/useAuth";
import { useCompanyData } from "../../hooks/CompanyData";
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
              <>
                {/* Le conflit n'efface pas la candidature et ne la refuse pas à
                    la place de l'entreprise : il retire la seule action
                    devenue impossible, et dit pourquoi. */}
                {application.conflict && (
                  <p className="application-conflict">
                    <CalendarX2 size={14} aria-hidden="true" />
                    Cette personne a accepté une autre mission sur ce créneau.
                    Elle ne peut plus être retenue pour celle-ci.
                  </p>
                )}
                <div className="application-candidate-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyId === application.id}
                    onClick={() => onDecision(application, "rejected")}
                  >
                    Refuser
                  </button>
                  {!application.conflict && (
                    <button
                      type="button"
                      className="button"
                      disabled={busyId === application.id}
                      onClick={() => onDecision(application, "accepted")}
                    >
                      {busyId === application.id ? "Décision…" : "Accepter"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MissionApplications({ missionId }: { missionId: string }) {
  const { revision, invalidate } = useAuth();
  const { refresh } = useCompanyData();
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
    // `revision` suit les écritures et le retour sur l'onglet : une candidature
    // déposée pendant qu'on lisait cette page apparaît sans rechargement.
  }, [missionId, revision]);

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
      // Une décision change trois choses ailleurs : le compteur du badge, la
      // liste du tableau de bord, et le conflit des autres candidatures de
      // cette personne. Les deux relectures couvrent l'ensemble.
      await refresh();
      invalidate();
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
