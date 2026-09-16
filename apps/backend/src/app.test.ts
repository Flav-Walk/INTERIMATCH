import { describe, it, expect, vi } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { sslOptions } from "./db.js";
import {
  createMongoClient,
  createPostgresPool,
  createSupabaseAdmin,
} from "./integrations/clients.js";
const config = readConfig({ NODE_ENV: "test" });
describe("API foundation", () => {
  it("serves health without external services and sets security headers", async () => {
    const res = await request(createApp(config)).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
  it("returns structured 404", async () => {
    const res = await request(createApp(config)).get("/missing");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
  it("rejects malformed JSON without leaking parser details", async () => {
    const res = await request(createApp(config))
      .post("/missing")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
  });
  it("rejects oversized body", async () => {
    const res = await request(createApp(config))
      .post("/missing")
      .send({ text: "a".repeat(110000) });
    expect(res.status).toBe(413);
  });
  it("allows configured browser origin only", async () => {
    const app = createApp(config);
    const good = await request(app)
      .options("/api/v1/health")
      .set("Origin", config.FRONTEND_URL)
      .set("Access-Control-Request-Method", "GET");
    expect(good.status).toBe(204);
    expect(good.headers["access-control-allow-origin"]).toBe(
      config.FRONTEND_URL,
    );
    const other = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://other.example");
    expect(other.headers["access-control-allow-origin"]).not.toBe(
      "https://other.example",
    );
  });
  it("limits repeated requests", async () => {
    const app = createApp(config);
    for (let i = 0; i < 100; i++) await request(app).get("/api/v1/health");
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
  it("validates config without exposing values", () => {
    expect(() => readConfig({ PORT: "bad" })).toThrow("PORT");
    expect(() =>
      readConfig({ FRONTEND_URL: "https://site.test/path" }),
    ).toThrow("origine");
  });
  it("keeps TLS on without requiring a certificate authority", () => {
    // Render fournit DATABASE_URL sans CA : la connexion doit rester chiffrée.
    expect(sslOptions(config)).toEqual({ rejectUnauthorized: false });
    expect(
      sslOptions(
        readConfig({
          NODE_ENV: "production",
          FRONTEND_URL: "https://interimatch.example",
        }),
      ),
    ).toEqual({ rejectUnauthorized: false });
  });
  it("disables TLS only when explicitly asked", () => {
    expect(
      sslOptions(readConfig({ NODE_ENV: "test", DB_SSL: "false" })),
    ).toBeUndefined();
  });
  it("verifies the certificate when a readable authority is supplied", () => {
    const path = join(tmpdir(), `interimatch-ca-${randomUUID()}.crt`);
    writeFileSync(path, "-----BEGIN CERTIFICATE-----\ntest\n");
    try {
      expect(
        sslOptions(readConfig({ NODE_ENV: "test", DB_SSL_CA_PATH: path })),
      ).toEqual({
        ca: "-----BEGIN CERTIFICATE-----\ntest\n",
        rejectUnauthorized: true,
      });
    } finally {
      rmSync(path);
    }
  });
  it("starts anyway when the configured authority file is missing", () => {
    // Le cas Render : DB_SSL_CA_PATH pointe un Secret File absent. Ne jamais planter.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      sslOptions(
        readConfig({
          NODE_ENV: "production",
          FRONTEND_URL: "https://interimatch.example",
          DB_SSL_CA_PATH: "/etc/secrets/supabase-ca.crt",
        }),
      ),
    ).toEqual({ rejectUnauthorized: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("fails explicitly for unconfigured integrations", () => {
    expect(() => createSupabaseAdmin(config)).toThrow("non configuré");
    expect(() => createPostgresPool(config)).toThrow("non configuré");
    expect(() => createMongoClient(config)).toThrow("non configuré");
  });
});
