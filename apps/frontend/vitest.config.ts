import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Vitest measures the logic layer. The React views (pages, layouts, guards)
      // are exercised end to end by the Playwright suite: see docs/TESTING.md.
      include: ["src/services/**/*.ts"],
      exclude: ["src/main.tsx"],
    },
  },
});
