import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "../errors.js";
import type { MediaStore } from "./service.js";

/** Compartiment public : les photos de mission s'affichent sans jeton. */
export const MISSION_MEDIA_BUCKET = "mission-media";

/**
 * Stockage Supabase.
 *
 * Le projet dispose déjà du client d'administration et de ses secrets : rien ne
 * justifierait d'introduire un second fournisseur pour déposer des images.
 *
 * Le compartiment est public en LECTURE seule. L'écriture passe exclusivement
 * par cette clé de service, donc par le serveur, qui a déjà vérifié le rôle et
 * la propriété. Aucun client ne reçoit de jeton d'écriture.
 */
export function createSupabaseMediaStore(
  client: SupabaseClient,
  bucket = MISSION_MEDIA_BUCKET,
): MediaStore {
  return {
    async upload(path, body, contentType) {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, body, { contentType, upsert: false });
      if (error)
        throw new HttpError(
          502,
          "STORAGE_UNAVAILABLE",
          "L'image n'a pas pu être enregistrée. Réessayez dans un instant.",
        );
    },
    publicUrl(path) {
      return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
    async remove(path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw new Error(error.message);
    },
  };
}
