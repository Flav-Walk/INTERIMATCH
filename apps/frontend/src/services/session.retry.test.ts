import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const unauthorized = () =>
  json({ error: { code: "UNAUTHORIZED", message: "Session expirée." } }, 401);
async function load() {
  vi.resetModules();
  return import("./session");
}
beforeEach(() => vi.stubEnv("VITE_API_URL", "http://api.test/api/v1"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("silent session recovery", () => {
  it("renews an expired bearer once and replays the original call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json({ access_token: "renewed" }))
      .mockResolvedValueOnce(json({ id: "profile-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await load();
    expect(await api("/me")).toEqual({ id: "profile-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe(
      "Bearer renewed",
    );
  });
  it("signals an expired session instead of looping when renewal fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized());
    vi.stubGlobal("fetch", fetchMock);
    // The suite runs outside a browser: an EventTarget is all the code needs.
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const { api } = await load();
    const expired = vi.fn();
    target.addEventListener("session-expired", expired);
    await expect(api("/me")).rejects.toMatchObject({ status: 401 });
    target.removeEventListener("session-expired", expired);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("never tries to renew a failed sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await load();
    await expect(
      api("/auth/login", { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sends credentials so the refresh cookie travels with every call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await load();
    await api("/me");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });
  it("shares a single renewal between concurrent calls", async () => {
    let renewals = 0;
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        renewals += 1;
        return Promise.resolve(json({ access_token: "renewed" }));
      }
      return Promise.resolve(
        renewals === 0 ? unauthorized() : json({ id: "profile-1" }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await load();
    await Promise.all([api("/me"), api("/skills")]);
    expect(renewals).toBe(1);
  });
});
