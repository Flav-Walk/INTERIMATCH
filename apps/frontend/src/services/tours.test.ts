import { describe, it, expect } from "vitest";
import { CURRENT_TOUR_VERSION, shouldRunTour, tourFor } from "./tours";

describe("guided tour versioning", () => {
  it("runs for an account that has never completed it", () => {
    expect(shouldRunTour(0)).toBe(true);
  });
  it("stops once the current version is completed", () => {
    expect(shouldRunTour(CURRENT_TOUR_VERSION)).toBe(false);
  });
  it("runs again for an existing account when a newer tour ships", () => {
    // The whole point of the version: raising the constant re-runs the tour
    // for accounts that only completed an older one.
    expect(shouldRunTour(CURRENT_TOUR_VERSION - 1)).toBe(true);
  });
  it("does not re-run for an account ahead of the current version", () => {
    expect(shouldRunTour(CURRENT_TOUR_VERSION + 1)).toBe(false);
  });
});

describe("tour content", () => {
  it("gives each role its own tour", () => {
    expect(tourFor("worker")).not.toEqual(tourFor("company"));
  });
  it("opens with a welcome step that needs no target", () => {
    for (const role of ["worker", "company"] as const)
      expect(tourFor(role)[0].target).toBeUndefined();
  });
  it("targets only anchors the interface actually renders", () => {
    // Keep in sync with the data-tour attributes in AppLayout and Dashboard.
    const rendered = new Set([
      "nav",
      "account",
      "profile-status",
      "missions",
      "availability",
      "candidates",
    ]);
    for (const role of ["worker", "company"] as const)
      for (const step of tourFor(role))
        if (step.target) expect(rendered.has(step.target)).toBe(true);
  });
  it("never ships an empty step", () => {
    for (const role of ["worker", "company"] as const)
      for (const step of tourFor(role)) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
  });
});
