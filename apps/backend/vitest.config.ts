import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      // Entry points and operational scripts run on import: they are exercised by
      // `npm run db:migrate`, `db:seed`, `db:check` and the browser suite, not by unit tests.
      exclude: ["src/server.ts", "src/scripts/**"],
    },
  },
});
