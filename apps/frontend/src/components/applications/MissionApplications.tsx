import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../services/api";
import { errorMessage } from "../../services/session";
import type { MissionCapacity } from "../../services/missions";
import { useAuth } from "../../hooks/useAuth";
import { useCompanyData } from "../../hooks/CompanyData";
import {
  applicationCandidateName,
  decideApplication,
  listMissionApplications,
  type ApplicationDecision,
  type MissionApplication,
} from "../../services/applications";
import { ConfirmDialog } from "../ConfirmDialog";
import { ApplicationStatus } from "./ApplicationStatus";

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface PendingDecision {
  application: MissionApplication;
  status: ApplicationDecision;
}

export function missionCapacityLabel(accepted: number, headcount: number) {
  if (accepted >= headcount)
    return `Tous les postes sont pourvus (${headcount} sur ${headcount}).`;
  return `${accepted} poste${accepted > 1 ? "s" : ""} pourvu${accepted > 1 ? "s" : ""} sur ${headcount}.`;
}

export function replaceApplication(
  applications: MissionApplication[],
  updated: MissionApplication,
) {
  return applications.map((item) => (item.id === updated.id ? updated : item));
}

export function decisionConflictMessage(error: ApiError) {
  if (error.code === "APPLICATION_ALREADY_DECIDED")
    return "Cette candidature a déjà été traitée. La liste a été actualisée.";
  if (error.code === "MISSION_FULL")
    return "Tous les postes sont désormais pourvus. Les candidatures ont été actualisées.";
  if (error.code === "WORKER_ENGAGED")
    return "Cette personne a accepté une autre mission sur ce créneau. La liste a été actualisée.";
  if (error.code === "APPLICATION_NOT_FOUND" || error.status === 403)
    return "Cette candidature n’est plus accessible. La liste a été actualisée.";
  return error.message;
}

export function DecisionConfirmation({
  decision,
  missionTitle,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  decision: PendingDecision | null;
  missionTitle: string;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!decision) return null;
  const accepting = decision.status === "accepted";
  const name = applicationCandidateName(decision.application);

  return (
    <ConfirmDialog
      open
      title={
        accepting
          ? "Accepter cette candidature ?"
          : "Refuser cette candidature ?"
      }
      confirmLabel={
        accepting ? "Accepter la candidature" : "Refuser la candidature"
      }
      busyLabel={accepting ? "Acceptation en cours…" : "Refus en cours…"}
      busy={busy}
      tone={accepting ? "default" : "danger"}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        {accepting
          ? `Vous allez retenir ${name} pour « ${missionTitle} ». Cette décision ne pourra plus être modifiée.`
          : `Vous allez indiquer à ${name} que sa candidature pour « ${missionTitle} » n’est pas retenue. Cette décision ne pourra plus être modifiée.`}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}

export function MissionApplicationList({
  applications,
  busyId,
  missionFull,
  decisionsClosed,
  onDecision,
}: {
  applications: MissionApplication[];
  busyId: string | null;
  missionFull: boolean;
  decisionsClosed?: string;
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
    <ul
      className={`application-candidate-list ${decisionsClosed ? "is-inactive" : ""}`}
    >
      {applications.map((application) => (
        <li key={application.id}>
          <div className="application-candidate-main">
            <strong>{applicationCandidateName(application)}</strong>
            <span className="application-meta">
              {application.worker.main_job && (
                <span>{application.worker.main_job}</span>
              )}
              {application.worker.city && (
                <span>{application.worker.city}</span>
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
                {decisionsClosed ? (
                  <p className="application-capacity-note">{decisionsClosed}</p>
                ) : application.conflict ? (
                  <p className="application-conflict">
                    Cette personne a accepté une autre mission sur ce créneau.
                    Elle ne peut plus être retenue pour celle-ci.
                  </p>
                ) : missionFull ? (
                  <p className="application-capacity-note">
                    Tous les postes sont pourvus. Cette candidature ne peut plus
                    être acceptée.
                  </p>
                ) : null}
                {!decisionsClosed && (
                  <div className="application-candidate-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busyId !== null}
                      onClick={() => onDecision(application, "rejected")}
                    >
                      Refuser
                    </button>
                    {!application.conflict && !missionFull && (
                      <button
                        type="button"
                        className="button"
                        disabled={busyId !== null}
                        onClick={() => onDecision(application, "accepted")}
                      >
                        Accepter
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const stateChangedOnServer = (cause: unknown) =>
  cause instanceof ApiError &&
  (cause.status === 403 || cause.status === 404 || cause.status === 409);

export function MissionApplications({
  missionId,
  missionTitle,
  headcount,
  decisionsClosed,
  onCapacityChange,
}: {
  missionId: string;
  missionTitle: string;
  headcount: number;
  decisionsClosed?: string;
  onCapacityChange: (capacity: MissionCapacity | null) => void;
}) {
  const { revision, invalidate } = useAuth();
  const { refresh } = useCompanyData();
  const [applications, setApplications] = useState<MissionApplication[]>([]);
  const [capacity, setCapacity] = useState<MissionCapacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<PendingDecision | null>(null);

  const readApplications = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await listMissionApplications(missionId);
        setApplications(result.applications);
        setCapacity(result.capacity);
        if (!silent) setError("");
      } catch (cause) {
        if (!silent) setError(errorMessage(cause));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [missionId],
  );

  useEffect(() => {
    void readApplications();
  }, [readApplications, revision]);

  const missionFull = capacity?.full === true;

  useEffect(() => {
    if (!loading) onCapacityChange(capacity);
  }, [capacity, loading, onCapacityChange]);

  function requestDecision(
    application: MissionApplication,
    status: ApplicationDecision,
  ) {
    if (busyId || application.status !== "pending") return;
    setDialogError("");
    setDecision({ application, status });
  }

  async function confirmDecision() {
    if (!decision || busyId) return;
    setBusyId(decision.application.id);
    setDialogError("");
    setError("");
    try {
      const updated = await decideApplication(
        missionId,
        decision.application.id,
        decision.status,
      );
      setApplications((current) => replaceApplication(current, updated));
      await readApplications(true);
      setDecision(null);
      await refresh();
      invalidate();
    } catch (cause) {
      if (stateChangedOnServer(cause)) {
        await readApplications(true);
        setDecision(null);
        setError(
          cause instanceof ApiError
            ? decisionConflictMessage(cause)
            : errorMessage(cause),
        );
        await refresh();
        invalidate();
      } else {
        setDialogError(errorMessage(cause));
      }
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
        <h2 id="applications-title">Candidatures reçues</h2>
      </div>
      <p className="mission-capacity" role="status">
        {capacity
          ? missionCapacityLabel(capacity.filled, capacity.headcount)
          : `${headcount} poste${headcount > 1 ? "s" : ""} au total.`}
      </p>
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
          missionFull={missionFull}
          decisionsClosed={decisionsClosed}
          onDecision={requestDecision}
        />
      )}
      <DecisionConfirmation
        decision={decision}
        missionTitle={missionTitle}
        busy={busyId !== null}
        error={dialogError}
        onConfirm={() => void confirmDecision()}
        onCancel={() => {
          if (!busyId) setDecision(null);
        }}
      />
    </section>
  );
}
