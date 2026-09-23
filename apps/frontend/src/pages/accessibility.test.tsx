import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { Login } from "./Login";
import { ProfileForm } from "./ProfileForm";
import { Accessibilite } from "./Accessibilite";
import { PolitiqueConfidentialite } from "./PolitiqueConfidentialite";
import { GuidedTour } from "../components/GuidedTour";
import { MissionCard } from "../components/mission/MissionCard";
import { PublicOfferCard } from "../components/public-offers/PublicOfferCard";

// Mock useAuth pour isoler les composants de test
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "test-user",
      email: "test@example.com",
      first_name: "Jean",
      last_name: "Dupont",
      role: "worker",
      onboarding_completed: true,
      profile: {
        establishment_name: "Le Bistrot",
        sector: "restaurant",
        address: "1 rue de la Paix",
        phone: "0102030405",
        city: "Lyon",
        postal_code: "69002",
      },
    },
    loading: false,
    loadError: false,
    reload: vi.fn(),
    login: vi.fn(),
    google: vi.fn(),
    logout: vi.fn(),
    invalidate: vi.fn(),
    revision: 1,
  }),
}));

vi.mock("../hooks/CompanyData", () => ({
  useCompanyData: () => ({
    counts: { pending: 2, accepted: 1, rejected: 0, total: 3 },
    applications: [],
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
  CompanyDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Accessibilité RGAA / WCAG (Sous-lot 8C)", () => {
  describe("1. Repères et lien d'évitement (Landmarks & Skip Link)", () => {
    it("comporte un lien d'évitement pointant vers #content", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>,
      );
      expect(html).toContain('class="skip-link"');
      expect(html).toContain('href="#content"');
      expect(html).toContain("Aller au contenu");
    });

    it("comporte une cible <main id='content'> accessible avec tabIndex={-1}", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>,
      );
      expect(html).toContain('id="content"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain('class="app-main"');
    });

    it("porte des attributs aria-label distincts sur les balises <nav>", () => {
      // Le menu principal n'existe que dans l'espace connecté : l'accueil
      // (« / ») garde volontairement l'en-tête public. On vérifie donc les
      // repères sur une page de l'espace intérimaire.
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={["/worker"]}>
          <AppLayout />
        </MemoryRouter>,
      );
      expect(html).toContain('aria-label="Navigation principale"');
      expect(html).toContain('aria-label="Informations légales"');
    });
  });

  describe("2. Association explicite label/input dans les formulaires (RGAA 11.1)", () => {
    it("associe explicitement le champ email de connexion via id et htmlFor", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Login register={false} />
        </MemoryRouter>,
      );
      expect(html).toContain('for="login-email"');
      expect(html).toContain('id="login-email"');
    });

    it("associe explicitement les champs du profil entreprise via id et htmlFor", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <ProfileForm />
        </MemoryRouter>,
      );
      expect(html).toContain('for="first_name"');
      expect(html).toContain('id="first_name"');
      expect(html).toContain('for="company-sector"');
      expect(html).toContain('id="company-sector"');
      expect(html).toContain('for="company-description"');
      expect(html).toContain('id="company-description"');
    });
  });

  describe("3. Avertissement sur les liens ouvrant une nouvelle fenêtre (RGAA 13.1)", () => {
    it("indique la mention '(nouvelle fenêtre)' sur les liens externes de la déclaration d'accessibilité", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Accessibilite />
        </MemoryRouter>,
      );
      expect(html).toContain('target="_blank"');
      expect(html).toContain('(nouvelle fenêtre)');
    });

    it("indique la mention '(nouvelle fenêtre)' sur le lien CNIL de la politique de confidentialité", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <PolitiqueConfidentialite />
        </MemoryRouter>,
      );
      expect(html).toContain('href="https://www.cnil.fr"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('(nouvelle fenêtre)');
    });
  });

  describe("4. Structure de la déclaration d'accessibilité", () => {
    it("conserve strictement le statut 'Accessibilité : non conforme'", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Accessibilite />
        </MemoryRouter>,
      );
      expect(html).toContain("Accessibilité : non conforme");
    });

    it("distingue les améliorations techniques, vérifications manuelles et limites", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Accessibilite />
        </MemoryRouter>,
      );
      expect(html).toContain("Améliorations techniques réalisées");
      expect(html).toContain("Vérifications manuelles restant à effectuer");
      expect(html).toContain("Limites connues");
    });
  });

  describe("5. Composants modales et visite guidée", () => {
    it("définit les attributs dialog et aria-modal sur GuidedTour", () => {
      const html = renderToStaticMarkup(
        <GuidedTour
          steps={[{ title: "Étape 1", body: "Description 1" }]}
          onClose={vi.fn()}
          label="Visite guidée de test"
        />,
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Visite guidée de test"');
    });
  });

  describe("6. Cartes et éléments de liste", () => {
    it("rend la carte mission avec un titre de niveau H3", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <MissionCard
            mission={
              {
                id: "m1",
                title: "Chef de partie",
                job: "cuisinier",
                city: "Lyon",
                starts_at: "2026-10-12T18:00:00Z",
                ends_at: "2026-10-13T02:00:00Z",
                status: "open",
                headcount: 1,
                pay_amount: "15",
                pay_unit: "hour",
              } as unknown as import("../services/missions").Mission
            }
          />
        </MemoryRouter>,
      );
      expect(html).toContain('<h3 class="mission-title">Chef de partie</h3>');
    });

    it("rend la carte d'offre publique avec un titre H2", () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <PublicOfferCard
            offer={
              {
                id: "po1",
                external_id: "FT-12345",
                title: "Chef de rang",
                source_url: "https://example.com",
                contract_label: "CDD",
                city: "Lyon",
                skills: [],
              } as unknown as import("../services/publicOffers").PublicJobOffer
            }
          />
        </MemoryRouter>,
      );
      expect(html).toContain("<h2");
      expect(html).toContain("Chef de rang");
    });
  });
});
