import { describe, expect, it } from "vitest";
import { readConfig } from "./config.js";

describe("configuration n8n", () => {
  it("accepte les deux variables ensemble", () => {
    const config = readConfig({
      NODE_ENV: "test",
      N8N_WEBHOOK_URL: "https://n8n.test/webhook/interimatch/events",
      N8N_WEBHOOK_SECRET: "test-only-secret",
    });
    expect(config.N8N_WEBHOOK_URL).toContain("/interimatch/events");
  });

  it.each([
    { N8N_WEBHOOK_URL: "https://n8n.test/webhook/interimatch/events" },
    { N8N_WEBHOOK_SECRET: "test-only-secret" },
  ])("refuse une configuration partielle", (partial) => {
    expect(() => readConfig({ NODE_ENV: "test", ...partial })).toThrow(
      /N8N_WEBHOOK_URL.*N8N_WEBHOOK_SECRET/,
    );
  });
});
