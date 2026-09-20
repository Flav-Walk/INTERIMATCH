import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  rejectionReason,
  unsplashUnavailable,
  UNSPLASH_HOME,
} from "./missionMedia";
import { ApiError } from "./api";
import { mediaInput, missionDiff, type MissionInput } from "./missions";

const file = (type: string, size: number, name = "photo.jpg") =>
  new File([new Uint8Array(size)], name, { type });

describe("contrôles avant envoi", () => {
  it("accepte les trois formats annoncés au champ fichier", () => {
    for (const type of ACCEPTED_IMAGE_TYPES)
      expect(rejectionReason(file(type, 1024))).toBeNull();
    // Le champ ne propose jamais autre chose que ce que le service accepte.
    expect(ACCEPT_ATTRIBUTE.split(",")).toEqual([...ACCEPTED_IMAGE_TYPES]);
  });

  it("refuse un format non pris en charge", () => {
    expect(rejectionReason(file("image/gif", 1024, "a.gif"))).toBe(
      "Formats acceptés : JPEG, PNG ou WebP.",
    );
    expect(rejectionReason(file("application/pdf", 1024, "a.pdf"))).toBe(
      "Formats acceptés : JPEG, PNG ou WebP.",
    );
  });

  it("refuse un fichier trop lourd ou vide", () => {
    expect(rejectionReason(file("image/jpeg", MAX_IMAGE_BYTES + 1))).toBe(
      "L’image ne doit pas dépasser 5 Mo.",
    );
    expect(rejectionReason(file("image/jpeg", 0))).toBe("Ce fichier est vide.");
  });

  it("laisse passer exactement la taille maximale", () => {
    expect(rejectionReason(file("image/jpeg", MAX_IMAGE_BYTES))).toBeNull();
  });
});

describe("panne de la bibliothèque", () => {
  it("reconnaît les trois refus qui laissent l'import disponible", () => {
    for (const code of [
      "UNSPLASH_NOT_CONFIGURED",
      "UNSPLASH_UNAVAILABLE",
      "UNSPLASH_RATE_LIMITED",
    ])
      expect(unsplashUnavailable(new ApiError("…", 503, code))).toBe(true);
  });

  it("ne confond pas une panne de bibliothèque avec une autre erreur", () => {
    expect(unsplashUnavailable(new ApiError("…", 500, "INTERNAL_ERROR"))).toBe(
      false,
    );
    expect(unsplashUnavailable(new Error("réseau"))).toBe(false);
  });
});

describe("attribution Unsplash", () => {
  it("renvoie vers Unsplash avec les paramètres de référencement exigés", () => {
    expect(UNSPLASH_HOME).toContain("utm_source=interimatch");
    expect(UNSPLASH_HOME).toContain("utm_medium=referral");
  });
});

describe("désignation envoyée au serveur", () => {
  it("ne transporte pas l'URL d'une photo importée", () => {
    const sent = mediaInput({
      provider: "upload",
      url: "https://storage.test/missions/c1/photo.jpg",
      storage_path: "missions/c1/photo.jpg",
    });
    expect(sent).toEqual({
      provider: "upload",
      storage_path: "missions/c1/photo.jpg",
    });
    expect(JSON.stringify(sent)).not.toContain("https://");
  });

  it("ne transporte qu'un identifiant pour une photo Unsplash", () => {
    const sent = mediaInput({
      provider: "unsplash",
      external_id: "abc",
      url: "https://images.unsplash.com/abc?ixid=1",
      thumb_url: "https://images.unsplash.com/abc?ixid=1&w=400",
      author_name: "Camille",
      author_url: "https://unsplash.com/@camille?utm_source=interimatch",
    });
    expect(sent).toEqual({ provider: "unsplash", external_id: "abc" });
  });

  it("traduit l'absence de photo", () => {
    expect(mediaInput(null)).toBeNull();
  });
});

describe("écart envoyé à la modification", () => {
  const base = (): MissionInput => ({
    title: "Serveur",
    description: "",
    job: "serveur",
    starts_at: "2027-03-14T18:00:00.000Z",
    ends_at: "2027-03-15T02:00:00.000Z",
    address: "",
    city: "Lyon",
    postal_code: "69002",
    pay_amount: null,
    pay_unit: null,
    headcount: 1,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    media: { provider: "upload", storage_path: "missions/c1/photo.jpg" },
  });

  /**
   * Le point sensible : renvoyer la photo à chaque enregistrement ferait
   * redéclarer l'usage d'une photo Unsplash à chaque modification de titre, ce
   * que leurs conditions demandent de faire une seule fois, à la sélection.
   */
  it("ne renvoie pas une photo inchangée quand le titre seul change", () => {
    const patch = missionDiff(base(), { ...base(), title: "Chef de rang" });
    expect(patch).toEqual({ title: "Chef de rang" });
    expect(patch.media).toBeUndefined();
  });

  it("ne renvoie pas une photo Unsplash inchangée", () => {
    const before = {
      ...base(),
      media: { provider: "unsplash" as const, external_id: "abc" },
    };
    const after = {
      ...base(),
      media: { provider: "unsplash" as const, external_id: "abc" },
      headcount: 3,
    };
    expect(missionDiff(before, after)).toEqual({ headcount: 3 });
  });

  it("renvoie la photo quand elle change vraiment", () => {
    const after = {
      ...base(),
      media: { provider: "unsplash" as const, external_id: "def" },
    };
    expect(missionDiff(base(), after)).toEqual({
      media: { provider: "unsplash", external_id: "def" },
    });
  });

  it("renvoie la photo quand on passe d'un import à un autre", () => {
    const after = {
      ...base(),
      media: {
        provider: "upload" as const,
        storage_path: "missions/c1/autre.jpg",
      },
    };
    expect(missionDiff(base(), after).media).toEqual({
      provider: "upload",
      storage_path: "missions/c1/autre.jpg",
    });
  });

  it("renvoie le retrait d'une photo", () => {
    expect(missionDiff(base(), { ...base(), media: null })).toEqual({
      media: null,
    });
  });
});
