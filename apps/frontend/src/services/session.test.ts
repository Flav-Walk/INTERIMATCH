import { describe, it, expect, vi, afterEach } from "vitest";
import { destination, errorMessage, type User } from "./session";
import { ApiError } from "./api";
afterEach(() => vi.unstubAllGlobals());
const user = (over: Partial<User>): User =>
  ({
    id: "id",
    email: "person@example.test",
    role: "worker",
    first_name: "",
    last_name: "",
    onboarding_completed: false,
    tour_version: 0,
    demo: false,
    profile: {},
    ...over,
  }) as User;
describe("session routing", () => {
  it("sends an intérimaire to the worker space", () => {
    expect(destination(user({ role: "worker" }))).toBe("/worker");
  });
  it("sends a company to the company space", () => {
    expect(destination(user({ role: "company" }))).toBe("/company");
  });
  it("does not gate the space on profile completion", () => {
    // The profile is completed from inside the space, never before entering it.
    expect(
      destination(user({ role: "worker", onboarding_completed: true })),
    ).toBe(destination(user({ role: "worker", onboarding_completed: false })));
  });
  it("does not invent an admin space", () => {
    expect(destination(user({ role: "admin" }))).toBe("/");
  });
});
describe("error messages", () => {
  it("keeps the server explanation", () => {
    expect(errorMessage(new ApiError("Email incorrect.", 401, "X"))).toBe(
      "Email incorrect.",
    );
  });
  it("explains an unreachable network without technical noise", () => {
    const message = errorMessage(new TypeError("Failed to fetch"));
    expect(message).toContain("réseau");
    expect(message).not.toContain("fetch");
  });
  it("never leaks a non-error value", () => {
    expect(errorMessage({ secret: "value" })).toBe("Une erreur est survenue.");
  });
});
