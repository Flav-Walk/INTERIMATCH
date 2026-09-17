import { describe, it, expect } from "vitest";
import {
  isProfileComplete,
  missingRules,
  ruleLabels,
  type CompletionInput,
} from "./completion.js";

const complete: CompletionInput = {
  first_name: "Jimmy",
  last_name: "Martin",
  city: "Lyon",
  postal_code: "69002",
  mobility_radius_km: 15,
  main_job: "serveur",
  skill_count: 2,
  upcoming_availability_count: 1,
};

describe("règles de complétion du profil", () => {
  it("accepte un profil qui satisfait les six règles", () => {
    expect(isProfileComplete(complete)).toBe(true);
    expect(missingRules(complete)).toEqual([]);
  });

  it("n'exige jamais les coordonnées, qui sont dérivées du géocodage", () => {
    // Le champ n'existe même pas dans l'entrée : une panne de géocodage ne peut
    // pas empêcher un profil d'être considéré comme complet.
    expect(Object.keys(complete)).not.toContain("latitude");
    expect(Object.keys(complete)).not.toContain("longitude");
  });

  it("n'exige pas les enrichissements facultatifs", () => {
    // Téléphone, métiers secondaires, expériences, certifications, permis,
    // véhicule et recherche active ne bloquent pas la complétion.
    expect(isProfileComplete(complete)).toBe(true);
  });

  it.each([
    ["identity", { first_name: "  " }],
    ["identity", { last_name: "" }],
    ["location", { city: null }],
    ["location", { postal_code: "6900" }],
    ["location", { postal_code: "ABCDE" }],
    ["mobility_radius", { mobility_radius_km: null }],
    ["main_job", { main_job: null }],
    ["skills", { skill_count: 0 }],
    ["availability", { upcoming_availability_count: 0 }],
  ])("signale « %s » quand la donnée manque", (rule, override) => {
    const input = { ...complete, ...override } as CompletionInput;
    expect(isProfileComplete(input)).toBe(false);
    expect(missingRules(input)).toContain(rule);
  });

  it("accepte un rayon de mobilité nul, qui reste une valeur renseignée", () => {
    expect(isProfileComplete({ ...complete, mobility_radius_km: 0 })).toBe(
      true,
    );
  });

  it("énumère tout ce qui manque sur un profil vierge", () => {
    expect(
      missingRules({
        first_name: "",
        last_name: "",
        city: null,
        postal_code: null,
        mobility_radius_km: null,
        main_job: null,
        skill_count: 0,
        upcoming_availability_count: 0,
      }),
    ).toEqual([
      "identity",
      "location",
      "mobility_radius",
      "main_job",
      "skills",
      "availability",
    ]);
  });

  it("donne un libellé à chaque règle, pour l'afficher sans les redéclarer", () => {
    for (const rule of missingRules({ ...complete, skill_count: 0 }))
      expect(ruleLabels[rule]).toBeTruthy();
  });
});
