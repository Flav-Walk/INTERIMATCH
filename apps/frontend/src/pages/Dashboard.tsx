import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  Check,
  BriefcaseBusiness,
  Users,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  formatSlot,
  requirementLabels,
  upcomingAvailabilities,
} from "../services/profile";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import { listOpenMissions, type OpenMission } from "../services/missions";

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
  const [open, setOpen] = useState<OpenMission[]>([]);
  const [missionsError, setMissionsError] = useState("");
  const isWorker = user?.role === "worker";

  // Un aperçu des missions réellement offertes. Le tableau de bord annonçait
  // jusqu'ici une fonctionnalité à venir : elle existe maintenant.
  useEffect(() => {
    if (!isWorker) return;
    let live = true;
    void listOpenMissions()
      .then((r) => live && setOpen(r.missions))
      .catch((e) => live && setMissionsError(errorMessage(e)));
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

  return (
    <>
      {user.demo && (
        <p className="demo-label">DEVELOPMENT / DEMO DATA · Profil fictif</p>
      )}
      <div className="workspace">
        <section className="primary">
          <div className="welcome">
            <span className="eyeline">
              {worker
                ? "Espace intérimaire"
                : (p.establishment_name ?? "Espace entreprise")}
            </span>
            <h1>
              {user.first_name ? `Bonjour ${user.first_name},` : "Bienvenue,"}
            </h1>
            <p>
              {worker
                ? complete
                  ? "Prêt pour votre prochain service ? Votre profil est en place."
                  : "Renseignez votre métier, vos compétences et vos disponibilités pour recevoir des missions adaptées."
                : complete
                  ? "Votre établissement est prêt pour ses prochains recrutements."
                  : "Présentez votre établissement pour préparer vos premiers recrutements."}
            </p>
            {complete && (
              <Link
                className="welcome-action"
                to={"/" + user.role + "/profile"}
                data-tour="profile-status"
              >
                <Check size={15} aria-hidden="true" />
                Profil complété · Modifier mon profil
              </Link>
            )}
          </div>

          {!complete && (
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
            {worker && open.length > 0 ? (
              <div className="mission-grid">
                {open.slice(0, 2).map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    basePath="/worker/missions"
                    score={mission.match.score}
                  />
                ))}
              </div>
            ) : (
              <div className="empty">
                <BriefcaseBusiness aria-hidden="true" />
                <h3>
                  {worker
                    ? "Aucune mission disponible pour le moment"
                    : "Votre première mission commence ici"}
                </h3>
                <p>
                  {worker
                    ? "Dès qu’un établissement publie une mission, elle apparaît ici."
                    : "La création et la gestion des missions seront disponibles au prochain lot."}
                </p>
              </div>
            )}
          </section>
        </section>

        <aside className="secondary">
          {worker ? (
            <>
              <section className="side-panel" data-tour="availability">
                <CalendarDays aria-hidden="true" />
                <h2>Vos disponibilités</h2>
                {upcoming.length ? (
                  <>
                    <p className="lead-figure">
                      {upcoming.length} créneau{upcoming.length > 1 ? "x" : ""}{" "}
                      à venir
                    </p>
                    <ul className="slot-list plain">
                      {upcoming.slice(0, 3).map((slot) => (
                        <li key={slot.id}>{formatSlot(slot)}</li>
                      ))}
                    </ul>
                    {upcoming.length > 3 && (
                      <Link className="quiet" to="/worker/profile">
                        Voir les {upcoming.length} créneaux
                      </Link>
                    )}
                  </>
                ) : (
                  <p>
                    Aucun créneau enregistré. Vos disponibilités se renseignent
                    depuis votre profil.
                  </p>
                )}
              </section>
              <section className="side-panel pale">
                <MapPin aria-hidden="true" />
                <h2>{p.city ?? "Votre mobilité"}</h2>
                {p.city && p.mobility_radius_km != null ? (
                  <>
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
                <Users aria-hidden="true" />
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
                <MapPin aria-hidden="true" />
                <h2>{p.city ?? "Votre établissement"}</h2>
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
