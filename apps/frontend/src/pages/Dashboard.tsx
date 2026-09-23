import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  BriefcaseBusiness,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  requirementLabels,
  upcomingAvailabilities,
} from "../services/profile";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import {
  explainEmpty,
  listOpenMissions,
  missionTemporalState,
  type Exclusions,
  type OpenMission,
} from "../services/missions";
import {
  awaitingReply,
  listMyApplications,
  upcomingEngagements,
  type WorkerApplication,
} from "../services/applications";
import { ConfirmedMissions } from "../components/applications/ConfirmedMissions";
import { HeroBanner } from "../components/HeroBanner";
import { RequirementMeter } from "../components/da/RequirementMeter";
import {
  AvailabilityWidget,
  LeadNumber,
  MobilityRadar,
} from "../components/da/DashboardWidgets";
import { workerRequirementProgress } from "../services/completion";
import { EmptyState } from "../components/da/EmptyState";
import { MobilityMap } from "../components/da/MobilityMap";

/**
 * Rappel de complétion. Il n'apparaît que tant qu'il reste quelque chose à
 * faire : une fois le profil complet, l'information devient secondaire et cède
 * la place aux disponibilités, à la mobilité et aux propositions. Le lien vers
 * le profil reste accessible depuis l'accueil et la navigation.
 */
function ProfileStatus({
  to,
  todo,
  missing = [],
}: {
  to: string;
  todo: string;
  missing?: (keyof typeof requirementLabels)[];
}) {
  return (
    <section className="section side-panel" data-tour="profile-status">
      <h2>Complétez votre profil</h2>
      <p>{todo}</p>
      {missing.length > 0 && (
        <ul className="steps-list">
          {missing.map((rule) => (
            <li key={rule}>{requirementLabels[rule]}</li>
          ))}
        </ul>
      )}
      <Link className="button" to={to}>
        Compléter mon profil
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function Dashboard() {
  const { user, revision } = useAuth();
  const isWorker = user?.role === "worker";
  usePageSeo({
    title: isWorker
      ? "Tableau de bord intérimaire · InteriMatch"
      : "Tableau de bord entreprise · InteriMatch",
    description: isWorker
      ? "Espace personnel intérimaire InteriMatch."
      : "Espace établissement entreprise InteriMatch.",
    robots: "noindex,nofollow",
  });
  const [open, setOpen] = useState<OpenMission[]>([]);
  const [excluded, setExcluded] = useState<Exclusions>();
  const [mine, setMine] = useState<WorkerApplication[]>([]);
  const [missionsError, setMissionsError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(true);

  // Un aperçu des missions réellement offertes. Le tableau de bord annonçait
  // jusqu'ici une fonctionnalité à venir : elle existe maintenant.
  useEffect(() => {
    if (!isWorker) return;
    let live = true;
    setMissionsLoading(true);
    setApplicationsLoading(true);
    setMissionsError("");
    setApplicationsError("");
    // Une panne du catalogue ne doit pas masquer une mission déjà acceptée,
    // et inversement : chaque réponse reste exploitable indépendamment.
    void Promise.allSettled([listOpenMissions(), listMyApplications()])
      .then(([missionsResult, applicationsResult]) => {
        if (!live) return;
        if (missionsResult.status === "fulfilled") {
          setOpen(missionsResult.value.missions);
          setExcluded(missionsResult.value.excluded);
        } else {
          setMissionsError(errorMessage(missionsResult.reason));
        }
        if (applicationsResult.status === "fulfilled") {
          setMine(applicationsResult.value.applications);
        } else {
          setApplicationsError(errorMessage(applicationsResult.reason));
        }
      })
      .finally(() => {
        if (!live) return;
        setMissionsLoading(false);
        setApplicationsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [isWorker, revision]);

  if (!user || user.role === "admin") return null;
  const worker = user.role === "worker",
    p = user.profile,
    complete = user.onboarding_completed,
    upcoming = upcomingAvailabilities(p.availabilities);
  const name = user.first_name || (worker ? "à vous" : "à votre équipe");
  // Une seule phrase ici : l'explication complète et son action vivent sur
  // l'écran des missions, que le lien « Tout voir » atteint déjà.
  const reason = worker ? explainEmpty(excluded) : null;
  const engagements = upcomingEngagements(mine);
  const hasRunningEngagement = engagements.some(
    (application) => missionTemporalState(application.mission) === "running",
  );
  const waiting = awaitingReply(mine);
  const requirementProgress = worker
    ? workerRequirementProgress(user.missing_requirements)
    : null;
  const readyForMissions = worker
    ? user.missing_requirements?.length === 0
    : complete;

  return (
    <>
      {user.demo && (
        <p className="demo-label">DEVELOPMENT / DEMO DATA · Profil fictif</p>
      )}
      <div className="workspace">
        <section className="primary">
          <HeroBanner
            eyeline={
              worker
                ? "Espace intérimaire"
                : (p.establishment_name ?? "Espace entreprise")
            }
            title={
              user.first_name ? `Bonjour ${user.first_name},` : "Bienvenue,"
            }
            subtitle={
              worker
                ? readyForMissions
                  ? "Vos prérequis sont réunis : découvrez les missions compatibles avec vos disponibilités."
                  : "Complétez les prérequis nécessaires pour recevoir des missions adaptées."
                : complete
                  ? "Votre établissement est prêt pour ses prochains recrutements."
                  : "Présentez votre établissement pour préparer vos premiers recrutements."
            }
            mascotPose="dashboard"
            gauge={
              // Un segment par prérequis + ce qui manque, en toutes lettres
              // (remplace la jauge « 100 » en fer à cheval).
              requirementProgress !== null && user.missing_requirements ? (
                <RequirementMeter
                  missing={user.missing_requirements}
                  variant="on-dark"
                />
              ) : undefined
            }
            action={
              readyForMissions ? (
                <Link
                  className="brand-hero__link"
                  to={`/${user.role}/profile`}
                  data-tour="profile-status"
                >
                  <Check size={15} aria-hidden="true" />
                  {worker ? "Prérequis réunis" : "Profil renseigné"} · Modifier
                </Link>
              ) : undefined
            }
          />

          {!readyForMissions && (
            <ProfileStatus
              missing={user.missing_requirements}
              to={"/" + user.role + "/profile"}
              todo={
                worker
                  ? `Ces informations décident des missions qui vous seront proposées : sans elles, ${name} ne recevrez rien.`
                  : "Secteur, adresse et description : les intérimaires verront ces informations avant de répondre à vos missions."
              }
            />
          )}

          {worker &&
            (applicationsLoading ||
              applicationsError ||
              engagements.length > 0) && (
              <section
                className="section confirmed-missions"
                aria-labelledby="confirmed-missions-title"
              >
                <div className="section-heading">
                  <div>
                    <span className="eyeline">Votre planning</span>
                    <h2 id="confirmed-missions-title">
                      {hasRunningEngagement
                        ? "En cours et à venir"
                        : "Vos prochaines missions"}
                    </h2>
                  </div>
                </div>
                {applicationsLoading ? (
                  <p className="quiet" role="status">
                    Chargement de vos missions confirmées…
                  </p>
                ) : applicationsError ? (
                  <p className="form-error" role="alert">
                    {applicationsError}
                  </p>
                ) : (
                  <ConfirmedMissions applications={engagements} />
                )}
                {engagements.length > 0 && (
                  <p className="confirmed-missions-note">
                    Les offres sur ces créneaux ne vous sont plus proposées. Vos
                    disponibilités déclarées restent inchangées.
                  </p>
                )}
              </section>
            )}

          <section className="section" data-tour="missions">
            <div className="section-heading">
              <h2>{worker ? "Missions disponibles" : "Vos missions"}</h2>
              <Link className="quiet" to={"/" + user.role + "/missions"}>
                Tout voir
              </Link>
            </div>
            {missionsError && (
              <p className="form-error" role="alert">
                {missionsError}
              </p>
            )}
            {!missionsError &&
              (worker && missionsLoading ? (
                <p className="quiet" role="status">
                  Chargement des missions disponibles…
                </p>
              ) : worker && open.length > 0 ? (
                <div className="mission-grid">
                  {open.slice(0, 2).map((mission) => (
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
              ) : (
                <EmptyState icon={BriefcaseBusiness}>
                  <h3>
                    {worker
                      ? (reason?.title ??
                        "Aucune mission disponible pour le moment")
                      : "Votre première mission commence ici"}
                  </h3>
                  <p>
                    {worker
                      ? (reason?.detail ??
                        "Dès qu’un établissement publie une mission qui vous correspond, elle apparaît ici.")
                      : "La création et la gestion des missions seront disponibles au prochain lot."}
                  </p>
                </EmptyState>
              ))}
          </section>
        </section>

        <aside className="secondary">
          {worker ? (
            <>
              {waiting.length > 0 && (
                <section className="side-panel">
                  <h2>Candidatures en attente</h2>
                  <p className="lead-figure">
                    <LeadNumber value={waiting.length} /> candidature
                    {waiting.length > 1 ? "s" : ""}
                  </p>
                  <p className="quiet">
                    {waiting.length > 1
                      ? "Les entreprises doivent encore vous répondre."
                      : "L’entreprise doit encore vous répondre."}
                  </p>
                  <Link className="quiet" to="/worker/applications">
                    Voir mes candidatures
                  </Link>
                </section>
              )}
              <section className="side-panel" data-tour="availability">
                <h2>Vos disponibilités</h2>
                {upcoming.length ? (
                  <>
                    <p className="lead-figure">
                      <LeadNumber value={upcoming.length} /> créneau
                      {upcoming.length > 1 ? "x" : ""} à venir
                    </p>
                    {/* Widget agenda (Calendar Event, Animata) avec les vrais
                        créneaux, à la place de la liste et de l'icône. */}
                    <AvailabilityWidget slots={upcoming} />
                    {/* Un profil complet n'exige qu'un créneau à venir ;
                        une mission, elle, doit tenir entièrement dans l'un
                        d'eux. Le dire ici évite de lire « profil complété »
                        comme une promesse de propositions. */}
                    <p className="quiet">
                      Une mission ne vous est proposée que si l’un de ces
                      créneaux la couvre entièrement.
                    </p>
                    <Link className="quiet" to="/worker/profile#disponibilites">
                      {upcoming.length > 3
                        ? `Voir et modifier les ${upcoming.length} créneaux`
                        : "Modifier mes disponibilités"}
                    </Link>
                  </>
                ) : (
                  <>
                    <p>
                      Aucun créneau enregistré. Sans disponibilité, aucune
                      mission ne peut vous être proposée.
                    </p>
                    <Link className="quiet" to="/worker/profile#disponibilites">
                      Ajouter un créneau
                    </Link>
                  </>
                )}
              </section>
              <section className="side-panel pale">
                <h2>{p.city ?? "Votre mobilité"}</h2>
                {p.city && p.mobility_radius_km != null ? (
                  <>
                    {/* Vraie carte (Plan IGN) avec le rayon à l'échelle,
                        la même que sur la page Profil. La ville est déjà
                        le titre du panneau : pas d'étiquette sur la carte. */}
                    <MobilityMap
                      city={p.city}
                      postalCode={p.postal_code ?? ""}
                      radiusKm={p.mobility_radius_km}
                      saved={
                        p.latitude != null && p.longitude != null
                          ? { lat: p.latitude, lon: p.longitude }
                          : null
                      }
                      height={220}
                      showLabel={false}
                    />
                    <p>
                      {p.postal_code} · jusqu’à {p.mobility_radius_km} km autour
                      de chez vous
                    </p>
                    <p className="quiet">
                      {p.has_vehicle
                        ? "Permis et véhicule"
                        : p.has_driving_licence
                          ? "Permis, sans véhicule"
                          : "Sans permis"}
                      {p.open_to_missions === false && " · recherche en pause"}
                    </p>
                  </>
                ) : (
                  <p>
                    Votre ville et votre rayon de mobilité restent à renseigner.
                  </p>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="side-panel" data-tour="candidates">
                <h2>Candidats compatibles</h2>
                <p>
                  Les profils seront classés par score de compatibilité, avec le
                  détail des critères et la possibilité d’élargir au-delà de
                  votre zone.
                </p>
                <Link className="quiet" to="/company/candidates">
                  Ouvrir les candidats
                </Link>
              </section>
              <section className="side-panel pale">
                <h2>{p.city ?? "Votre établissement"}</h2>
                {p.city && <MobilityRadar city={p.city} />}
                <p>
                  {p.address
                    ? `${p.address}, ${p.postal_code} ${p.city}`
                    : "L’adresse de votre établissement reste à renseigner."}
                </p>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
