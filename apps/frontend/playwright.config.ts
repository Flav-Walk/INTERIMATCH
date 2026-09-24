import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  // Vite et le backend PGlite sont partagés par tous les projets. Au-delà de
  // deux navigateurs concurrents, leurs démarrages à froid peuvent saturer le
  // serveur de développement et bloquer page.goto avant même les assertions.
  workers: 2,
  use: { baseURL: "http://127.0.0.1:5174" },
  webServer: [
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: {
        VITE_API_URL: "http://127.0.0.1:3001/api/v1",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
    {
      command: "node --import tsx src/scripts/test-server.ts",
      cwd: existsSync("../backend/package.json")
        ? "../backend"
        : "../../../InteriMatch-backend/apps/backend",
      url: "http://127.0.0.1:3001/api/v1/health",
      reuseExistingServer: false,
      env: { NODE_ENV: "test" },
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
