// Configuration Vite du mode démo (npm run dev:demo) : le serveur de
// développement répond lui-même à /api/v1, sans backend. Voir dev/demo-api.ts.
import { defineConfig } from "vite";
import { demoApi } from "./dev/demo-api";

export default defineConfig({ plugins: [demoApi()] });
