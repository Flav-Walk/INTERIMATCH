import { it, expect, vi } from "vitest";
import request from "supertest";
const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("pino", () => ({ default: () => logs }));
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
it("ne journalise ni query string, ni corps, ni pile d'erreur", async () => {
  const res = await request(createApp(readConfig({ NODE_ENV: "test" })))
    .post("/api/v1/workers/me?access_token=synthetic-canary")
    .set("Content-Type", "application/json")
    .send('{"password":"synthetic-body"');
  expect(res.status).toBe(400);
  expect(logs.error).toHaveBeenCalled();
  const serialized = JSON.stringify(logs.error.mock.calls);
  expect(serialized).not.toContain("synthetic-canary");
  expect(serialized).not.toContain("synthetic-body");
  expect(serialized).not.toContain("stack");
  expect(logs.error.mock.calls[0][0].path).toBe("/api/v1/workers/me");
});
