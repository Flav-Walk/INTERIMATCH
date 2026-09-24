import { describe, expect, it } from "vitest";
import { illustrationFor, jobFamily, offerIllustrationFor } from "./job-photos";

describe("photos de couverture des offres France Travail", () => {
  it("donne toujours la même photo pour une même offre", () => {
    const first = offerIllustrationFor("Barman (H/F)", "ft-123");
    const again = offerIllustrationFor("Barman (H/F)", "ft-123");
    expect(again.url).toBe(first.url);
  });

  it("choisit la famille d'après l'intitulé", () => {
    expect(jobFamily("Commis de cuisine (H/F)")).toBe("cuisine");
    expect(jobFamily("Chef de rang")).toBe("salle");
    expect(jobFamily("Réceptionniste de nuit")).toBe("reception");
    expect(jobFamily("Barman / Barmaid")).toBe("bar");
  });

  it("n'utilise jamais les photos de lieux ou de personnes des missions", () => {
    // Les photos des missions montrent des salles et des gens : elles ne
    // doivent pas servir aux offres France Travail (établissements réels).
    const titles = ["Serveur", "Cuisinier", "Barman", "Réceptionniste"];
    const missionPhotos = new Set<string>();
    const offerPhotos = new Set<string>();
    for (const title of titles)
      for (let i = 0; i < 60; i++) {
        missionPhotos.add(illustrationFor(title, `s${i}`).external_id);
        offerPhotos.add(offerIllustrationFor(title, `s${i}`).external_id);
      }
    // Seule exception tolérée : la cloche de service, un simple objet.
    const shared = [...offerPhotos].filter((id) => missionPhotos.has(id));
    expect(shared).toEqual(["1758708536313-e7055ddba277"]);
  });

  it("crédite le photographe avec les paramètres demandés par Unsplash", () => {
    const media = offerIllustrationFor("Plongeur", "ft-9");
    expect(media.provider).toBe("unsplash");
    expect(media.author_url).toContain("utm_source=interimatch");
    expect(media.author_name).not.toBe("");
  });
});
