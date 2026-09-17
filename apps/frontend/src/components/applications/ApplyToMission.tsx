import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { errorMessage } from "../../services/session";
import {
  applyToMission,
  getMyApplication,
  type Application,
} from "../../services/applications";
import { ApplicationStatus } from "./ApplicationStatus";

const stateMessages: Record<Application["status"], string> = {
  pending: "Candidature envoyée. L’entreprise doit maintenant l’examiner.",
  accepted: "Votre candidature a été acceptée par l’entreprise.",
  rejected: "L’entreprise n’a pas retenu cette candidature.",
};

export function ApplicationAction({
  application,
  loading,
  applying,
  error,
  onApply,
}: {
  application: Application | null;
  loading: boolean;
  applying: boolean;
  error: string;
  onApply: () => void;
}) {
  return (
    <section
      className="rail-card application-action"
      aria-labelledby="apply-title"
    >
      <div className="rail-head">
        <Send size={18} aria-hidden="true" />
        <h2 id="apply-title">Votre candidature</h2>
      </div>
      {loading ? (
        <p className="quiet" role="status">
          Vérification de votre candidature…
        </p>
      ) : application ? (
        <>
          <ApplicationStatus status={application.status} />
          <p>{stateMessages[application.status]}</p>
          <Link className="link-more" to="/worker/applications">
            Voir mes candidatures
          </Link>
        </>
      ) : (
        <>
          <p className="quiet">
            Envoyez votre profil à l’entreprise pour lui signaler votre intérêt.
          </p>
          <button
            type="button"
            className="button application-submit"
            onClick={onApply}
            disabled={applying}
          >
            <Send size={16} aria-hidden="true" />
            {applying ? "Envoi en cours…" : "Postuler"}
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function ApplyToMission({ missionId }: { missionId: string }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getMyApplication(missionId)
      .then(({ application: current }) => {
        if (live) setApplication(current);
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

  async function apply() {
    setApplying(true);
    setError("");
    try {
      setApplication(await applyToMission(missionId));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setApplying(false);
    }
  }

  return (
    <ApplicationAction
      application={application}
      loading={loading}
      applying={applying}
      error={error}
      onApply={() => void apply()}
    />
  );
}
