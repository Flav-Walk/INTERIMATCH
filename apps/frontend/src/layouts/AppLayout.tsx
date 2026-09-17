import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Sprout, Search, LifeBuoy, LogOut, ChevronDown } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { destination, errorMessage, api, type User } from "../services/session";
import { GuidedTour } from "../components/GuidedTour";
import {
  CURRENT_TOUR_VERSION,
  shouldRunTour,
  tourFor,
} from "../services/tours";

/** Navigation de la maquette : Accueil · Missions · Candidats · Entreprise. */
const links: Record<"worker" | "company", { to: string; label: string }[]> = {
  worker: [
    { to: "/worker", label: "Tableau de bord" },
    { to: "/worker/profile", label: "Mon profil" },
    { to: "/worker/missions", label: "Missions" },
  ],
  company: [
    { to: "/company", label: "Accueil" },
    { to: "/company/missions", label: "Missions" },
    { to: "/company/candidates", label: "Candidats" },
    { to: "/company/profile", label: "Entreprise" },
  ],
};

const initials = (user: User) => {
  const letters = `${user.first_name} ${user.last_name}`
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (letters || user.email.slice(0, 2)).toLocaleUpperCase("fr");
};

export function AppLayout() {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [error, setError] = useState(""),
    [replay, setReplay] = useState(false);
  const account = useRef<HTMLDetailsElement>(null);
  const user = auth.user;

  async function logout() {
    account.current?.removeAttribute("open");
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

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    navigate(
      value
        ? `/company/missions?q=${encodeURIComponent(value)}`
        : "/company/missions",
    );
  }

  return (
    <>
      <a className="skip" href="#content">
        Aller au contenu
      </a>
      <header className="shell-header">
        <NavLink className="shell-brand" to={user ? destination(user) : "/"}>
          <Sprout size={22} aria-hidden="true" />
          InteriMatch
        </NavLink>
        {user ? (
          <>
            {user.role !== "admin" && (
              <nav
                aria-label="Navigation principale"
                className="shell-nav"
                data-tour="nav"
              >
                {links[user.role].map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === destination(user)}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            )}
            {user.role === "company" && (
              <form
                className="shell-search"
                role="search"
                onSubmit={search}
                key={params.get("q") ?? ""}
              >
                <Search size={16} aria-hidden="true" />
                <input
                  name="q"
                  type="search"
                  aria-label="Rechercher une mission"
                  placeholder="Rechercher une mission…"
                  defaultValue={params.get("q") ?? ""}
                />
              </form>
            )}
            <details
              className="shell-account"
              ref={account}
              data-tour="account"
            >
              <summary aria-label="Mon compte">
                <span className="avatar" aria-hidden="true">
                  {initials(user)}
                </span>
                <span className="account-identity">
                  <strong>
                    {user.first_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.email}
                  </strong>
                  <span>
                    {user.role === "company"
                      ? (user.profile.establishment_name ??
                        "Votre établissement")
                      : "Espace intérimaire"}
                  </span>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="account-menu">
                {user.role !== "admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      account.current?.removeAttribute("open");
                      setReplay(true);
                    }}
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
                <button type="button" onClick={() => void logout()}>
                  <LogOut size={16} aria-hidden="true" />
                  Se déconnecter
                </button>
              </div>
            </details>
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
      <footer className="shell-footer">
        <span className="shell-brand">
          <Sprout size={19} aria-hidden="true" />
          InteriMatch
        </span>
        <span>Les talents d’aujourd’hui, vos réussites de demain.</span>
        <nav aria-label="Liens utiles">
          <span>Prototype · Hôtellerie &amp; restauration</span>
        </nav>
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
