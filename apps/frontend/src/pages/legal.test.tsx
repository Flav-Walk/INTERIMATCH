import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MentionsLegales } from "./MentionsLegales";
import { PolitiqueConfidentialite } from "./PolitiqueConfidentialite";
import { Accessibilite } from "./Accessibilite";
import { AppLayout } from "../layouts/AppLayout";
import { Login } from "./Login";

// Mock useAuth pour les rendus AppLayout et Login sans contexte lourd
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    loadError: false,
    reload: vi.fn(),
    login: vi.fn(),
    google: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("Pages légales (Sous-lot 8A)", () => {
  describe("Rendu individuel des pages", () => {
    it("rend la page Mentions Légales avec un H1 pertinent", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <MentionsLegales />
        </MemoryRouter>,
      );
      expect(html).toContain("<h1");
      expect(html).toContain("Mentions légales</h1>");
      expect(html).toContain("[Information à compléter]");
    });

    it("rend la page Politique de Confidentialité avec un H1 pertinent et les mentions requises", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <PolitiqueConfidentialite />
        </MemoryRouter>,
      );
      expect(html).toContain("<h1");
      expect(html).toContain("Politique de confidentialité</h1>");
      expect(html).toContain("[Responsable du traitement à compléter]");
      expect(html).toContain("im_refresh");
      expect(html).toContain(
        "ne dispose pas à ce stade d’une interface d’export automatisé",
      );
    });

    it("rend la page Accessibilité avec la qualification prudente requise sans score fabriqué", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Accessibilite />
        </MemoryRouter>,
      );
      expect(html).toContain("<h1");
      expect(html).toContain("Déclaration d’accessibilité</h1>");
      expect(html).toContain("Accessibilité : non conforme");
      expect(html).toContain("Défenseur des droits");
    });
  });

  describe("Intégration dans le footer (AppLayout)", () => {
    it("affiche les liens légaux avec les destinations exactes", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>,
      );
      expect(html).toContain('href="/mentions-legales"');
      expect(html).toContain("Mentions légales");
      expect(html).toContain('href="/politique-confidentialite"');
      expect(html).toContain("Politique de confidentialité");
      expect(html).toContain('href="/accessibilite"');
      expect(html).toContain("Accessibilité : non conforme");
    });
  });

  describe("Routing public sans authentification et sans crash", () => {
    const renderRoute = (path: string) =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="mentions-legales" element={<MentionsLegales />} />
              <Route
                path="politique-confidentialite"
                element={<PolitiqueConfidentialite />}
              />
              <Route path="accessibilite" element={<Accessibilite />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

    it("permet l'accès public à /mentions-legales sans crash", () => {
      const html = renderRoute("/mentions-legales");
      expect(html).toContain("Mentions légales</h1>");
    });

    it("permet l'accès public à /politique-confidentialite sans crash", () => {
      const html = renderRoute("/politique-confidentialite");
      expect(html).toContain("Politique de confidentialité</h1>");
    });

    it("permet l'accès public à /accessibilite sans crash", () => {
      const html = renderRoute("/accessibilite");
      expect(html).toContain("Déclaration d’accessibilité</h1>");
    });
  });

  describe("Information légale sur l'inscription", () => {
    it("affiche l'information légale avec liens vers politique et mentions à l'inscription", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Login register={true} />
        </MemoryRouter>,
      );
      expect(html).toContain('href="/politique-confidentialite"');
      expect(html).toContain('href="/mentions-legales"');
      expect(html).toContain("Politique de confidentialité");
      expect(html).toContain("Mentions légales");
    });

    it("n'affiche pas cette mention légale sur le formulaire de simple connexion", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Login register={false} />
        </MemoryRouter>,
      );
      expect(html).not.toContain("legal-notice");
    });
  });
});
