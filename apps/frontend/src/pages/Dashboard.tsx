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

function ProfileStatus({
  complete,
  to,
  done,
  todo,
}: {
  complete: boolean;
  to: string;
  done: string;
  todo: string;
}) {
  return (
    <section className="section side-panel" data-tour="profile-status">
      <h2>{complete ? "Votre profil" : "Complétez votre profil"}</h2>
      <p>{complete ? done : todo}</p>
      <Link className={complete ? "secondary-button inline" : "button"} to={to}>
        {complete ? "Voir mon profil" : "Compléter mon profil"}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      {complete && (
        <p className="welcome-note ink">
          <Check size={16} aria-hidden="true" />
          Profil complété
        </p>
      )}
    </section>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  if (!user || user.role === "admin") return null;
  const worker = user.role === "worker",
    p = user.profile,
    complete = user.onboarding_completed;
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
              {complete
                ? worker
                  ? p.main_job
                  : p.establishment_name
                : worker
                  ? "Espace intérimaire"
                  : "Espace entreprise"}
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
          </div>

          <ProfileStatus
            complete={complete}
            to={"/" + user.role + "/profile"}
            done={
              worker
                ? "Métier, compétences, mobilité et disponibilités sont enregistrés. Vous pouvez les modifier à tout moment."
                : "Les informations de votre établissement sont enregistrées. Vous pouvez les modifier à tout moment."
            }
            todo={
              worker
                ? `Ces informations décident des missions qui vous seront proposées : sans elles, ${name} ne recevrez rien.`
                : "Secteur, adresse et description : les intérimaires verront ces informations avant de répondre à vos missions."
            }
          />

          <section className="section" data-tour="missions">
            <div className="section-heading">
              <h2>{worker ? "Vos propositions de mission" : "Vos missions"}</h2>
              <Link className="quiet" to={"/" + user.role + "/missions"}>
                Tout voir
              </Link>
            </div>
            <div className="empty">
              <BriefcaseBusiness aria-hidden="true" />
              <h3>
                {worker
                  ? "Aucune mission proposée pour le moment"
                  : "Votre première mission commence ici"}
              </h3>
              <p>
                {worker
                  ? "Vos propositions apparaîtront ici dès que la recherche de missions sera disponible."
                  : "La création et la gestion des missions seront disponibles au prochain lot."}
              </p>
            </div>
          </section>
        </section>

        <aside className="secondary">
          {worker ? (
            <>
              <section className="side-panel" data-tour="availability">
                <CalendarDays aria-hidden="true" />
                <h2>Vos disponibilités</h2>
                {p.availabilities?.length ? (
                  p.availabilities.map((a) => (
                    <p key={a.id}>
                      <strong>
                        {new Date(a.starts_at).toLocaleDateString("fr-FR")}
                      </strong>
                      <br />
                      {new Date(a.starts_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(a.ends_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ))
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
                <p>
                  {p.mobility_radius_km != null
                    ? `Rayon de mobilité : ${p.mobility_radius_km} km`
                    : "Votre ville et votre rayon de mobilité restent à renseigner."}
                </p>
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
