import { describe, it, expect } from "vitest";
import type { CompletionRule } from "./session";
import {
  coverageByDay,
  availableFrom,
  humaniseError,
  missingIn,
  requirementSections,
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
      "photo",
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

/**
 * Chaque exigence de completion doit designer une section reelle du profil,
 * sinon la mention « A completer » n apparait nulle part et l utilisateur
 * cherche dans six blocs ce qui lui manque.
 */
describe("sections du profil", () => {
  it("rattache chaque exigence a une section", () => {
    for (const rule of Object.keys(requirementLabels) as CompletionRule[])
      expect(requirementSections[rule]).toBeTruthy();
  });

  it("ne renvoie que les exigences de la section demandee", () => {
    const missing: CompletionRule[] = ["identity", "skills", "mobility_radius"];
    expect(missingIn(missing, "Votre identité")).toEqual(["identity"]);
    expect(missingIn(missing, "Vos compétences")).toEqual(["skills"]);
    expect(missingIn(missing, "Votre mobilité")).toEqual(["mobility_radius"]);
    expect(missingIn(missing, "Votre métier")).toEqual([]);
  });

  it("supporte un profil complet ou inconnu", () => {
    expect(missingIn([], "Votre identité")).toEqual([]);
    expect(missingIn(undefined, "Votre identité")).toEqual([]);
  });
});

describe("couverture du calendrier de disponibilités", () => {
  const slot = (
    starts_at: string,
    ends_at: string,
    status: "available" | "unavailable" = "available",
  ) => ({ id: crypto.randomUUID(), starts_at, ends_at, status });

  it("ne peint aucun jour sans créneau", () => {
    expect(coverageByDay(undefined, 2027, 0).size).toBe(0);
    expect(coverageByDay([], 2027, 0).size).toBe(0);
  });

  it("peint tous les jours civils qu'un intervalle traverse", () => {
    // Un créneau InteriMatch n'est pas une case : celui-ci couvre trois jours.
    const days = coverageByDay(
      [slot("2027-03-10T08:00", "2027-03-12T18:00")],
      2027,
      2,
    );
    expect([...days.keys()].sort((a, b) => a - b)).toEqual([10, 11, 12]);
  });

  it("exclut la borne de fin quand elle tombe à minuit pile", () => {
    // Un créneau qui s'arrête à minuit n'engage personne le jour suivant.
    const days = coverageByDay(
      [slot("2027-03-10T20:00", "2027-03-11T00:00")],
      2027,
      2,
    );
    expect([...days.keys()]).toEqual([10]);
  });

  it("ignore un intervalle situé hors du mois affiché", () => {
    expect(
      coverageByDay([slot("2027-01-05T08:00", "2027-01-06T08:00")], 2027, 2)
        .size,
    ).toBe(0);
  });

  it("distingue disponible, indisponible et les deux", () => {
    const days = coverageByDay(
      [
        slot("2027-03-10T08:00", "2027-03-10T12:00", "available"),
        slot("2027-03-10T14:00", "2027-03-10T18:00", "unavailable"),
        slot("2027-03-11T08:00", "2027-03-11T12:00", "unavailable"),
        slot("2027-03-12T08:00", "2027-03-12T12:00", "available"),
      ],
      2027,
      2,
    );
    // Le jour contradictoire est signalé comme tel, jamais arbitré.
    expect(days.get(10)).toBe("mixed");
    expect(days.get(11)).toBe("unavailable");
    expect(days.get(12)).toBe("available");
  });

  it("ne peint que la portion du mois affichée pour un long créneau", () => {
    const days = coverageByDay(
      [slot("2027-02-25T08:00", "2027-04-03T08:00")],
      2027,
      2,
    );
    // Mars entier, et rien d'autre.
    expect(days.size).toBe(31);
    expect(days.get(1)).toBe("available");
    expect(days.get(31)).toBe("available");
  });
});
