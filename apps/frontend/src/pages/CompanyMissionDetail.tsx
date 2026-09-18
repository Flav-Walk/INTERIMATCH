import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Coins,
  MapPin,
  Pencil,
  Send,
  Users,
  Wrench,
} from "lucide-react";
import { errorMessage } from "../services/session";
import { ApiError } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import {
  canCancel,
  canEdit,
  canPublish,
  cancelMission,
  getMission,
  missionStatePresentation,
  publishMission,
  type Mission,
  type MissionCapacity,
} from "../services/missions";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { missionSchedule } from "../components/mission/MissionCard";
import {
  MissionApplications,
  missionCapacityLabel,
} from "../components/applications/MissionApplications";
import { MatchedProfiles } from "../components/mission/MatchedProfiles";

const payLabels: Record<string, string> = {
  hour: "de l’heure",
  day: "par jour",
  mission: "pour la mission",
};

/**
 * Détail d'une mission, et point de départ de ses deux actions : la modifier,
 * ou la publier. Publier est volontairement séparé de l'enregistrement du
 * formulaire — on ne rend pas une mission visible des intérimaires par le même
 * geste que celui qui corrige une faute de frappe.
 */
export function CompanyMissionDetail() {
  const { id = "" } = useParams();
  const location = useLocation();
  const { revision, invalidate } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  // Message porté par la navigation depuis le formulaire, pour que la réussite
  // soit annoncée là où l'on arrive plutôt que sur l'écran qu'on quitte.
  const [flash, setFlash] = useState(
    (location.state as { flash?: string } | null)?.flash ?? "",
  );
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [capacity, setCapacity] = useState<MissionCapacity | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getMission(id)
      .then((m) => {
        if (!live) return;
        setMission(m);
        setCapacity(m.capacity ?? null);
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id, revision]);

  async function publish() {
    setPublishing(true);
    setActionError("");
    try {
      // La réponse porte l'état que le serveur vient d'établir : on l'affiche
      // plutôt que de recalculer le statut de notre côté.
      setMission(await publishMission(id));
      // Le planning, les compteurs et la liste doivent suivre cette publication.
      invalidate();
      setConfirming(false);
      setFlash("Mission publiée. Elle est désormais visible des intérimaires.");
    } catch (e) {
      setActionError(errorMessage(e));
      setConfirming(false);
      if (
        e instanceof ApiError &&
        (e.status === 403 || e.status === 404 || e.status === 409)
      ) {
        try {
          const current = await getMission(id);
          setMission(current);
          setCapacity(current.capacity ?? null);
        } catch {
          // Le refus initial décrit l'action. Une relecture impossible ne doit
          // pas le masquer par une seconde erreur moins précise.
        }
        invalidate();
      }
    } finally {
      setPublishing(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    setActionError("");
    try {
      setMission(await cancelMission(id));
      invalidate();
      setConfirmingCancel(false);
      setFlash(
        "Mission annulée. Les intérimaires retenus ont été libérés de ce créneau.",
      );
    } catch (e) {
      setActionError(errorMessage(e));
      setConfirmingCancel(false);
      if (
        e instanceof ApiError &&
        (e.status === 403 || e.status === 404 || e.status === 409)
      ) {
        try {
          const current = await getMission(id);
          setMission(current);
          setCapacity(current.capacity ?? null);
        } catch {
          // Relecture silencieuse
        }
        invalidate();
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading)
    return (
      <section className="page-wide">
        <p role="status" className="quiet">
          Chargement de la mission…
        </p>
      </section>
    );

  if (error || !mission)
    return (
      <section className="page-wide">
        <p className="form-error" role="alert">
          {error || "Mission introuvable."}
        </p>
        <Link className="link-more" to="/company/missions">
          ← Revenir aux missions
        </Link>
      </section>
    );

  const required = mission.skills.filter((s) => s.required);
  const desired = mission.skills.filter((s) => !s.required);
  /**
   * Le badge de la mission, décidé par la fonction commune — avec la capacité
   * la plus fraîche dont cette page dispose.
   *
   * CE QUI ÉTAIT FAUX. Cette page corrigeait le libellé pour son compte :
   * `full ? { ...presentation, label: "Pourvue" } : presentation`. Le ternaire
   * remplaçait le libellé **inconditionnellement**, y compris lorsque la
   * cascade venait de répondre « Annulée » ou « Terminée ». Une mission
   * annulée dont les postes avaient été pourvus avant l'annulation s'affichait
   * donc « Pourvue », et une mission passée et complète aussi.
   *
   * La priorité métier n'appartient pas à cet écran. Il fournit la donnée, la
   * fonction tranche : annulée, brouillon, terminée, en cours, pourvue,
   * à pourvoir — dans cet ordre, et au même endroit pour toute l'application.
   *
   * POURQUOI PASSER `capacity` PLUTÔT QUE `mission.capacity`. Les deux décrivent
   * la même chose, mais `capacity` vient de l'appel candidatures, rafraîchi
   * après chaque décision, là où `mission` peut dater de la lecture
   * précédente. Le `??` ne fait que préférer la plus récente ; il ne décide de
   * rien.
   */
  const presentation = missionStatePresentation({
    ...mission,
    capacity: capacity ?? mission.capacity,
  });
  const decisionsClosed =
    presentation.temporal === "cancelled"
      ? "Mission annulée : aucune décision n’est encore possible."
      : presentation.temporal === "completed"
        ? "Mission terminée : les candidatures restent consultables dans l’historique."
        : undefined;

  return (
    <section className="page-wide">
      <Link className="link-back" to="/company/missions">
        <ArrowLeft size={15} aria-hidden="true" />
        Vos missions
      </Link>

      <div className="section-head">
        <h1>{mission.title}</h1>
        <span className={`mission-status is-inline ${presentation.className}`}>
          {presentation.label}
        </span>
        {presentation.temporal === "upcoming" && mission.status !== "draft" && (
          <span className="mission-timing is-inline">À venir</span>
        )}
        <div className="head-actions">
          {canEdit(mission) && (
            <Link
              className="secondary-button"
              to={`/company/missions/${mission.id}/edit`}
            >
              <Pencil size={15} aria-hidden="true" />
              Modifier
            </Link>
          )}
          {canCancel(mission) && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmingCancel(true)}
            >
              <Ban size={15} aria-hidden="true" />
              Annuler la mission
            </button>
          )}
          {canPublish(mission) && (
            <button
              type="button"
              className="button"
              onClick={() => setConfirming(true)}
            >
              <Send size={15} aria-hidden="true" />
              Publier la mission
            </button>
          )}
        </div>
      </div>

      {flash && (
        <p className="form-success" role="status">
          {flash}
        </p>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title="Publier cette mission ?"
        confirmLabel="Publier"
        busyLabel="Publication…"
        busy={publishing}
        onConfirm={() => void publish()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          « {mission.title} » deviendra visible des intérimaires et entrera dans
          le rapprochement. Vous pourrez encore la modifier, mais pas revenir à
          l’état de brouillon.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmingCancel}
        title="Annuler cette mission ?"
        confirmLabel="Confirmer l’annulation"
        busyLabel="Annulation…"
        busy={cancelling}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmingCancel(false)}
      >
        <p>
          « {mission.title} » sera retirée du recrutement et marquée comme
          annulée. Les intérimaires éventuellement retenus seront libérés de ce
          créneau. Cette action est irréversible.
        </p>
      </ConfirmDialog>

      <div className="layout layout-single">
        <div className="layout-main">
          <section className="rail-card">
            <div className="detail-grid">
              <p className="mission-meta">
                <CalendarDays size={15} aria-hidden="true" />
                {missionSchedule(mission)}
              </p>
              <p className="mission-meta">
                <MapPin size={15} aria-hidden="true" />
                {mission.address ? `${mission.address}, ` : ""}
                {mission.postal_code} {mission.city}
              </p>
              <p className="mission-meta">
                <Users size={15} aria-hidden="true" />
                {!capacity
                  ? mission.headcount > 1
                    ? `${mission.headcount} postes à pourvoir`
                    : "1 poste à pourvoir"
                  : missionCapacityLabel(capacity.filled, capacity.headcount)}
              </p>
              {mission.pay_amount && mission.pay_unit && (
                <p className="mission-meta">
                  <Coins size={15} aria-hidden="true" />
                  {Number(mission.pay_amount).toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}{" "}
                  {payLabels[mission.pay_unit] ?? mission.pay_unit}
                </p>
              )}
            </div>
            {mission.description && (
              <p className="detail-description">{mission.description}</p>
            )}
          </section>

          <section className="rail-card">
            <div className="rail-head">
              <Wrench size={18} aria-hidden="true" />
              <h2>Compétences attendues</h2>
            </div>
            {required.length > 0 ? (
              <>
                <p className="quiet">Obligatoires</p>
                <div className="skill-options">
                  {required.map((s) => (
                    <span className="badge" key={s.id}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="quiet">
                Aucune compétence obligatoire n’a été précisée.
              </p>
            )}
            {desired.length > 0 && (
              <>
                <p className="quiet">Souhaitées</p>
                <div className="skill-options">
                  {desired.map((s) => (
                    <span className="badge" key={s.id}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </>
            )}
            {mission.min_years_experience && (
              <p className="quiet">
                Expérience attendue : {Number(mission.min_years_experience)} an
                {Number(mission.min_years_experience) > 1 ? "s" : ""}
              </p>
            )}
          </section>

          <MatchedProfiles missionId={mission.id} revision={revision} />

          <MissionApplications
            missionId={mission.id}
            missionTitle={mission.title}
            headcount={mission.headcount}
            decisionsClosed={decisionsClosed}
            onCapacityChange={setCapacity}
          />
        </div>
      </div>
    </section>
  );
}
