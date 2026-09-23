import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Globe,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import { HeroBanner } from "../components/HeroBanner";
import {
  explainEmpty,
  listOpenMissions,
  type Exclusions,
  type OpenMission,
} from "../services/missions";
import { EmptyState } from "../components/da/EmptyState";

/** Rappel de ce qui se passera ensuite, pour l'écran resté vide. */
const steps = [
  "Recevoir les missions compatibles avec votre zone",
  "Consulter le détail et les compétences attendues",
  "Accepter ou refuser chaque proposition",
];

function SkeletonGrid() {
  return (
    <div className="mission-grid is-wide" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}

/**
 * Missions offertes aux intérimaires.
 *
 * Le serveur envoie déjà la liste triée par compatibilité et n'y met que les
 * missions réellement accessibles au profil. Le filtre par ville est un confort
 * de lecture appliqué à ce résultat : il ne rejoue aucune règle de sélection.
 */
export function Missions() {
  usePageSeo({
    title: "Vos propositions de mission · InteriMatch",
    description: "Suivi des propositions de mission reçues.",
    robots: "noindex,nofollow",
  });
  const { user, revision } = useAuth();
  const [missions, setMissions] = useState<OpenMission[]>([]),
    [excluded, setExcluded] = useState<Exclusions>(),
    [filterCity, setFilterCity] = useState(""),
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

  const cities = useMemo(
    () =>
      Array.from(new Set(missions.map((m) => m.city).filter(Boolean))).sort(),
    [missions],
  );

  if (!user || user.role !== "worker") return null;
  // Le serveur a déjà fait le tri : on n'affiche qu'une raison, celle qui
  // explique le plus grand nombre de missions manquantes.
  const reason = explainEmpty(excluded);
  const shown = filterCity
    ? missions.filter((m) => m.city === filterCity)
    : missions;

  return (
    <div className="missions-page">
      <HeroBanner
        compact
        eyeline="Espace intérimaire"
        title="Missions disponibles"
        subtitle="Les missions compatibles avec votre profil, votre zone et vos disponibilités, classées par le score calculé par InteriMatch."
        mascotPose="missions"
      />

      <div className="missions-page__body">
        <div className="public-offers-disclaimer" role="note">
          <Globe size={18} aria-hidden="true" />
          <div>
            <strong>Recherche élargie :</strong> En complément des missions
            InteriMatch, découvrez les opportunités du réseau public.{" "}
            <Link
              className="public-offers-disclaimer__link"
              to="/worker/public-offers"
            >
              Consulter les offres France Travail →
            </Link>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!error &&
          (loading ? (
            <>
              <p role="status" className="sr-only">
                Chargement des missions…
              </p>
              <SkeletonGrid />
            </>
          ) : missions.length > 0 ? (
            <>
              <div className="missions-toolbar">
                <p className="missions-toolbar__count" role="status">
                  <Sparkles size={15} aria-hidden="true" />
                  <strong>{shown.length}</strong> mission
                  {shown.length > 1 ? "s" : ""} compatible
                  {shown.length > 1 ? "s" : ""}
                  {filterCity ? ` à ${filterCity}` : " avec votre profil"}
                </p>

                {cities.length > 1 && (
                  <div className="missions-toolbar__filter">
                    <label htmlFor="filter-city" className="sr-only">
                      Filtrer par ville
                    </label>
                    <div className="select-wrapper">
                      <select
                        id="filter-city"
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                      >
                        <option value="">Toutes les villes</option>
                        {cities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} aria-hidden="true" />
                    </div>
                  </div>
                )}
              </div>

              {shown.length > 0 ? (
                <section aria-labelledby="missions-list-title">
                  <h2 id="missions-list-title" className="sr-only">
                    Liste des missions disponibles
                  </h2>
                  <div className="mission-grid is-wide">
                    {shown.map((mission) => (
                      <MissionCard
                        key={mission.id}
                        mission={mission}
                        basePath="/worker/missions"
                        score={mission.match.score}
                        band={mission.match.band}
                        bandLabel={mission.match.band_label}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <EmptyState icon={BriefcaseBusiness}>
                  <h2>Aucune mission à {filterCity}</h2>
                  <p>
                    Essayez une autre ville ou revenez à l’ensemble des
                    missions.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setFilterCity("")}
                  >
                    Voir toutes les missions
                  </button>
                </EmptyState>
              )}
            </>
          ) : (
            <>
              <EmptyState icon={BriefcaseBusiness}>
                <h2>
                  {reason
                    ? reason.title
                    : "Aucune mission disponible pour le moment"}
                </h2>
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
              </EmptyState>

              <section className="how-it-works" aria-labelledby="how-title">
                <h2 id="how-title">Comment cela fonctionnera</h2>
                <ol className="how-steps">
                  {steps.map((label, index) => (
                    <li key={label} className="how-step">
                      <span className="how-step__num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <Check size={14} aria-hidden="true" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ))}
      </div>
    </div>
  );
}
