import { describe, it, expect } from "vitest";
import { matchingConfig } from "./config.js";
// Locks docs/DECISIONS.md D04: the weights and thresholds are a documented decision,
// not an implementation detail the scoring engine may silently change at Lot 4.
describe("matching configuration", () => {
  it("keeps the decided weights", () => {
    expect(matchingConfig.weights).toEqual({
      skills: 45,
      location: 25,
      experience: 20,
      complementary: 10,
    });
  });
  it("totals one hundred points", () => {
    expect(
      Object.values(matchingConfig.weights).reduce((a, b) => a + b, 0),
    ).toBe(100);
  });
  it("keeps the fallback thresholds ordered from strictest to loosest", () => {
    expect(matchingConfig.thresholds).toEqual([70, 60, 50]);
    expect([...matchingConfig.thresholds].sort((a, b) => b - a)).toEqual([
      ...matchingConfig.thresholds,
    ]);
  });
  it("is versioned and frozen so every score can cite its configuration", () => {
    expect(matchingConfig.version).toBe("1.0");
    expect(Object.isFrozen(matchingConfig)).toBe(true);
    expect(Object.isFrozen(matchingConfig.weights)).toBe(true);
  });
});
