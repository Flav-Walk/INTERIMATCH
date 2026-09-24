import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Globe } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import {
  EmptyState,
  PageBody,
  PageHeader,
} from "../components/ui/PageHeader";
import { Reveal } from "../components/ui/Reveal";
import {
  explainEmpty,
  listOpenMissions,
  type Exclusions,
  type OpenMission,
} from "../services/missions";

/**
 * Missions offertes aux intérimaires.
 *
 * Le serveur envoie déjà la liste triée par compatibilité et n'y met que les
 * missions réellement accessibles au profil. Le filtre par ville est un confort
 * de lecture appliqué à ce résultat : il ne rejoue aucune règle de sélection.
 *
 * REFONTE. L'écran s'ouvrait sur un bandeau à mascotte, puis un encart bleuté
 * renvoyant vers France Travail — avant même d'avoir montré une seule mission.
 * L'ordre disait donc : « voici notre illustration, voici les offres d'un
 * autre, et enfin voici ce que vous cherchiez ». Le renvoi vers les offres
 * publiques est désormais EN BAS, là où il répond à une vraie question : « et
 * s'il n'y en a pas assez ? »
 */

/** Ossature de chargement : la forme de la carte, pas un rectangle gris. */
function SkeletonGrid() {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-panel border border-rule bg-surface"
        >
          <div className="aspect-[16/9] animate-pulse bg-paper-deep" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper-deep" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-paper-deep" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-paper-deep" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Renvoi vers les offres publiques.
 *
 * LA PROVENANCE EST DITE DEUX FOIS, et ce n'est pas une redondance : « France
 * Travail » dans le titre, et « Ces offres ne sont pas des missions
 * InteriMatch » dans le corps. C'est la seule passerelle du produit entre deux
 * jeux de données aux règles différentes — on n'y postule pas de la même
 * façon — et une confusion à cet endroit se paierait par une candidature
 * envoyée dans le vide.
 */
function PublicOffersBridge() {
  return (
    <Link
      to="/worker/public-offers"
      className="group flex items-center gap-4 rounded-panel border border-rule border-dashed bg-surface px-5 py-4 no-underline transition-colors hover:border-sage hover:bg-sage-tint/40"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-soft"
      >
        <Globe size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[0.9375rem] text-ink">
          Élargir aux offres France Travail
        </span>
        <span className="block text-[0.8125rem] text-ink-faint leading-relaxed">
          Ces offres sont publiques et ne sont pas des missions InteriMatch :
          elles se consultent ici, mais la candidature se fait chez l’employeur.
        </span>
      </span>
      <ArrowUpRight
        size={17}
        aria-hidden="true"
        className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest"
      />
    </Link>
  );
}

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
    <>
      <PageHeader
        eyebrow="Espace intérimaire"
        title="Missions disponibles"
        lead="Les missions compatibles avec votre profil, votre zone et vos disponibilités, classées par le score calculé par InteriMatch."
        aside={
          !loading &&
          !error &&
          missions.length > 0 && (
            // Le décompte est une information d'état : il se met à jour quand
            // le filtre change, donc il est annoncé aux synthèses vocales.
            <p
              role="status"
              className="flex items-baseline gap-2 text-[0.875rem] text-ink-soft"
            >
              <span className="font-display font-semibold text-[2rem] text-forest leading-none tabular-nums">
                {shown.length}
              </span>
              <span>
                mission{shown.length > 1 ? "s" : ""} compatible
                {shown.length > 1 ? "s" : ""}
                {filterCity ? ` à ${filterCity}` : ""}
              </span>
            </p>
          )
        }
        actions={
          cities.length > 1 && (
            <>
              <label htmlFor="filter-city" className="sr-only">
                Filtrer par ville
              </label>
              <select
                id="filter-city"
                className="im-field w-auto min-w-44"
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
            </>
          )
        }
      />

      <PageBody className="space-y-8">
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
          ) : missions.length === 0 ? (
            <EmptyState
              icon={<BriefcaseBusiness size={20} />}
              title={
                reason
                  ? reason.title
                  : "Aucune mission disponible pour le moment"
              }
              action={
                reason ? (
                  <Link className="im-btn im-btn--primary" to={reason.action.to}>
                    {reason.action.label}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  !user.onboarding_completed && (
                    <Link
                      className="im-btn im-btn--primary"
                      to="/worker/profile"
                    >
                      Compléter mon profil
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )
                )
              }
            >
              {reason
                ? reason.detail
                : "Aucune mission n’est publiée pour l’instant. Dès qu’un établissement en publie une qui vous correspond, elle apparaît ici."}
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<BriefcaseBusiness size={20} />}
              title={`Aucune mission à ${filterCity}`}
              action={
                <button
                  type="button"
                  className="im-btn im-btn--outline"
                  onClick={() => setFilterCity("")}
                >
                  Voir toutes les missions
                </button>
              }
            >
              Essayez une autre ville, ou revenez à l’ensemble des missions
              compatibles avec votre profil.
            </EmptyState>
          ) : (
            <section aria-labelledby="missions-list-title">
              <h2 id="missions-list-title" className="sr-only">
                Liste des missions disponibles
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((mission, index) => (
                  <Reveal
                    key={mission.id}
                    // Le décalage plafonne à six cartes : au-delà, l'arrivée
                    // en cascade devient une attente, pas une animation.
                    delay={Math.min(index, 5) * 0.04}
                    className="h-full"
                  >
                    <MissionCard
                      mission={mission}
                      basePath="/worker/missions"
                      establishment={mission.company.establishment_name}
                      score={mission.match.score}
                      band={mission.match.band}
                      bandLabel={mission.match.band_label}
                    />
                  </Reveal>
                ))}
              </div>
            </section>
          ))}

        {!error && !loading && <PublicOffersBridge />}
      </PageBody>
    </>
  );
}
