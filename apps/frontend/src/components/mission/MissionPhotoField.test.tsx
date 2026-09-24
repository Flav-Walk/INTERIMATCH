import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionPhotoField, UnsplashCredit } from "./MissionPhotoField";
import { MissionCard } from "./MissionCard";
import { PublicOfferCard } from "../public-offers/PublicOfferCard";
import { illustrationFor, offerIllustrationFor } from "../../lib/job-photos";
import { MemoryRouter } from "react-router-dom";
import type { Mission, MissionMedia } from "../../services/missions";
import type { PublicJobOffer } from "../../services/publicOffers";

const uploaded: MissionMedia = {
  provider: "upload",
  url: "https://storage.test/missions/c1/photo.jpg",
  storage_path: "missions/c1/photo.jpg",
};

const unsplash: MissionMedia = {
  provider: "unsplash",
  external_id: "abc",
  url: "https://images.unsplash.com/abc?ixid=1&w=1080",
  thumb_url: "https://images.unsplash.com/abc?ixid=1&w=400",
  author_name: "Camille Photographe",
  author_url:
    "https://unsplash.com/@camille?utm_source=interimatch&utm_medium=referral",
  alt: "Salle dressée",
};

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe("champ photo", () => {
  it("propose exactement deux voies, et aucune autre", () => {
    const html = render(<MissionPhotoField value={null} onChange={() => {}} />);
    expect(html).toContain("Importer une photo");
    expect(html).toContain("Choisir dans la bibliothèque");
    expect(html).toContain("Aucune photo pour l’instant.");
  });

  it("limite le champ fichier aux formats réellement acceptés", () => {
    const html = render(<MissionPhotoField value={null} onChange={() => {}} />);
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain('type="file"');
  });

  it("annonce l'erreur au lecteur d'écran", () => {
    const html = render(
      <MissionPhotoField
        value={null}
        onChange={() => {}}
        error="Ajoutez une photo pour publier cette mission."
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Ajoutez une photo pour publier cette mission.");
  });

  it("montre l'aperçu et permet de remplacer la photo", () => {
    const html = render(
      <MissionPhotoField value={uploaded} onChange={() => {}} />,
    );
    expect(html).toContain(uploaded.url);
    expect(html).toContain("Remplacer par un fichier");
    expect(html).toContain("Choisir une autre photo");
  });

  it("crédite le photographe d'une photo Unsplash, pas d'un import", () => {
    const withUnsplash = render(
      <MissionPhotoField value={unsplash} onChange={() => {}} />,
    );
    expect(withUnsplash).toContain("Camille Photographe");
    expect(withUnsplash).toContain("utm_source=interimatch");
    expect(withUnsplash).toContain("utm_medium=referral");
    expect(withUnsplash).toContain("Unsplash");

    const withUpload = render(
      <MissionPhotoField value={uploaded} onChange={() => {}} />,
    );
    expect(withUpload).not.toContain("unsplash.com");
  });
});

describe("crédit Unsplash", () => {
  it("respecte la forme « Photo par <auteur> sur Unsplash »", () => {
    const html = renderToStaticMarkup(<UnsplashCredit media={unsplash} />);
    expect(html).toContain("Photo par");
    expect(html).toContain("sur");
    expect(html).toContain('href="https://unsplash.com/@camille');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("ne crédite rien pour une photo importée", () => {
    expect(renderToStaticMarkup(<UnsplashCredit media={uploaded} />)).toBe("");
  });
});

const mission = (media: MissionMedia | null): Mission => ({
  id: "m1",
  title: "Serveur en salle",
  description: "",
  job: "serveur",
  starts_at: new Date(Date.now() + 86_400_000).toISOString(),
  ends_at: new Date(Date.now() + 90_000_000).toISOString(),
  address: "",
  city: "Lyon",
  postal_code: "69002",
  latitude: null,
  longitude: null,
  pay_amount: null,
  pay_unit: null,
  headcount: 1,
  min_years_experience: null,
  status: "open",
  published_at: new Date().toISOString(),
  demo: false,
  media,
  skills: [],
});

describe("carte mission", () => {
  it("affiche la photo réellement associée à la mission", () => {
    const html = render(<MissionCard mission={mission(uploaded)} />);
    expect(html).toContain(uploaded.url);
  });

  /** Une mission héritée sans photo conserve le visuel de marque. */
  it("ne fabrique aucune image pour une mission qui n'en a pas", () => {
    const html = render(<MissionCard mission={mission(null)} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("images.unsplash.com");
  });

  it("n'ajoute pas la mention « Illustration » à la vraie photo d'une mission", () => {
    const html = render(<MissionCard mission={mission(uploaded)} />);
    expect(html).not.toContain("Illustration");
  });
});

const offer: PublicJobOffer = {
  id: "o1",
  source: "france_travail",
  external_id: "FT-1",
  title: "Serveur de restaurant",
  company_name: "Restaurant du Parc",
  city: "Lyon",
  postal_code: "69002",
  contract_type: "CDD",
  contract_label: "CDD",
  rome_code: "G1803",
  rome_label: "Service en restauration",
  description: "Service du soir.",
  source_url: "https://candidat.francetravail.fr/offres/FT-1",
  skills: [],
  professional_qualities: [],
  salary_label: null,
  experience_label: null,
  working_time: null,
  positions: 1,
  latitude: null,
  longitude: null,
  created_at_source: null,
  updated_at_source: null,
  imported_at: new Date().toISOString(),
};

describe("carte France Travail", () => {
  // Règle initiale (commit 0bf62c3) : aucune image, car une photo générique
  // pouvait passer pour celle de l'établissement. Règle actuelle : une seule
  // image, une photo d'OBJETS du métier (bibliothèque des offres), jamais une
  // photo de lieu ou de personne des missions, décorative, sans mention
  // « Illustration » sur la carte.
  it("n'affiche qu'une photo d'objets du métier, sans mention « Illustration »", () => {
    const html = render(<PublicOfferCard offer={offer} />);
    const expected = offerIllustrationFor(offer.title, offer.id);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain(`photo-${expected.external_id}`);
    expect(html).toContain('alt=""');
    expect(html).not.toContain("photo-illustration-tag");
    // Jamais une image locale (qui pourrait être celle d'un établissement).
    expect(html).not.toContain("/images/");
  });

  it("n'utilise pas les photos de salles ou de personnes des missions", () => {
    for (let i = 0; i < 40; i++) {
      const html = render(
        <PublicOfferCard offer={{ ...offer, id: `ft-${i}` }} />,
      );
      const mission = illustrationFor(offer.title, `ft-${i}`);
      expect(html).not.toContain(`photo-${mission.external_id}`);
    }
  });

  it("conserve tout ce qui identifie l'offre externe", () => {
    const html = render(<PublicOfferCard offer={offer} />);
    expect(html).toContain("France Travail");
    expect(html).toContain("Serveur de restaurant");
    expect(html).toContain("Restaurant du Parc");
    expect(html).toContain("Lyon");
    expect(html).toContain("CDD");
  });

  it("ne porte aucun score de compatibilité InteriMatch", () => {
    const html = render(<PublicOfferCard offer={offer} />);
    expect(html).not.toContain("Compatible à");
    expect(html).not.toMatch(/match-badge/);
  });
});
