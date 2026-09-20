import { randomUUID } from "node:crypto";
import { HttpError } from "../errors.js";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  sniffImageType,
  type MissionMedia,
  type MissionMediaInput,
  type UploadedMissionMedia,
} from "./schemas.js";
import type { UnsplashService } from "./unsplash.js";

/**
 * Dépôt d'un fichier. Volontairement réduit à ce que le service utilise, pour
 * que les tests n'aient pas à simuler tout le client Supabase.
 */
export interface MediaStore {
  upload(path: string, body: Uint8Array, contentType: string): Promise<void>;
  /** URL publique d'un chemin déjà déposé. Seule autorité sur cette forme. */
  publicUrl(path: string): string;
  remove(path: string): Promise<void>;
}

/**
 * Stockage des photos importées.
 *
 * Le binaire ne va jamais en base : PostgreSQL stocke un chemin, le fichier vit
 * dans Supabase Storage. Le chemin porte l'identifiant de l'entreprise —
 * `missions/<company_id>/<uuid>.<ext>` — et c'est ce qui rend la propriété
 * vérifiable sans lecture supplémentaire : une entreprise ne peut associer à sa
 * mission qu'un fichier déposé sous son propre préfixe.
 */
export class MissionMediaService {
  constructor(
    private store: MediaStore,
    private unsplash?: UnsplashService,
  ) {}

  get unsplashEnabled() {
    return Boolean(this.unsplash);
  }

  // `async` : une absence de configuration doit être un rejet, comme toute
  // autre erreur de ce service, et non une exception synchrone que l'appelant
  // devrait attraper autrement.
  async searchUnsplash(query: string, page: number) {
    if (!this.unsplash)
      throw new HttpError(
        503,
        "UNSPLASH_NOT_CONFIGURED",
        "La bibliothèque de photos n'est pas configurée sur ce serveur. Importez une photo depuis votre ordinateur.",
      );
    return this.unsplash.search(query, page);
  }

  /** Préfixe de stockage d'une entreprise. Unique source de cette convention. */
  static prefixFor(companyId: string) {
    return `missions/${companyId}/`;
  }

  /**
   * Dépôt d'une image.
   *
   * Le type est décidé par les octets, pas par l'en-tête : `Content-Type` est
   * une déclaration du client, et une déclaration ne protège de rien. Le nom du
   * fichier d'origine n'est jamais repris — un identifiant aléatoire et une
   * extension dérivée du type réel suppriment d'un coup les chemins piégés, les
   * collisions et les caractères exotiques.
   */
  async upload(companyId: string, bytes: Uint8Array) {
    if (!bytes.length)
      throw new HttpError(400, "EMPTY_FILE", "Le fichier reçu est vide.");
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new HttpError(
        413,
        "FILE_TOO_LARGE",
        "L'image ne doit pas dépasser 5 Mo.",
      );
    const type = sniffImageType(bytes);
    if (!type)
      throw new HttpError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Formats acceptés : JPEG, PNG ou WebP.",
      );
    const path = `${MissionMediaService.prefixFor(companyId)}${randomUUID()}.${ACCEPTED_IMAGE_TYPES[type].extension}`;
    await this.store.upload(path, bytes, type);
    const media: UploadedMissionMedia = {
      provider: "upload",
      url: this.store.publicUrl(path),
      storage_path: path,
    };
    return media;
  }

  /**
   * Transforme ce que le client a envoyé en média enregistrable.
   *
   * C'est ici que se joue le cloisonnement : un chemin de stockage n'est accepté
   * que s'il appartient au préfixe de l'entreprise qui enregistre. Sans cette
   * vérification, une entreprise pourrait afficher — et faire disparaître — le
   * fichier d'une autre en le désignant dans sa propre mission.
   */
  async resolve(
    companyId: string,
    input: MissionMediaInput,
  ): Promise<MissionMedia> {
    if (input.provider === "unsplash") {
      if (!this.unsplash)
        throw new HttpError(
          503,
          "UNSPLASH_NOT_CONFIGURED",
          "La bibliothèque de photos n'est pas configurée sur ce serveur.",
        );
      return this.unsplash.resolve(input.external_id);
    }
    if (
      !input.storage_path.startsWith(MissionMediaService.prefixFor(companyId))
    )
      throw new HttpError(
        403,
        "MEDIA_FORBIDDEN",
        "Cette image n'appartient pas à votre établissement.",
      );
    // L'URL est redérivée, jamais reprise de la requête : voir `schemas.ts`.
    return {
      provider: "upload",
      url: this.store.publicUrl(input.storage_path),
      storage_path: input.storage_path,
      ...(input.alt ? { alt: input.alt } : {}),
    };
  }

  /**
   * Efface le fichier d'un média remplacé.
   *
   * Seuls les imports laissent une trace à nettoyer : une photo Unsplash n'a
   * jamais été copiée chez nous. L'échec est absorbé — un fichier orphelin coûte
   * quelques kilo-octets, alors qu'une erreur ferait échouer l'enregistrement
   * d'une mission pour un ménage qui ne regarde pas l'utilisateur.
   */
  async discard(previous: MissionMedia | null, next: MissionMedia | null) {
    if (!previous || previous.provider !== "upload") return;
    if (
      next?.provider === "upload" &&
      next.storage_path === previous.storage_path
    )
      return;
    try {
      await this.store.remove(previous.storage_path);
    } catch {
      // Sans conséquence pour l'utilisateur : voir ci-dessus.
    }
  }
}
