// src/layouts/AppLayout.tsx
//
// Shell principal de l'application ALP'EMPLOI.
// Consomme useAuth() en lecture seule — NE PAS modifier hooks/.
// Rôle déduit depuis l'URL (pathname) — pas besoin de l'exposer dans Auth.
// Contient le skip link RGAA 4.1 (critère 12.6).

import { useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Briefcase,
  LayoutDashboard,
  FileText,
  UserCircle,
  MapPin,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { NavigationItem } from "../components/ui/NavigationItem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Actif uniquement sur l'URL exacte (racine d'un espace) */
  end?: boolean;
}

// Actif sur l'URL exacte, ou sur une sous-page (/company/missions/12 → « Mes missions »)
function isNavActive(pathname: string, item: NavItem): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

// ─── Navigation par rôle ──────────────────────────────────────────────────────

const WORKER_NAV: NavItem[] = [
  { label: "Missions", to: "/worker/missions", icon: MapPin },
  { label: "Mes candidatures", to: "/worker/applications", icon: ClipboardList },
  { label: "Mon profil", to: "/worker/profile", icon: UserCircle },
];

const COMPANY_NAV: NavItem[] = [
  { label: "Tableau de bord", to: "/company", icon: LayoutDashboard, end: true },
  { label: "Mes missions", to: "/company/missions", icon: Briefcase },
  { label: "Candidatures", to: "/company/applications", icon: FileText },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export function AppLayout() {
  // On ne lit que `user` depuis useAuth — role et signOut n'y sont pas exposés
  useAuth(); const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Rôle déduit du préfixe d'URL — fiable car routes préfixées /worker/ et /company/
  const role: "worker" | "company" | null =
    pathname.startsWith("/company") ? "company" :
      pathname.startsWith("/worker") ? "worker" :
        null;

  const navItems = role === "company" ? COMPANY_NAV : WORKER_NAV;

  // Déconnexion — redirige vers /login (à brancher sur le vrai signOut quand AuthContext sera lu)
  function handleSignOut() {
    navigate("/login");
  }

  return (
    <>
      {/* ── Skip link RGAA 4.1 ──────────────────────────────────────────────
          Premier élément focusable de la page.
          Visible uniquement au focus clavier (style dans shell.css).       */}
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="app-header" role="banner">
        <div className="app-header__inner">

          {/* Logo */}
          <Link
            to={role === "company" ? "/company" : "/worker/missions"}
            className="app-header__logo"
            aria-label="ALP'EMPLOI — Retour à l'accueil"
          >
            {/* Sigle SVG inline — pas d'image externe (RGESN) */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <rect width="32" height="32" rx="8" fill="var(--forest)" />
              <text
                x="16"
                y="22"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontSize="18"
                fontWeight="700"
                fill="var(--orange)"
              >
                A
              </text>
            </svg>
            <span className="app-header__brand">
              ALP<span aria-hidden="true">'</span>EMPLOI
            </span>
          </Link>

          {/* Navigation desktop */}
          <nav className="app-header__nav" aria-label="Navigation principale">
            {navItems.map(({ icon: Icon, ...item }) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  ["app-header__nav-link", isActive ? "is-active" : ""].join(" ").trim()
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Actions droite */}
          <div className="app-header__actions">

            {/* Pill rôle — visible seulement si connecté dans un espace */}
            {role && (
              <span
                className="app-header__role-pill"
                aria-label={`Connecté en tant que ${role === "company" ? "entreprise" : "intérimaire"}`}
              >
                {role === "company" ? "Entreprise" : "Intérimaire"}
              </span>
            )}

            {/* Déconnexion desktop */}
            <button
              className="app-header__signout"
              onClick={handleSignOut}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut size={18} aria-hidden="true" />
              <span className="app-header__signout-label">Déconnexion</span>
            </button>

            {/* Burger mobile */}
            <button
              className="app-header__burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {menuOpen
                ? <X size={22} aria-hidden="true" />
                : <Menu size={22} aria-hidden="true" />
              }
            </button>
          </div>
        </div>

        {/* ── Menu mobile ──────────────────────────────────────────────────── */}
        {menuOpen && (
          <div
            id="mobile-menu"
            className="app-header__mobile-menu"
            role="dialog"
            aria-label="Menu de navigation"
          >
            <nav className="app-header__mobile-nav" aria-label="Navigation mobile">
              {navItems.map((item) => (
                <NavigationItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isActive={isNavActive(pathname, item)}
                  tone="inverse"
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>

            <NavigationItem
              icon={LogOut}
              label="Se déconnecter"
              tone="inverse"
              onClick={handleSignOut}
            />
          </div>
        )}
      </header>

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

// Default export pour les imports dynamiques (lazy) éventuels
export default AppLayout;