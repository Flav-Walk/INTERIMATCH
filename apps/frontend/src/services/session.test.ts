import { describe, it, expect, vi, afterEach } from "vitest";
import { destination, errorMessage, type User } from "./session";
import { ApiError } from "./api";
afterEach(() => vi.unstubAllGlobals());
const user = (over: Partial<User>): User =>
  ({
    id: "id",
    email: "person@example.test",
    role: null,
    first_name: "",
    last_name: "",
    onboarding_completed: false,
    demo: false,
    profile: {},
    ...over,
  }) as User;
describe("session routing", () => {
  it("sends an account without a role to the role choice", () => {
    expect(destination(user({ role: null }))).toBe("/onboarding/role");
  });
  it("keeps an unfinished profile inside its own onboarding", () => {
    expect(destination(user({ role: "worker" }))).toBe("/onboarding/worker");
    expect(destination(user({ role: "company" }))).toBe("/onboarding/company");
  });
  it("opens the workspace once onboarding is complete", () => {
    expect(
      destination(user({ role: "worker", onboarding_completed: true })),
    ).toBe("/worker");
    expect(
      destination(user({ role: "company", onboarding_completed: true })),
    ).toBe("/company");
  });
  it("does not invent an admin space", () => {
    expect(
      destination(user({ role: "admin", onboarding_completed: true })),
    ).toBe("/");
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
