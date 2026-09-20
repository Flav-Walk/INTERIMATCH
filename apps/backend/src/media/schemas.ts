import { z } from "zod";

/**
 * Photo d'une mission, telle qu'elle est stockée et servie.
 *
 * Deux fournisseurs, deux formes. Le client ne décrit jamais entièrement une
 * photo Unsplash : il en désigne une par son identifiant, et le serveur va
 * chercher l'original chez Unsplash. C'est ce qui rend l'attribution
 * infalsifiable — une requête ne peut pas faire passer une URL arbitraire pour
 * une photographie créditée.
 */
export const MISSION_MEDIA_PROVIDERS = ["upload", "unsplash"] as const;
export type MissionMediaProvider = (typeof MISSION_MEDIA_PROVIDERS)[number];

/** Types d'image acceptés à l'import, et leur signature binaire. */
export const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/png": {
    extension: "png",
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  "image/webp": { extension: "webp", magic: [] },
} as const;

export type AcceptedImageType = keyof typeof ACCEPTED_IMAGE_TYPES;

/** 5 Mio. Au-delà, une photo de carte n'apporte plus rien à l'écran. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Type réel d'un fichier, lu dans ses octets.
 *
 * L'en-tête `Content-Type` est déclaratif : il dit ce que le client prétend
 * envoyer. Le vérifier à la source est la seule façon d'empêcher qu'un contenu
 * quelconque soit déposé sous une extension d'image.
 *
 * WebP n'a pas de signature contiguë : son conteneur RIFF porte « RIFF » aux
 * octets 0-3 et « WEBP » aux octets 8-11, avec la taille entre les deux.
 */
export function sniffImageType(bytes: Uint8Array): AcceptedImageType | null {
  const starts = (signature: readonly number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (starts(ACCEPTED_IMAGE_TYPES["image/jpeg"].magic[0])) return "image/jpeg";
  if (starts(ACCEPTED_IMAGE_TYPES["image/png"].magic[0])) return "image/png";
  const ascii = (offset: number, text: string) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

/**
 * Ce que le CLIENT a le droit d'envoyer.
 *
 * Il DÉSIGNE une photo, il ne la décrit jamais entièrement. Pour un import, il
 * renvoie le chemin de stockage que le serveur lui a donné ; l'URL publique
 * est redérivée de ce chemin par le stockage, et n'est donc pas transportée par
 * la requête. Pour Unsplash, il n'envoie qu'un identifiant, que le serveur
 * résout chez Unsplash.
 *
 * POURQUOI NE PAS ACCEPTER L'URL. Elle finit dans un `<img src>`. La faire
 * venir de la requête laisserait une entreprise afficher, depuis sa propre
 * mission, n'importe quelle ressource distante — et transformer la carte en
 * mouchard ou en contenu qui n'a jamais transité par nos validations.
 */
export const missionMediaInputSchema = z.discriminatedUnion("provider", [
  z
    .object({
      provider: z.literal("upload"),
      storage_path: z.string().trim().min(1).max(300),
      alt: z.string().trim().max(300).optional(),
    })
    .strict(),
  z
    .object({
      provider: z.literal("unsplash"),
      external_id: z.string().trim().min(1).max(100),
    })
    .strict(),
]);

export type MissionMediaInput = z.infer<typeof missionMediaInputSchema>;

/** Photo importée : le binaire vit dans le stockage, jamais dans PostgreSQL. */
export interface UploadedMissionMedia {
  provider: "upload";
  url: string;
  storage_path: string;
  alt?: string;
}

/**
 * Photo Unsplash.
 *
 * `author_name` et `author_url` ne sont pas décoratifs : les conditions
 * d'utilisation de l'API imposent de créditer le photographe et de renvoyer
 * vers son profil. Les stocker avec la photo est ce qui permet d'afficher ce
 * crédit sans rappeler l'API à chaque rendu de carte.
 */
export interface UnsplashMissionMedia {
  provider: "unsplash";
  external_id: string;
  url: string;
  thumb_url: string;
  author_name: string;
  author_url: string;
  alt?: string;
}

export type MissionMedia = UploadedMissionMedia | UnsplashMissionMedia;
