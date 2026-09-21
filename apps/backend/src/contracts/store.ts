import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "../errors.js";

export const CONTRACT_DOCUMENTS_BUCKET = "contract-documents";

export interface ContractDocumentStore {
  upload(path: string, body: Uint8Array): Promise<void>;
  download(path: string): Promise<Uint8Array>;
}

/**
 * Stockage privé des PDF. Aucun URL public ou signé ne traverse l'API : le
 * backend télécharge l'objet avec sa clé serveur après avoir vérifié la partie.
 */
export function createSupabaseContractStore(
  client: SupabaseClient,
  bucket = CONTRACT_DOCUMENTS_BUCKET,
): ContractDocumentStore {
  return {
    async upload(path, body) {
      const { error } = await client.storage.from(bucket).upload(path, body, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error)
        throw new HttpError(
          502,
          "DOCUMENT_STORAGE_UNAVAILABLE",
          "Le document n'a pas pu être archivé. Réessayez dans un instant.",
        );
    },
    async download(path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data)
        throw new HttpError(
          502,
          "DOCUMENT_STORAGE_UNAVAILABLE",
          "Le document est momentanément indisponible.",
        );
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

