import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import {
  explainEmpty,
  listOpenMissions,
  type Exclusions,
  type OpenMission,
} from "../services/missions";

/** Rappel de ce qui se passera ensuite, pour l'écran resté vide. */
const steps = [
  "Recevoir les missions compatibles avec votre zone",
  "Consulter le détail et les compétences attendues",
  "Accepter ou refuser chaque proposition",
];

/**
 * Missions offertes aux intérimaires.
 *
 * Toutes les missions publiées sont présentées, sans classement : le
 * rapprochement par affinité viendra au lot suivant et ordonnera cette même
 * liste. Rien n'est simulé — ce qui s'affiche vient du serveur.
 */
export function Missions() {
  const { user, revision } = useAuth();
  const [missions, setMissions] = useState<OpenMission[]>([]),
    [excluded, setExcluded] = useState<Exclusions>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void listOpenMissions()
      .then((r) => {
        if (!live) return;
        setMissions(r.missions);
        setExcluded(r.excluded);
        setError("");
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // `revision` change au retour sur l'onglet : une mission publiée entre-temps
    // apparaît sans qu'il faille recharger la page.
  }, [revision]);

  if (!user || user.role !== "worker") return null;
  // Le serveur a déjà fait le tri : on n'affiche qu'une raison, celle qui
  // explique le plus grand nombre de missions manquantes.
  const reason = explainEmpty(excluded);

  return (
    <section className="page-wide">
      <span className="eyeline">Espace intérimaire</span>
      <h1>Missions disponibles</h1>
      <p className="quiet page-lead">
        Les missions qui correspondent à votre profil, à votre zone et à vos
        disponibilités — de la plus compatible à la moins compatible.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="quiet">
          Chargement des missions…
        </p>
      ) : missions.length > 0 ? (
        <>
          <p className="quiet" role="status">
            {missions.length} mission{missions.length > 1 ? "s" : ""} compatible
            {missions.length > 1 ? "s" : ""} avec votre profil
          </p>
          <div className="mission-grid is-wide">
            {missions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                basePath="/worker/missions"
                score={mission.match.score}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="empty">
            <BriefcaseBusiness aria-hidden="true" />
            <h2>{reason ? reason.title : "Aucune mission disponible pour le moment"}</h2>
            <p>
              {reason
                ? reason.detail
                : "Aucune mission n’est publiée pour l’instant. Dès qu’un établissement en publie une qui vous correspond, elle apparaît ici."}
            </p>
            {reason ? (
              <Link className="button" to={reason.action.to}>
                {reason.action.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              !user.onboarding_completed && (
                <Link className="button" to="/worker/profile">
                  Compléter mon profil
                </Link>
              )
            )}
          </div>

          <section className="section">
            <h2>Comment cela fonctionnera</h2>
            <ol className="steps-list">
              {steps.map((label) => (
                <li key={label}>
                  <Check size={16} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </section>
  );
}
