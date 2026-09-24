import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";

// Mock usePageSeo to capture metadata passed by each page
const capturedSeo = vi.fn();
vi.mock("../hooks/usePageSeo", () => ({
  usePageSeo: (options: unknown) => capturedSeo(options),
  DEFAULT_SEO: {
    title: "InteriMatch · Plateforme hôtellerie & restauration",
    description:
      "InteriMatch, les missions de l’hôtellerie-restauration qui vous correspondent.",
    robots: "noindex,nofollow",
  },
}));

// Mock useAuth for rendering components without full context
let mockUser: unknown = null;
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    loadError: false,
    reload: vi.fn(),
    login: vi.fn(),
    google: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock Supabase
vi.mock("../services/supabase", () => ({
  supabase: null,
  getSupabase: vi.fn().mockResolvedValue(null),
  supabaseConfigured: false,
}));

import { Home } from "./Home";
import { MentionsLegales } from "./MentionsLegales";
import { PolitiqueConfidentialite } from "./PolitiqueConfidentialite";
import { Accessibilite } from "./Accessibilite";
import { Login } from "./Login";
import { Callback } from "./Callback";
import { Dashboard } from "./Dashboard";
import { Missions } from "./Missions";
import { CompanyApplicationsPage } from "./CompanyApplications";
import { ProfileForm } from "./ProfileForm";

describe("SEO - Stratégie d'indexation (Sous-lot 8B)", () => {
  beforeEach(() => {
    capturedSeo.mockClear();
    mockUser = null;
  });

  describe("Pages publiques indexables (index,follow)", () => {
    it("configure la Home avec title, meta description et robots index,follow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.title).toContain("InteriMatch");
      expect(seo.description).toBeDefined();
      expect(seo.description.length).toBeGreaterThan(10);
      expect(seo.robots).toBe("index,follow");
    });

    it("configure Mentions Légales avec title descriptif et robots index,follow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <MentionsLegales />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.title).toMatch(/mentions légales/i);
      expect(seo.description).toBeDefined();
      expect(seo.robots).toBe("index,follow");
    });

    it("configure Politique de Confidentialité avec title descriptif et robots index,follow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <PolitiqueConfidentialite />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.title).toMatch(/confidentialité/i);
      expect(seo.description).toBeDefined();
      expect(seo.robots).toBe("index,follow");
    });

    it("configure Accessibilité avec title descriptif et robots index,follow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <Accessibilite />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.title).toMatch(/accessibilité/i);
      expect(seo.description).toBeDefined();
      expect(seo.robots).toBe("index,follow");
    });
  });

  describe("Espaces privés et authentification (noindex,nofollow)", () => {
    it("configure la page Login en noindex,nofollow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <Login register={false} />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure la page Register en noindex,nofollow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <Login register={true} />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure la page Callback d'authentification en noindex,nofollow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <Callback />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure le Dashboard intérimaire en noindex,nofollow", () => {
      mockUser = {
        role: "worker",
        first_name: "Jean",
        onboarding_completed: true,
        profile: {},
      };

      renderToStaticMarkup(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure la page Missions en noindex,nofollow", () => {
      mockUser = {
        role: "worker",
        onboarding_completed: true,
        profile: {},
      };

      renderToStaticMarkup(
        <MemoryRouter>
          <Missions />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure la page Candidatures en noindex,nofollow", () => {
      renderToStaticMarkup(
        <MemoryRouter>
          <CompanyApplicationsPage />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });

    it("configure la page ProfileForm en noindex,nofollow", () => {
      mockUser = {
        role: "company",
        profile: {},
      };

      renderToStaticMarkup(
        <MemoryRouter>
          <ProfileForm />
        </MemoryRouter>,
      );

      expect(capturedSeo).toHaveBeenCalledTimes(1);
      const seo = capturedSeo.mock.calls[0][0];
      expect(seo.robots).toBe("noindex,nofollow");
    });
  });

  describe("Fichiers statiques SEO (robots.txt & sitemap.xml)", () => {
    const CANONICAL_ORIGIN = "https://interimatch-five.vercel.app";
    const EXPECTED_PUBLIC_ROUTES = [
      "https://interimatch-five.vercel.app/",
      "https://interimatch-five.vercel.app/mentions-legales",
      "https://interimatch-five.vercel.app/politique-confidentialite",
      "https://interimatch-five.vercel.app/accessibilite",
    ];

    it("vérifie que public/robots.txt existe, contient les directives et la référence sitemap canonique", () => {
      const robotsPath = path.resolve(__dirname, "../../public/robots.txt");
      expect(fs.existsSync(robotsPath)).toBe(true);

      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("User-agent: *");
      expect(content).toContain("Disallow: /worker");
      expect(content).toContain("Disallow: /company");
      expect(content).toContain("Disallow: /auth/");
      expect(content).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`);

      // Absence de placeholders et de domaines inventés
      expect(content).not.toContain("<DOMAINE_CANONIQUE>");
      expect(content).not.toMatch(/interimatch-(?!five\.vercel\.app)/i);
    });

    it("vérifie que public/sitemap.xml existe, est structurellement valide et contient exactement les 4 URLs publiques", () => {
      const sitemapPath = path.resolve(__dirname, "../../public/sitemap.xml");
      expect(fs.existsSync(sitemapPath)).toBe(true);

      const content = fs.readFileSync(sitemapPath, "utf-8");

      // Structure XML valide
      expect(content.trim().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(content).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(content).toContain("</urlset>");

      // Extraction de toutes les balises <loc>...</loc>
      const locMatches = Array.from(content.matchAll(/<loc>(.*?)<\/loc>/g)).map((m) => m[1]);
      expect(locMatches).toHaveLength(EXPECTED_PUBLIC_ROUTES.length);
      expect(locMatches.sort()).toEqual([...EXPECTED_PUBLIC_ROUTES].sort());

      // Toutes les URLs partagent l'origine canonique
      for (const loc of locMatches) {
        expect(loc.startsWith(CANONICAL_ORIGIN)).toBe(true);
      }

      // Absence de placeholders ou de domaines inventés
      expect(content).not.toContain("<DOMAINE_CANONIQUE>");
      expect(content).not.toMatch(/interimatch-(?!five\.vercel\.app)/i);

      // Absence absolue des routes privées ou protégées
      const forbiddenFragments = [
        "/login",
        "/register",
        "/auth",
        "/worker",
        "/company",
        "/admin",
        "/dashboard",
        "/missions",
        "/candidates",
        "/candidat",
        "/profile",
        "/profil",
        "/france-travail",
      ];
      for (const fragment of forbiddenFragments) {
        expect(content).not.toContain(fragment);
      }
    });
  });
});
