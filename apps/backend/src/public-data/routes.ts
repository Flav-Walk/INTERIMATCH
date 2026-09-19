import { Router } from "express";
import { HttpError } from "../errors.js";
import { publicJobOfferQuerySchema } from "./schemas.js";
import type { PublicJobOfferService } from "./service.js";

export function publicJobOffersRouter(service: PublicJobOfferService) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const query = publicJobOfferQuerySchema.parse(req.query);
      const result = await service.list(query);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        throw new HttpError(400, "INVALID_REQUEST", "Identifiant requis.");
      }
      const offer = await service.getById(id);
      if (!offer) {
        throw new HttpError(404, "NOT_FOUND", "Offre publique introuvable.");
      }
      res.json(offer);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
