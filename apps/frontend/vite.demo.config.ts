// Configuration Vite du mode démo (npm run dev:demo).
// Même chose que « npm run dev », avec en plus la fausse API de
// dev/demo-api.ts : le serveur de dev répond lui-même à /api/v1, sans backend
// ni Supabase.
import { defineConfig } from "vite";
import { demoApi } from "./dev/demo-api";

export default defineConfig({ plugins: [demoApi()] });
