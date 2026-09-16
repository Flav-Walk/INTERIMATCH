import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sprout, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { destination, errorMessage, api, type User } from "../services/session";
import { GuidedTour } from "../components/GuidedTour";
import {
  CURRENT_TOUR_VERSION,
  shouldRunTour,
  tourFor,
} from "../services/tours";

const links: Record<"worker" | "company", { to: string; label: string }[]> = {
  worker: [
    { to: "/worker", label: "Tableau de bord" },
    { to: "/worker/profile", label: "Mon profil" },
    { to: "/worker/missions", label: "Missions" },
  ],
  company: [
    { to: "/company", label: "Tableau de bord" },
    { to: "/company/profile", label: "Mon établissement" },
    { to: "/company/missions", label: "Missions" },
    { to: "/company/candidates", label: "Candidats" },
  ],
};

function WorkspaceNav({ user }: { user: User }) {
  if (user.role === "admin") return null;
  return (
    <nav aria-label="Navigation principale" data-tour="nav">
      {links[user.role].map((link) => (
        <NavLink key={link.to} to={link.to} end={link.to === destination(user)}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState(""),
    [replay, setReplay] = useState(false);
  const user = auth.user;

  async function logout() {
    try {
      await auth.logout();
      navigate("/login");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // La visite pointe des zones du tableau de bord : elle ne démarre que là,
  // pour ne jamais mettre en évidence un élément absent de la page courante.
  const onDashboard = Boolean(user) && location.pathname === destination(user!);
  const runTour =
    Boolean(user) &&
    user!.role !== "admin" &&
    onDashboard &&
    (replay || shouldRunTour(user!.tour_version));

  async function closeTour() {
    setReplay(false);
    if (user && user.tour_version < CURRENT_TOUR_VERSION) {
      try {
        await api("/me/tour", {
          method: "PUT",
          body: JSON.stringify({ version: CURRENT_TOUR_VERSION }),
        });
        await auth.reload();
      } catch (e) {
        // Ne jamais bloquer l'interface parce que la progression n'a pas pu être notée.
        setError(errorMessage(e));
      }
    }
  }

  return (
    <>
      <a className="skip" href="#content">
        Aller au contenu
      </a>
      <header className="site-header">
        <NavLink className="brand" to={user ? destination(user) : "/"}>
          <Sprout aria-hidden="true" />
          InteriMatch
        </NavLink>
        {user ? (
          <>
            <WorkspaceNav user={user} />
            <div className="account-link" data-tour="account">
              {user.role !== "admin" && (
                <button
                  className="text-button quiet-button"
                  onClick={() => setReplay(true)}
                  disabled={!onDashboard}
                  title={
                    onDashboard
                      ? undefined
                      : "Disponible depuis votre tableau de bord"
                  }
                >
                  <LifeBuoy size={16} aria-hidden="true" />
                  Revoir la visite
                </button>
              )}
              <button className="text-button" onClick={() => void logout()}>
                Se déconnecter
              </button>
            </div>
          </>
        ) : (
          <nav className="account-link" aria-label="Compte">
            <NavLink to="/login">Connexion</NavLink>
            <NavLink to="/register">Créer un compte</NavLink>
          </nav>
        )}
      </header>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <main id="content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span className="brand">
          <Sprout size={19} aria-hidden="true" />
          InteriMatch
        </span>
        <span>Les talents d’aujourd’hui, vos réussites de demain.</span>
        <span>Prototype · Hôtellerie &amp; restauration</span>
      </footer>
      {runTour && user && (
        <GuidedTour
          steps={tourFor(user.role)}
          onClose={() => void closeTour()}
          label={
            user.role === "company"
              ? "Visite guidée de l’espace entreprise"
              : "Visite guidée de l’espace intérimaire"
          }
        />
      )}
    </>
  );
}
