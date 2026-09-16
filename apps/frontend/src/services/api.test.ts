import { describe, it, expect, vi, afterEach } from "vitest";
import { createApiClient } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("API client", () => {
  it("fails explicitly without configuration", async () => {
    await expect(createApiClient(undefined)("/health")).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });
  it("joins prefix and supplies bearer", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: "ok" })));
    vi.stubGlobal("fetch", mock);
    expect(
      await createApiClient(
        "http://localhost:3000/api/v1/",
        () => "test-token",
      )("/health"),
    ).toEqual({ status: "ok" });
    expect(mock.mock.calls[0][0]).toBe("http://localhost:3000/api/v1/health");
    expect(mock.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer test-token",
    );
  });
  it("preserves server error information", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: "NOT_FOUND", message: "Absent" } }),
            { status: 404, headers: { "X-Request-Id": "test-id" } },
          ),
        ),
    );
    await expect(
      createApiClient("http://localhost")("/missing"),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      requestId: "test-id",
    });
  });
  it("supports empty success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      createApiClient("http://localhost")("/resource"),
    ).resolves.toBeUndefined();
  });
  it("rejects absolute targets", async () => {
    await expect(
      createApiClient("http://localhost")("//outside.example"),
    ).rejects.toMatchObject({ code: "INVALID_PATH" });
  });
});
