import { createClient } from "@supabase/supabase-js";
import { config } from "./env";
export const supabase =
  config?.VITE_SUPABASE_URL && config.VITE_SUPABASE_PUBLISHABLE_KEY
    ? createClient(
        config.VITE_SUPABASE_URL,
        config.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            flowType: "pkce",
            detectSessionInUrl: false,
            persistSession: true,
            autoRefreshToken: true,
          },
        },
      )
    : null;
