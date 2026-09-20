import { api } from "./session";
import { ApiError } from "./api";
import type { MissionMedia } from "./missions";

/**
 * Photo d'une mission, côté navigateur.
 *
 * AUCUNE CLÉ UNSPLASH ICI. La recherche passe par l'API InteriMatch, qui porte
 * seule la clé d'accès : le quota qu'elle représente est celui de
 * l'application entière, et une clé livrée dans le bundle serait un quota que
 * n'importe qui peut épuiser. Ce fichier ne connaît qu'un chemin `/company/…`.
 */

/** Formats acceptés. La même liste sert l'attribut `accept` et le contrôle. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 5 Mio, comme le serveur. Le dire ici évite un aller-retour pour rien. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

export interface UnsplashPhoto {
  id: string;
  thumb_url: string;
  preview_url: string;
  alt: string | null;
  author_name: string;
  author_url: string;
}

export interface UnsplashSearch {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

/**
 * Contrôles tenus avant d'envoyer quoi que ce soit.
 *
 * Le serveur revérifie tout, et sur les octets plutôt que sur le type déclaré :
 * ce qui est fait ici ne protège de rien, cela évite seulement de téléverser
 * cinq méga-octets pour s'entendre répondre non.
 */
export function rejectionReason(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Formats acceptés : JPEG, PNG ou WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "L’image ne doit pas dépasser 5 Mo.";
  if (file.size === 0) return "Ce fichier est vide.";
  return null;
}

/** Dépose l'image et renvoie le média que la mission pourra référencer. */
export async function uploadMissionPhoto(file: File): Promise<MissionMedia> {
  return api<MissionMedia>("/company/media", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: await file.arrayBuffer(),
  });
}

export const searchUnsplash = (query: string, page = 1) =>
  api<UnsplashSearch>(
    `/company/media/unsplash?query=${encodeURIComponent(query)}&page=${page}`,
  );

/**
 * Une panne de la bibliothèque n'est pas une panne du formulaire.
 *
 * Unsplash peut être absent — clé non configurée — ou saturé. Dans les deux cas
 * l'entreprise garde l'import depuis son ordinateur, et le message doit le lui
 * dire plutôt que de ressembler à une erreur générale.
 */
export const unsplashUnavailable = (error: unknown) =>
  error instanceof ApiError &&
  [
    "UNSPLASH_NOT_CONFIGURED",
    "UNSPLASH_UNAVAILABLE",
    "UNSPLASH_RATE_LIMITED",
  ].includes(error.code);

/**
 * Crédit d'une photo Unsplash, dans la forme exigée par leurs conditions :
 * « Photo by <auteur> on Unsplash », les deux liens portant les paramètres de
 * référencement. Les liens auteur arrivent déjà complétés par le serveur.
 */
export const UNSPLASH_HOME =
  "https://unsplash.com/?utm_source=interimatch&utm_medium=referral";
