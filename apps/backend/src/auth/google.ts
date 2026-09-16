import { createSupabaseAdmin } from "../integrations/clients.js";
import { HttpError } from "../errors.js";
import type { Config } from "../config.js";

export type GoogleIdentity = (
  jwt: string,
) => Promise<{ id: string; email: string }>;

/**
 * Pont entre la session Supabase obtenue au retour OAuth et le profil InteriMatch.
 *
 * Le client Supabase est construit **une fois au démarrage**, pas à chaque requête :
 * une configuration absente se voit au boot et rend simplement la connexion Google
 * indisponible (503 explicite), au lieu de produire une erreur 500 opaque au moment
 * où l'utilisateur clique. Renvoie `undefined` si Supabase n'est pas configuré.
 */
export function createGoogleBridge(config: Config): GoogleIdentity | undefined {
  let client;
  try {
    client = createSupabaseAdmin(config);
  } catch {
    return undefined;
  }
  return async (jwt) => {
    let result;
    try {
      result = await client.auth.getUser(jwt);
    } catch {
      // Panne réseau ou Supabase injoignable : ce n'est pas la faute du jeton.
      throw new HttpError(
        503,
        "GOOGLE_UNAVAILABLE",
        "Connexion Google momentanément indisponible. Réessayez dans un instant.",
      );
    }
    const { data, error } = result;
    if (error && isUnreachable(error))
      throw new HttpError(
        503,
        "GOOGLE_UNAVAILABLE",
        "Connexion Google momentanément indisponible. Réessayez dans un instant.",
      );
    const reason = error
      ? `supabase:${error.name}`
      : !data.user
        ? "aucun utilisateur"
        : !data.user.email
          ? "email absent"
          : !data.user.email_confirmed_at
            ? "email non confirmé"
            : !data.user.identities?.some((i) => i.provider === "google")
              ? "aucune identité google"
              : null;
    if (reason || !data.user?.email)
      throw new HttpError(
        401,
        "INVALID_GOOGLE_TOKEN",
        "Connexion Google invalide.",
        reason ?? "email absent",
      );
    return { id: data.user.id, email: data.user.email };
  };
}

/** supabase-js rend les pannes réseau sous forme d'erreur, pas d'exception. */
function isUnreachable(error: { name?: string; status?: number }) {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === undefined ||
    error.status === 0 ||
    error.status >= 500
  );
}
