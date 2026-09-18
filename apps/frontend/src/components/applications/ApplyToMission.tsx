import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Send,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { errorMessage } from "../../services/session";
import {
  missionTemporalState,
  type MissionStatus,
  type NotOpenReason,
} from "../../services/missions";
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
  status: MissionStatus;
  /**
   * Pourquoi la mission ne recrute plus, décidé par le serveur.
   *
   * Cet écran testait `status === "filled"`. Aucune transition n'écrit ce
   * statut — une mission complète reste `open`, parce qu'être pourvue décrit
   * son recrutement et non son cycle de vie. La branche était donc morte, et
   * un intérimaire dont la mission venait de se remplir ne lisait rien du tout.
   */
  recruiting_blocked?: NotOpenReason | null;
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

export function applicationMissionHeading(
  application: Application | null,
  mission: ApplicationMissionContext | undefined,
  now = Date.now(),
) {
  if (!mission) return "Votre candidature";
  const temporal = missionTemporalState(mission, now);
  if (temporal === "cancelled") return "Mission annulée";
  if (temporal === "completed") return "Mission terminée";
  if (application?.status === "accepted")
    return temporal === "running" ? "Mission en cours" : "Mission confirmée";
  return "Votre candidature";
}

function inactiveMissionMessage(
  mission: ApplicationMissionContext | undefined,
  now = Date.now(),
) {
  if (!mission) return null;
  const temporal = missionTemporalState(mission, now);
  if (temporal === "cancelled")
    return "Cette mission a été annulée. Aucune nouvelle candidature n’est possible.";
  if (temporal === "completed")
    return "Cette mission est terminée. Elle reste consultable dans votre historique.";
  if (mission.recruiting_blocked === "full")
    return "Tous les postes de cette mission sont pourvus. Votre candidature reste enregistrée, mais l’entreprise ne peut plus la retenir.";
  return null;
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
  const heading = applicationMissionHeading(application, mission);
  const inactive = inactiveMissionMessage(mission);
  /**
   * En attente, mais la mission n'a plus de place.
   *
   * Sans cette ligne, l'écran affichait « l'entreprise doit maintenant
   * l'examiner » — une phrase devenue fausse, puisqu'elle ne peut plus retenir
   * personne. Le message d'inactivité n'était rendu que faute de candidature ;
   * c'est précisément quand on en a une qu'il faut le lire.
   *
   * Restreint à la complétude : l'annulation et la fin de mission ont déjà
   * leurs propres phrases un peu plus haut, et les répéter ferait doublon.
   * Restreint à « en attente » : pour la personne retenue, la mission est
   * pleine à cause d'elle.
   */
  const pendingButFilled =
    application?.status === "pending" && mission?.recruiting_blocked === "full";
  const isInactive =
    heading === "Mission annulée" || heading === "Mission terminée";
  const Icon =
    heading === "Mission annulée"
      ? Ban
      : heading === "Mission terminée"
        ? Clock
        : accepted ||
            heading === "Mission confirmée" ||
            heading === "Mission en cours"
          ? CheckCircle2
          : Send;
  const location = mission
    ? [mission.postal_code, mission.city].filter(Boolean).join(" ")
    : "";
  return (
    <section
      className={`rail-card application-action ${isInactive ? "is-inactive" : ""}`}
      aria-labelledby="apply-title"
    >
      <div className="rail-head">
        <Icon size={18} aria-hidden="true" />
        <h2 id="apply-title">{heading}</h2>
      </div>
      {loading ? (
        <p className="quiet" role="status">
          Vérification de votre candidature…
        </p>
      ) : error && !application ? null : application ? (
        <>
          <ApplicationStatus status={application.status} />
          <p>
            {heading === "Mission annulée"
              ? "Cette mission a été annulée. Votre candidature reste visible dans votre historique."
              : heading === "Mission terminée"
                ? "Cette mission est terminée et reste accessible dans votre historique."
                : heading === "Mission en cours"
                  ? "La mission est actuellement en cours."
                  : stateMessages[application.status]}
          </p>
          {pendingButFilled && inactive && (
            <p className="quiet" role="status">
              {inactive}
            </p>
          )}
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
      ) : inactive ? (
        <p className="quiet">{inactive}</p>
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
