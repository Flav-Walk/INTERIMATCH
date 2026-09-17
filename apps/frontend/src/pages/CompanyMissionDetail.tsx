import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Coins,
  MapPin,
  Pencil,
  Send,
  Users,
  Wrench,
} from "lucide-react";
import { errorMessage } from "../services/session";
import { useAuth } from "../hooks/useAuth";
import {
  canEdit,
  canPublish,
  getMission,
  publishMission,
  type Mission,
} from "../services/missions";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  statusLabels,
  missionSchedule,
} from "../components/mission/MissionCard";

const payLabels: Record<string, string> = {
  hour: "de l’heure",
  day: "par jour",
  mission: "pour la mission",
};

const statusClass: Record<Mission["status"], string> = {
  draft: "is-draft",
  open: "is-open",
  filled: "is-running",
  completed: "is-done",
  cancelled: "is-done",
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
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getMission(id)
      .then((m) => live && setMission(m))
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
    } finally {
      setPublishing(false);
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

  return (
    <section className="page-wide">
      <Link className="link-back" to="/company/missions">
        <ArrowLeft size={15} aria-hidden="true" />
        Vos missions
      </Link>

      <div className="section-head">
        <h1>{mission.title}</h1>
        <span
          className={"mission-status is-inline " + statusClass[mission.status]}
        >
          {statusLabels[mission.status]}
        </span>
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

      <div className="layout">
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
                {mission.headcount > 1
                  ? `${mission.headcount} postes à pourvoir`
                  : "1 poste à pourvoir"}
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
        </div>

        <aside className="layout-rail">
          <section className="rail-card">
            <div className="rail-head">
              <Users size={18} aria-hidden="true" />
              <h2>Candidats compatibles</h2>
            </div>
            <p className="quiet">
              Le rapprochement des profils sera disponible prochainement. Les
              candidats seront classés par score, avec le détail des critères.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
