import { describe, it, expect } from "vitest";
import {
  availableFrom,
  humaniseError,
  partial,
  formatSlot,
  isUpcoming,
  requirementLabels,
  toLocalInput,
  upcomingAvailabilities,
} from "./profile";
import type { Availability } from "./session";

const slot = (
  offsetHours: number,
  durationHours = 6,
  status: Availability["status"] = "available",
): Availability => {
  const start = new Date(Date.now() + offsetHours * 3600_000);
  return {
    id: `slot-${offsetHours}`,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + durationHours * 3600_000).toISOString(),
    status,
  };
};

/**
 * Créneau à dates fixes, pour les assertions de rendu : un créneau construit à
 * partir de l'heure courante franchirait minuit selon le moment de la journée où
 * la suite est lancée, et le rendu changerait avec elle. Les dates sont données
 * en heure locale, celle qu'affiche `formatSlot`, donc le résultat attendu ne
 * dépend pas non plus du fuseau de la machine.
 */
const fixedSlot = (
  [y, m, d, h]: number[],
  [ey, em, ed, eh]: number[],
): Availability => ({
  id: "slot-fixe",
  starts_at: new Date(y, m, d, h).toISOString(),
  ends_at: new Date(ey, em, ed, eh).toISOString(),
  status: "available",
});

describe("créneaux de disponibilité", () => {
  it("ne retient que les créneaux disponibles à venir", () => {
    const slots = [
      slot(48),
      slot(-72), // passé
      slot(24, 6, "unavailable"), // indisponibilité déclarée
      slot(24),
    ];
    expect(upcomingAvailabilities(slots).map((s) => s.id)).toEqual([
      "slot-24",
      "slot-48",
    ]);
  });

  it("considère comme à venir un créneau commencé mais pas terminé", () => {
    expect(isUpcoming(slot(-1, 6))).toBe(true);
    expect(isUpcoming(slot(-12, 6))).toBe(false);
  });

  it("supporte une liste absente", () => {
    expect(upcomingAvailabilities(undefined)).toEqual([]);
    expect(availableFrom(undefined)).toBeNull();
  });

  it("déduit la date de disponibilité du premier créneau, sans la stocker", () => {
    // Une seule source décrit le « quand » : les créneaux.
    const next = slot(48);
    expect(availableFrom([slot(120), next])).toBe(next.starts_at);
  });

  it("annonce une disponibilité immédiate quand un créneau est en cours", () => {
    expect(availableFrom([slot(-1, 6)])).toBe("immediate");
  });

  it("formate un créneau de façon lisible", () => {
    expect(formatSlot(fixedSlot([2027, 0, 12, 16], [2027, 0, 12, 22]))).toBe(
      "mar. 12 janv. · 16:00 – 22:00",
    );
  });

  it("répète la date de fin quand le créneau franchit minuit", () => {
    // Un service de soirée se termine le lendemain. Sans la date de fin,
    // « 18:00 – 02:00 » laisserait croire à un créneau clos le même jour.
    expect(formatSlot(fixedSlot([2027, 0, 12, 18], [2027, 0, 13, 2]))).toBe(
      "mar. 12 janv. · 18:00 – mer. 13 janv. · 02:00",
    );
  });
});

describe("saisie et libellés", () => {
  it("convertit une date ISO en valeur d'input local", () => {
    expect(toLocalInput("2027-01-02T12:00:00Z")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput(undefined)).toBe("");
  });

  it("donne un libellé à chaque règle de complétion du serveur", () => {
    // Les clés doivent rester alignées sur completion.ts côté backend.
    expect(Object.keys(requirementLabels).sort()).toEqual([
      "availability",
      "identity",
      "location",
      "main_job",
      "mobility_radius",
      "skills",
    ]);
    for (const label of Object.values(requirementLabels))
      expect(label.length).toBeGreaterThan(0);
  });
});

describe("modification partielle", () => {
  it("retire les champs vides pour ne pas écraser l'existant", () => {
    // C'est ce qui permet de ne modifier que les métiers secondaires sans
    // devoir avoir déjà choisi son métier principal.
    expect(partial({ main_job: "", secondary_jobs: ["barman"] })).toEqual({
      secondary_jobs: ["barman"],
    });
    expect(partial({ city: "   ", postal_code: "69002" })).toEqual({
      postal_code: "69002",
    });
  });

  it("conserve null, qui est un effacement volontaire", () => {
    expect(partial({ phone: null, years_experience: null })).toEqual({
      phone: null,
      years_experience: null,
    });
  });

  it("conserve les booléens, y compris false", () => {
    expect(partial({ has_driving_licence: false, has_vehicle: false })).toEqual(
      {
        has_driving_licence: false,
        has_vehicle: false,
      },
    );
  });

  it("conserve le zéro, qui est une valeur renseignée", () => {
    expect(partial({ mobility_radius_km: 0 })).toEqual({
      mobility_radius_km: 0,
    });
  });

  it("retire un nombre non calculable plutôt que d'envoyer NaN", () => {
    expect(partial({ years_experience: Number("abc") })).toEqual({});
  });

  it("retire les champs absents", () => {
    expect(partial({ city: undefined })).toEqual({});
  });
});

describe("messages d'erreur", () => {
  it("remplace un nom de champ d'API par son libellé à l'écran", () => {
    expect(humaniseError("Donnée invalide : postal_code.")).toBe(
      "Vérifiez le champ « Code postal ».",
    );
  });

  it("énumère plusieurs champs", () => {
    expect(humaniseError("Donnée invalide : city, postal_code.")).toBe(
      "Vérifiez ces champs : Ville, Code postal.",
    );
  });

  it("garde un nom inconnu plutôt que de l'effacer", () => {
    expect(humaniseError("Donnée invalide : inconnu.")).toContain("inconnu");
  });

  it("laisse intact un message déjà lisible", () => {
    const message = "Un véhicule nécessite le permis.";
    expect(humaniseError(message)).toBe(message);
  });
});
