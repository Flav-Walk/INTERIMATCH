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
  UserCircle,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
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
import { Logo } from "../components/Logo";
import { Avatar } from "../components/ui/Avatar";
import { cn } from "../lib/cn";
import {
  CURRENT_TOUR_VERSION,
  shouldRunTour,
  tourFor,
} from "../services/tours";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Affiché sur le rail mobile, où le libellé complet ne tient pas. */
  short?: string;
}

const links: Record<Role, NavItem[]> = {
  worker: [
    {
      to: "/worker",
      label: "Tableau de bord",
      short: "Tableau",
      icon: <LayoutDashboard size={16} aria-hidden="true" />,
    },
    {
      to: "/worker/profile",
      label: "Mon profil",
      short: "Profil",
      icon: <UserCircle size={16} aria-hidden="true" />,
    },
    {
      to: "/worker/missions",
      label: "Missions",
      icon: <MapPin size={16} aria-hidden="true" />,
    },
    {
      to: "/worker/applications",
      label: "Mes candidatures",
      short: "Candidatures",
      icon: <ClipboardList size={16} aria-hidden="true" />,
    },
    {
      to: "/worker/documents",
      label: "Mes documents",
      short: "Documents",
      icon: <FileText size={16} aria-hidden="true" />,
    },
    {
      to: "/worker/public-offers",
      label: "Offres France Travail",
      short: "France Travail",
      icon: <Globe size={16} aria-hidden="true" />,
    },
  ],
  company: [
    {
      to: "/company",
      label: "Accueil",
      icon: <LayoutDashboard size={16} aria-hidden="true" />,
    },
    {
      to: "/company/missions",
      label: "Missions",
      icon: <Briefcase size={16} aria-hidden="true" />,
    },
    {
      to: "/company/applications",
      label: "Candidatures",
      icon: <FileText size={16} aria-hidden="true" />,
    },
    {
      to: "/company/documents",
      label: "Documents",
      icon: <ClipboardList size={16} aria-hidden="true" />,
    },
    {
      to: "/company/profile",
      label: "Entreprise",
      icon: <Building2 size={16} aria-hidden="true" />,
    },
  ],
  admin: [
    {
      to: "/admin",
      label: "Administration",
      icon: <ShieldCheck size={16} aria-hidden="true" />,
    },
  ],
};

/**
 * Navigation principale.
 *
 * CE QUI N'ALLAIT PAS.
 * Six gélules alignées dans une barre, toutes de la même longueur apparente,
 * sans hiérarchie ni indication de position autre qu'un fond légèrement plus
 * clair. Sur un écran étroit, la rangée se repliait sur deux lignes et la
 * hauteur du bandeau changeait d'une page à l'autre.
 *
 * CE QUI LE REMPLACE.
 * Un indicateur actif animé par `layoutId` : il n'est pas déplacé, il est
 * remonté sous le lien actif et Motion interpole la course. Le repère se
 * déplace donc VISIBLEMENT d'une page à l'autre, ce qui apprend la structure
 * du site au lieu de la subir. Technique reprise de SmoothUI `animated-tabs`.
 *
 * SUR MOBILE, le rail passe en défilement horizontal plutôt que de se replier :
 * la hauteur du bandeau reste constante quelle que soit la page — un bandeau
 * qui grandit fait sauter tout le contenu en dessous — et le lien actif est
 * ramené dans le champ à l'arrivée, ce qui évite d'avoir à chercher où l'on se
 * trouve. Un dégradé sur le bord droit signale qu'il reste des liens.
 */
function MainNav({
  role,
  pending,
  activePath,
}: {
  role: Role;
  pending: number;
  activePath: string;
}) {
  const still = useReducedMotion();
  const rail = useRef<HTMLElement>(null);

  // Le lien actif est ramené dans le champ à chaque changement de page. Sans
  // cela, arriver sur « Offres France Travail » depuis un lien profond laisse
  // le rail au début, et rien n'indique où l'on est.
  useEffect(() => {
    const active = rail.current?.querySelector<HTMLElement>(".is-active");
    active?.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activePath, still]);

  return (
    <div className="relative min-w-0 flex-1">
      <nav
        ref={rail}
        aria-label="Navigation principale"
        data-tour="nav"
        className={cn(
          "flex items-stretch gap-0.5 overflow-x-auto",
          // La barre de défilement du système couperait le rail en deux sur
          // Windows : le rail est trop bas pour l'accueillir.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {links[role].map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/${role}` || link.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "app-header__nav-link relative flex shrink-0 items-center gap-2 rounded-[7px] px-3 py-2 font-medium text-[0.8125rem] whitespace-nowrap transition-colors duration-150",
                isActive
                  ? "is-active text-white"
                  : "text-white/62 hover:bg-white/7 hover:text-white/90",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    aria-hidden="true"
                    layoutId="im-nav-active"
                    className="absolute inset-0 rounded-[7px] bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    transition={
                      still
                        ? { duration: 0 }
                        : { type: "spring", bounce: 0.12, duration: 0.38 }
                    }
                  />
                )}
                <span className="relative z-10 flex shrink-0 opacity-80">
                  {link.icon}
                </span>
                {/* Le libellé court n'existe qu'en dessous de `sm` : les tests
                    de parcours cliquent sur le libellé complet à toutes les
                    largeurs, et un lecteur d'écran doit entendre « Offres
                    France Travail », pas « France Travail ». Les deux sont
                    donc rendus, un seul est affiché. */}
                {link.short ? (
                  <>
                    <span className="relative z-10 hidden sm:inline">
                      {link.label}
                    </span>
                    <span className="relative z-10 sm:hidden" aria-hidden="true">
                      {link.short}
                    </span>
                    <span className="sr-only sm:hidden">{link.label}</span>
                  </>
                ) : (
                  <span className="relative z-10">{link.label}</span>
                )}
                {link.to === "/company/applications" && pending > 0 && (
                  <span className="nav-badge relative z-10 rounded-full bg-clay-ink px-1.5 py-px font-bold text-[0.6875rem] text-white tabular-nums">
                    {pending}
                    <span className="sr-only">
                      {" "}
                      candidature{pending > 1 ? "s" : ""} en attente
                    </span>
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {/* Le rail peut déborder : sans repli visuel, rien ne dit qu'il reste
          des liens à droite. Le dégradé n'intercepte aucun clic. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(to_right,transparent,var(--color-forest-deep))] lg:hidden"
      />
    </div>
  );
}

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

  // Un menu déroulant natif reste ouvert quand on navigue depuis un de ses
  // liens : il faut le refermer soi-même, sinon il flotte au-dessus de la page
  // suivante. Le clic à l'extérieur, lui, n'est pas géré par `<details>`.
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        account.current?.open &&
        !account.current.contains(event.target as Node)
      )
        account.current.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

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
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Le lien d'évitement reste celui de la couche `legacy` : il est déjà
          hors champ par défaut, ramené sous le bandeau au focus, et le test
          d'accessibilité s'appuie sur cette classe. */}
      <a className="skip-link" href="#content">
        Aller au contenu
      </a>

      {/*
       * Le bandeau est vert profond, pas blanc.
       *
       * Un en-tête blanc sur un fond papier ne se détache pas : la page n'a
       * plus de sommet, et rien n'ancre la marque. Le vert de marque le fait,
       * et il donne au produit une constante visible sur tous les écrans — ce
       * que la capture d'une soutenance retient en premier.
       */}
      <header className="app-header sticky top-0 z-30 bg-forest-deep text-white">
        {/*
         * La rangée s'enroule. Sur grand écran, tout tient sur une ligne. En
         * dessous de `xl`, la recherche entreprise passe SEULE à la ligne
         * suivante plutôt que d'être masquée : c'est l'outil de travail d'un
         * recruteur, et le priver de recherche sur mobile serait le priver de
         * la fonction, pas d'un confort. Un espace intérimaire n'a pas de
         * recherche : sa rangée ne s'enroule donc jamais, et la hauteur du
         * bandeau reste identique d'une page à l'autre.
         */}
        <div className="im-shell im-shell--wide flex flex-wrap items-center gap-x-3 gap-y-2 py-2 lg:gap-x-6 xl:h-16 xl:flex-nowrap xl:py-0">
          <NavLink
            className="flex shrink-0 items-center text-white"
            to={user ? destination(user) : "/"}
            aria-label="InteriMatch, accueil"
          >
            <Logo variant="light" />
          </NavLink>

          {user ? (
            <>
              <MainNav
                role={user.role}
                pending={pending}
                activePath={location.pathname}
              />

              {user.role === "company" && (
                <form
                  className="order-last flex w-full shrink-0 items-center gap-2 rounded-[8px] border border-white/14 bg-white/8 px-2.5 py-1.5 transition-colors focus-within:border-white/40 focus-within:bg-white/12 xl:order-none xl:w-auto"
                  role="search"
                  onSubmit={search}
                  key={params.get("q") ?? ""}
                >
                  <Search size={15} aria-hidden="true" className="shrink-0 opacity-70" />
                  <input
                    name="q"
                    type="search"
                    aria-label="Rechercher une mission"
                    placeholder="Rechercher une mission…"
                    defaultValue={params.get("q") ?? ""}
                    className="min-w-0 flex-1 border-0 bg-transparent text-[0.8125rem] text-white outline-none placeholder:text-white/50 xl:w-44 xl:flex-none"
                  />
                </form>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <details
                  className="group relative"
                  ref={account}
                  data-tour="account"
                >
                  <summary
                    aria-label="Mon compte"
                    className="flex cursor-pointer list-none items-center gap-2 rounded-[8px] py-1 pr-1.5 pl-1 transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden"
                  >
                    <Avatar
                      src={user.profile.avatar_url ?? null}
                      initials={initials(user)}
                      size={30}
                      tone="light"
                    />
                    <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
                      <strong className="max-w-40 truncate font-semibold text-[0.8125rem]">
                        {user.first_name
                          ? `${user.first_name} ${user.last_name}`.trim()
                          : user.email}
                      </strong>
                      <span className="max-w-40 truncate text-[0.6875rem] text-white/60">
                        {user.role === "admin"
                          ? "Administration"
                          : user.role === "company"
                            ? (user.profile.establishment_name ??
                              "Votre établissement")
                            : "Espace intérimaire"}
                      </span>
                    </span>
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 opacity-70 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-[10px] border border-rule bg-surface p-1 text-ink shadow-float">
                    <p className="border-rule border-b px-3 py-2 lg:hidden">
                      <strong className="block truncate font-semibold text-[0.8125rem]">
                        {user.first_name
                          ? `${user.first_name} ${user.last_name}`.trim()
                          : user.email}
                      </strong>
                      <span className="block truncate text-[0.75rem] text-ink-faint">
                        {user.email}
                      </span>
                    </p>
                    {user.role !== "admin" && (
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-left font-medium text-[0.8125rem] transition-colors hover:bg-sage-tint"
                        onClick={() => {
                          account.current?.removeAttribute("open");
                          account.current
                            ?.querySelector<HTMLElement>("summary")
                            ?.focus();
                          if (!onDashboard) navigate(destination(user));
                          setReplay(true);
                        }}
                      >
                        <LifeBuoy
                          size={15}
                          aria-hidden="true"
                          className="text-ink-faint"
                        />
                        Revoir la visite
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-left font-medium text-[0.8125rem] transition-colors hover:bg-alert-tint hover:text-alert"
                      onClick={() => void logout()}
                    >
                      <LogOut
                        size={15}
                        aria-hidden="true"
                        className="text-ink-faint"
                      />
                      Se déconnecter
                    </button>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <nav
              className="ml-auto flex items-center gap-1.5"
              aria-label="Compte"
            >
              <NavLink
                to="/login"
                className="rounded-[8px] px-3 py-2 font-medium text-[0.8125rem] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Connexion
              </NavLink>
              <NavLink
                to="/register"
                className="rounded-[8px] bg-clay-ink px-3.5 py-2 font-semibold text-[0.8125rem] text-white transition-colors hover:bg-clay"
              >
                Créer un compte
              </NavLink>
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

      <footer className="shell-footer mt-auto block border-rule border-t bg-surface p-0">
        <div className="im-shell im-shell--wide flex flex-col gap-4 py-7 text-[0.8125rem] text-ink-faint md:flex-row md:items-center md:justify-between">
          <span className="text-forest">
            <Logo variant="forest" />
          </span>
          <nav
            aria-label="Informations légales"
            className="flex flex-wrap gap-x-5 gap-y-1"
          >
            <NavLink
              to="/mentions-legales"
              className="transition-colors hover:text-forest"
            >
              Mentions légales
            </NavLink>
            <NavLink
              to="/politique-confidentialite"
              className="transition-colors hover:text-forest"
            >
              Politique de confidentialité
            </NavLink>
            <NavLink
              to="/accessibilite"
              className="transition-colors hover:text-forest"
            >
              Accessibilité : non conforme
            </NavLink>
          </nav>
          <span>Prototype · Hôtellerie &amp; restauration</span>
        </div>
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
    </div>
  );
}
