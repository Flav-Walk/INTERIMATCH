// Foundation only; the scoring engine is scheduled for Lot 4.
export const matchingConfig = Object.freeze({
  version: "1.0",
  weights: Object.freeze({
    skills: 45,
    location: 25,
    experience: 20,
    complementary: 10,
  }),
  thresholds: Object.freeze([70, 60, 50]),
});
