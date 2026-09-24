import { describe, expect, it } from "vitest";
import {
  WORKER_REQUIREMENT_COUNT,
  workerRequirementProgress,
} from "./completion";
import { requirementLabels } from "./profile";

describe("WORKER_REQUIREMENT_COUNT", () => {
  /**
   * Le dénominateur de la jauge ne doit pas pouvoir diverger du serveur.
   * `profile.test.ts` verrouille déjà la liste des règles ; ce test verrouille
   * le fait que le compte en découle plutôt que d'être recopié.
   */
  it("se déduit des règles servies, sans constante recopiée", () => {
    expect(WORKER_REQUIREMENT_COUNT).toBe(
      Object.keys(requirementLabels).length,
    );
    // Sept depuis la migration 012, qui ajoute la photo de profil.
    expect(WORKER_REQUIREMENT_COUNT).toBe(7);
  });
});

describe("workerRequirementProgress", () => {
  it("n'invente pas de complétion si le backend ne fournit pas ses exigences", () => {
    expect(workerRequirementProgress(undefined)).toBeNull();
  });

  it("reflète un profil vide et un profil partiellement renseigné", () => {
    expect(
      workerRequirementProgress([
        "identity",
        "photo",
        "location",
        "mobility_radius",
        "main_job",
        "skills",
        "availability",
      ]),
    ).toBe(0);
    expect(workerRequirementProgress(["skills", "availability"])).toBe(71);
  });

  it("reflète un profil satisfaisant toutes les exigences backend", () => {
    expect(workerRequirementProgress([])).toBe(100);
  });

  it("ne compte pas deux fois une exigence répétée", () => {
    expect(workerRequirementProgress(["availability", "availability"])).toBe(
      86,
    );
  });
});
