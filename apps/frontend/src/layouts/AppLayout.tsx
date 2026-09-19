import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Sprout,
  UserCircle,
} from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useCompanyData } from "../hooks/CompanyData";
import {
  destination,
  errorMessage,
  api,
  type Role,
  type User,
} from "../services/session";
import { GuidedTour } from "../components/GuidedTour";
import {
  CURRENT_TOUR_VERSION,
  shouldRunTour,
  tourFor,
} from "../services/tours";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Navigation de la maquette : Accueil · Missions · Candidats · Entreprise. */
const links: Record<Role, NavItem[]> = {
  worker: [
    {
      to: "/worker",
      label: "Tableau de bord",
      icon: <LayoutDashboard size={17} aria-hidden="true" />,
    },
    {
      to: "/worker/profile",
      label: "Mon profil",
      icon: <UserCircle size={17} aria-hidden="true" />,
    },
    {
      to: "/worker/missions",
      label: "Missions",
      icon: <MapPin size={17} aria-hidden="true" />,
    },
    {
      to: "/worker/applications",
      label: "Mes candidatures",
      icon: <ClipboardList size={17} aria-hidden="true" />,
    },
    {
      to: "/worker/public-offers",
      label: "Offres France Travail",
      icon: <Globe size={17} aria-hidden="true" />,
    },
  ],
  company: [
    {
      to: "/company",
      label: "Accueil",
      icon: <LayoutDashboard size={17} aria-hidden="true" />,
    },
    {
      to: "/company/missions",
      label: "Missions",
      icon: <Briefcase size={17} aria-hidden="true" />,
    },
    {
      to: "/company/applications",
      label: "Candidatures",
      icon: <FileText size={17} aria-hidden="true" />,
    },
    {
      to: "/company/profile",
      label: "Entreprise",
      icon: <Building2 size={17} aria-hidden="true" />,
    },
  ],
  admin: [
    {
      to: "/admin",
      label: "Administration",
      icon: <ShieldCheck size={17} aria-hidden="true" />,
    },
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
    // Candidatures en attente : le seul chiffre qui appelle une action.
    { counts } = useCompanyData(),
    navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [error, setError] = useState(""),
    [replay, setReplay] = useState(false);
  const account = useRef<HTMLDetailsElement>(null);
  const user = auth.user;
  const pending = user?.role === "company" ? counts.pending : 0;

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

  /**
   * Fin de la visite guidée.
   *
   * Noter qu'elle a été vue est une préférence d'affichage, pas une donnée
   * métier : rien ne justifie de faire patienter l'utilisateur le temps d'un
   * aller-retour. L'interface se ferme donc immédiatement, et l'écriture part
   * derrière. Si elle échoue, la visite se represente à la prochaine session —
   * sans conséquence, et sans message d'erreur qui n'apprendrait rien.
   *
   * `PUT /me/tour` renvoie déjà le profil à jour : un `GET /me` supplémentaire
   * serait un second aller-retour pour une information déjà en main.
   */
  function closeTour() {
    setReplay(false);
    if (!user || user.tour_version >= CURRENT_TOUR_VERSION) return;
    auth.setUser({ ...user, tour_version: CURRENT_TOUR_VERSION });
    void api<User>("/me/tour", {
      method: "PUT",
      body: JSON.stringify({ version: CURRENT_TOUR_VERSION }),
    })
      .then((updated) => auth.setUser(updated))
      .catch(() => undefined);
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
      <a className="skip-link" href="#content">
        Aller au contenu
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink
            className="app-header__logo"
            to={user ? destination(user) : "/"}
          >
            <Sprout size={22} aria-hidden="true" />
            <span className="app-header__brand">InteriMatch</span>
          </NavLink>

          {user ? (
            <>
              <nav
                aria-label="Navigation principale"
                className="app-header__nav"
                data-tour="nav"
              >
                {links[user.role].map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === destination(user)}
                    className={({ isActive }) =>
                      "app-header__nav-link" + (isActive ? " is-active" : "")
                    }
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {/* Le badge ne compte que de vraies candidatures en
                        attente. Il porte son propre texte : une pastille
                        colorée seule ne dit rien à qui ne distingue pas les
                        couleurs, ni à un lecteur d'écran. */}
                    {link.to === "/company/applications" && pending > 0 && (
                      <span className="nav-badge">
                        {pending}
                        <span className="sr-only">
                          {" "}
                          candidature{pending > 1 ? "s" : ""} en attente
                        </span>
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="app-header__actions">
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
                        {user.role === "admin"
                          ? "Administration"
                          : user.role === "company"
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
              </div>
            </>
          ) : (
            <nav className="account-link" aria-label="Compte">
              <NavLink to="/login">Connexion</NavLink>
              <NavLink to="/register">Créer un compte</NavLink>
            </nav>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <main id="content" className="app-main" tabIndex={-1}>
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
          onClose={closeTour}
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
