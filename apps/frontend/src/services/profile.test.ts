import { describe, it, expect } from "vitest";
import {
  availableFrom,
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
    const text = formatSlot(slot(24));
    expect(text).toMatch(/·/);
    expect(text).toMatch(/\d{2}:\d{2} – \d{2}:\d{2}/);
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
