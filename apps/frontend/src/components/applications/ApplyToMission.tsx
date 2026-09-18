import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, MapPin, Send } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
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

export interface ApplicationMissionContext {
  title: string;
  starts_at: string;
  ends_at: string;
  city: string;
  postal_code: string;
  establishment_name: string | null;
}

const schedule = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function workerApplicationError(cause: unknown) {
  if (!(cause instanceof ApiError)) return errorMessage(cause);
  switch (cause.code) {
    case "WORKER_ENGAGED":
      return "Vous êtes déjà engagé sur une autre mission pendant ce créneau. Vos missions ont été actualisées.";
    case "MISSION_FULL":
      return "Tous les postes de cette mission viennent d’être pourvus.";
    case "APPLICATION_CLOSED":
      return "Cette mission n’accepte plus de candidatures.";
    case "APPLICATION_ALREADY_EXISTS":
      return "Vous avez déjà postulé à cette mission. Son statut a été actualisé.";
    default:
      return errorMessage(cause);
  }
}

export function ApplicationAction({
  application,
  loading,
  applying,
  error,
  onApply,
  mission,
}: {
  application: Application | null;
  loading: boolean;
  applying: boolean;
  error: string;
  onApply: () => void;
  mission?: ApplicationMissionContext;
}) {
  const accepted = application?.status === "accepted";
  const Icon = accepted ? CheckCircle2 : Send;
  const location = mission
    ? [mission.postal_code, mission.city].filter(Boolean).join(" ")
    : "";
  return (
    <section
      className="rail-card application-action"
      aria-labelledby="apply-title"
    >
      <div className="rail-head">
        <Icon size={18} aria-hidden="true" />
        <h2 id="apply-title">
          {accepted ? "Mission confirmée" : "Votre candidature"}
        </h2>
      </div>
      {loading ? (
        <p className="quiet" role="status">
          Vérification de votre candidature…
        </p>
      ) : error && !application ? null : application ? (
        <>
          <ApplicationStatus status={application.status} />
          <p>{stateMessages[application.status]}</p>
          {accepted && mission && (
            <div className="confirmed-mission-summary">
              <strong>{mission.title}</strong>
              <span>{mission.establishment_name ?? "Établissement"}</span>
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                {schedule.format(new Date(mission.starts_at))} –{" "}
                {schedule.format(new Date(mission.ends_at))}
              </span>
              <span>
                <MapPin size={14} aria-hidden="true" />
                {location || "Lieu à confirmer"}
              </span>
            </div>
          )}
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

export function ApplyToMission({
  missionId,
  mission,
}: {
  missionId: string;
  mission: ApplicationMissionContext;
}) {
  const { invalidate } = useAuth();
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
      invalidate();
    } catch (cause) {
      setError(workerApplicationError(cause));
      if (
        cause instanceof ApiError &&
        [
          "WORKER_ENGAGED",
          "MISSION_FULL",
          "APPLICATION_CLOSED",
          "APPLICATION_ALREADY_EXISTS",
        ].includes(cause.code)
      ) {
        try {
          const current = await getMyApplication(missionId);
          setApplication(current.application);
        } catch {
          // Le message métier initial reste le plus utile ; cette relecture
          // opportuniste ne doit jamais le remplacer.
        }
        invalidate();
      }
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
      mission={mission}
    />
  );
}
