import { describe, it, expect, vi, afterEach } from "vitest";
import { createGoogleBridge } from "./google.js";
import { readConfig } from "../config.js";

const configured = {
  NODE_ENV: "test",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SECRET_KEY: "test-only-secret",
};
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "person@example.test",
  email_confirmed_at: "2027-01-02T12:00:00Z",
  identities: [{ provider: "google" }],
};

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe("Google identity bridge", () => {
  it("is absent when Supabase is not configured", () => {
    // Sans pont, /auth/google répond 503 GOOGLE_UNAVAILABLE au lieu d'une 500 opaque.
    expect(
      createGoogleBridge(readConfig({ NODE_ENV: "test" })),
    ).toBeUndefined();
    expect(
      createGoogleBridge(
        readConfig({ NODE_ENV: "test", SUPABASE_URL: "https://p.supabase.co" }),
      ),
    ).toBeUndefined();
  });

  it("is built once when Supabase is configured", () => {
    expect(createGoogleBridge(readConfig(configured))).toBeTypeOf("function");
  });

  it("accepts a confirmed Google identity", async () => {
    const bridge = createGoogleBridge(readConfig(configured))!;
    respond(user);
    await expect(bridge("jeton")).resolves.toEqual({
      id: user.id,
      email: user.email,
    });
  });

  it("reports the provider as unavailable when it cannot be reached", async () => {
    const config = readConfig(configured);
    const bridge = createGoogleBridge(config)!;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(bridge("jeton")).rejects.toMatchObject({
      status: 503,
      code: "GOOGLE_UNAVAILABLE",
    });
  });

  it("rejects an invalid token as unauthorised, not as a server error", async () => {
    const config = readConfig(configured);
    const bridge = createGoogleBridge(config)!;
    respond({ msg: "invalid JWT" }, 401);
    await expect(bridge("jeton-invalide")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_GOOGLE_TOKEN",
    });
  });

  it("treats a provider outage as unavailable rather than a bad token", async () => {
    const config = readConfig(configured);
    const bridge = createGoogleBridge(config)!;
    respond({ msg: "upstream" }, 503);
    await expect(bridge("jeton")).rejects.toMatchObject({
      status: 503,
      code: "GOOGLE_UNAVAILABLE",
    });
  });

  it("refuses an identity that is not a confirmed Google account", async () => {
    const config = readConfig(configured);
    const bridge = createGoogleBridge(config)!;
    // Le motif exact est journalisé côté serveur ; l'appelant ne reçoit
    // qu'un message générique, pour ne pas lui indiquer quoi corriger.
    for (const [payload, detail] of [
      [
        { ...user, identities: [{ provider: "email" }] },
        "aucune identité google",
      ],
      [{ ...user, email_confirmed_at: null }, "email non confirmé"],
      [{ ...user, email: null }, "email absent"],
    ] as const) {
      respond(payload);
      await expect(bridge("jeton")).rejects.toMatchObject({
        status: 401,
        code: "INVALID_GOOGLE_TOKEN",
        message: "Connexion Google invalide.",
        detail,
      });
    }
  });
});
