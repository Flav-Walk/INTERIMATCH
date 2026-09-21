import { describe, expect, it } from "vitest";
import { readConfig } from "./config.js";

describe("configuration contrats", () => {
  it("reste désactivée sans identifiants Brevo", () => {
    expect(readConfig({ NODE_ENV: "test" }).BREVO_API_KEY).toBeUndefined();
  });

  it("exige le triplet Brevo complet et une adresse expéditeur valide", () => {
    expect(() =>
      readConfig({ NODE_ENV: "test", BREVO_API_KEY: "placeholder" }),
    ).toThrow("doivent être définis ensemble");
    expect(() =>
      readConfig({
        NODE_ENV: "test",
        BREVO_API_KEY: "placeholder",
        BREVO_SENDER_EMAIL: "invalide",
        BREVO_SENDER_NAME: "InteriMatch",
      }),
    ).toThrow("BREVO_SENDER_EMAIL");
    expect(
      readConfig({
        NODE_ENV: "test",
        BREVO_API_KEY: "placeholder",
        BREVO_SENDER_EMAIL: "sender@example.test",
        BREVO_SENDER_NAME: "InteriMatch",
      }).BREVO_SENDER_NAME,
    ).toBe("InteriMatch");
  });
});
