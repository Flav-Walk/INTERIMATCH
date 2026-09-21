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
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

// ─── Navigation par rôle ──────────────────────────────────────────────────────

const WORKER_NAV: NavItem[] = [
  { label: "Missions", to: "/worker/missions", icon: <MapPin size={18} aria-hidden="true" /> },
  { label: "Mes candidatures", to: "/worker/applications", icon: <ClipboardList size={18} aria-hidden="true" /> },
  { label: "Mon profil", to: "/worker/profile", icon: <UserCircle size={18} aria-hidden="true" /> },
];

const COMPANY_NAV: NavItem[] = [
  { label: "Tableau de bord", to: "/company", icon: <LayoutDashboard size={18} aria-hidden="true" /> },
  { label: "Mes missions", to: "/company/missions", icon: <Briefcase size={18} aria-hidden="true" /> },
  { label: "Candidatures", to: "/company/applications", icon: <FileText size={18} aria-hidden="true" /> },
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
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  ["app-header__nav-link", isActive ? "is-active" : ""].join(" ").trim()
                }
              >
                {item.icon}
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
            <nav aria-label="Navigation mobile">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    ["app-header__mobile-link", isActive ? "is-active" : ""].join(" ").trim()
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <button
              className="app-header__mobile-signout"
              onClick={handleSignOut}
            >
              <LogOut size={18} aria-hidden="true" />
              Se déconnecter
            </button>
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