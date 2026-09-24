import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  /*
   * UN SEUL OUVRIER.
   *
   * Vite et le backend PGlite sont partagés par tous les projets. La suite
   * tournait à deux navigateurs concurrents ; elle en supporte mal un
   * troisième type de charge — la recette visuelle, qui traverse vingt écrans
   * et en tire autant de captures pleine page, sur chacun des deux projets.
   *
   * Le symptôme n'était jamais une assertion fausse : c'étaient des `page.goto`
   * et des `locator.fill` qui expiraient au bout de trente à quatre-vingt-dix
   * secondes, sur des écrans qui s'affichent en cent millisecondes une fois
   * seuls. Trois tests différents sont tombés ainsi d'une exécution à l'autre,
   * tous verts en isolation.
   *
   * Deux corrections ont été tentées avant celle-ci : le préchauffage des
   * modules côté Vite (conservé, il a supprimé la majorité des blocages) et
   * l'allongement des délais — écarté, parce qu'il déplace le seuil au lieu de
   * retirer la cause, et parce qu'un test qui met quatre-vingt-dix secondes ne
   * dit plus rien de juste.
   *
   * La suite passe de quatre à environ huit minutes. C'est le prix d'un
   * résultat auquel on peut se fier : un échec redevient un vrai défaut.
   */
  workers: 1,
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
