import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Check, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
export function Dashboard({ profilePage = false }: { profilePage?: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  const worker = user.role === "worker",
    p = user.profile;
  return (
    <>
      {user.demo && (
        <p className="demo-label">DEVELOPMENT / DEMO DATA · Profil fictif</p>
      )}
      <div className="workspace">
        <section className="primary">
          <div className="welcome">
            <span className="eyeline">
              {worker ? p.main_job : p.establishment_name}
            </span>
            <h1>
              {profilePage
                ? "Votre profil professionnel"
                : `Bonjour ${user.first_name},`}
            </h1>
            <p>
              {worker
                ? "Prêt pour votre prochain service ? Votre profil est en place."
                : "Votre établissement est prêt pour ses prochains recrutements."}
            </p>
            {!profilePage ? (
              <Link className="button" to={"/" + user.role + "/profile"}>
                Voir mon profil
              </Link>
            ) : (
              <Link className="button" to={"/" + user.role}>
                Revenir à mon espace
              </Link>
            )}
            <div className="welcome-note">
              <Check size={16} />
              Profil complété
            </div>
          </div>
          <section className="section">
            <div className="section-heading">
              <h2>{worker ? "Vos propositions de mission" : "Vos missions"}</h2>
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
                  ? "Vous retrouverez ici vos propositions dès que la recherche de missions sera disponible."
                  : "La création et la gestion des missions seront disponibles au prochain lot."}
              </p>
              {!worker && (
                <button
                  className="button"
                  disabled
                  title="Disponible au prochain lot"
                >
                  Créer une mission
                </button>
              )}
            </div>
          </section>
          <section className="section side-panel">
            <h2>{worker ? "Vos compétences" : "Votre établissement"}</h2>
            {worker ? (
              <div className="skill-options">
                {p.skills?.map((s) => (
                  <span className="badge" key={s.id}>
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <>
                <p>
                  {p.legal_name} · {p.sector}
                </p>
                <p>{p.description}</p>
                <p>
                  {p.address}, {p.postal_code} {p.city}
                </p>
              </>
            )}
            {profilePage && (
              <>
                <h3 className="section">Contact</h3>
                <p>
                  {user.first_name} {user.last_name}
                  <br />
                  {user.email}
                  {p.phone && (
                    <>
                      <br />
                      {p.phone}
                    </>
                  )}
                </p>
                {worker && (
                  <>
                    <h3>Expériences</h3>
                    {p.experiences?.length ? (
                      p.experiences.map((e, i) => (
                        <p key={i}>
                          {e.job_title} · {e.employer} · {e.years} ans
                        </p>
                      ))
                    ) : (
                      <p>Premières expériences à venir.</p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </section>
        <aside className="secondary">
          <section className="side-panel">
            <MapPin aria-hidden="true" />
            <h2>{p.city}</h2>
            <p>
              {worker
                ? `Rayon de mobilité : ${p.mobility_radius_km} km`
                : p.address}
            </p>
          </section>
          <section className="side-panel pale">
            <CalendarDays aria-hidden="true" />
            <h2>{worker ? "Vos disponibilités" : "Votre planning"}</h2>
            {worker ? (
              p.availabilities?.map((a) => (
                <p key={a.id}>
                  <strong>
                    {new Date(a.starts_at).toLocaleDateString("fr-FR")}
                  </strong>
                  <br />
                  {new Date(a.starts_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(a.ends_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ))
            ) : (
              <p>Aucune mission planifiée pour le moment.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
