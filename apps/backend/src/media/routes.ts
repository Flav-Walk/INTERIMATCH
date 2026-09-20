import { Router, raw } from "express";
import { z } from "zod";
import type { Profile } from "../auth/schemas.js";
import { HttpError } from "../errors.js";
import { MAX_IMAGE_BYTES } from "./schemas.js";
import type { MissionMediaService } from "./service.js";

const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(100),
    page: z.coerce.number().int().min(1).max(20).default(1),
  })
  .strict();

/**
 * Photos de mission.
 *
 * Monté par `createApp` sur `/api/v1/company/media`, derrière `requireAuth` et
 * `requireRole("company")` : ce sont les seuls comptes à pouvoir créer une
 * mission, donc les seuls à avoir une photo à y associer. Les chemins déclarés
 * ici sont donc RELATIFS à ce montage — le garde ne couvre que ce sous-arbre,
 * jamais le reste de l'API.
 *
 * POURQUOI `express.raw` ET PAS UN ANALYSEUR MULTIPART. Le formulaire envoie un
 * fichier, et un seul. Le corps est donc l'image, et son en-tête `Content-Type`
 * dit ce qu'elle prétend être — une prétention que le service revérifie sur les
 * octets. Ajouter une dépendance d'analyse multipart pour transporter un champ
 * unique serait payer un analyseur complet, et sa surface, pour rien.
 */
export function missionMediaRouter(media: MissionMediaService) {
  const router = Router();
  const me = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).id;

  router.get("/unsplash", async (req, res) => {
    const { query, page } = searchSchema.parse(req.query);
    res.json(await media.searchUnsplash(query, page));
  });

  router.post(
    "/",
    raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      // Une marge au-dessus de la limite métier : le service doit pouvoir
      // répondre « trop lourd » lui-même, avec son message, plutôt que laisser
      // Express couper la connexion sur une erreur générique.
      limit: MAX_IMAGE_BYTES + 1024,
    }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body))
        throw new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Formats acceptés : JPEG, PNG ou WebP.",
        );
      res
        .status(201)
        .json(await media.upload(me(res), new Uint8Array(req.body)));
    },
  );

  return router;
}
