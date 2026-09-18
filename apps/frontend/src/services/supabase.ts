import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./env";

/**
 * Client Supabase, chargé seulement si quelqu'un s'en sert.
 *
 * Il ne sert qu'à la connexion Google : ouvrir la redirection, échanger le code
 * au retour, et fermer la session locale. Importé au premier niveau, il pesait
 * pourtant dans le fichier que **tout** visiteur télécharge, y compris ceux qui
 * ne verront jamais un bouton Google — et y compris sur la page d'accueil.
 *
 * Le module est donc chargé à la demande, et mis en cache après le premier
 * appel. `configured` reste synchrone, parce que l'interface doit savoir
 * masquer le bouton Google sans rien télécharger pour le décider.
 */
export const supabaseConfigured = Boolean(
  config?.VITE_SUPABASE_URL && config.VITE_SUPABASE_PUBLISHABLE_KEY,
);

let client: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(
      config!.VITE_SUPABASE_URL!,
      config!.VITE_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    ),
  );
  return client;
}
