import { Router } from "express";
import { z } from "zod";
import type { Profile } from "../auth/schemas.js";
import { requireRole } from "../auth/routes.js";
import { MissionService } from "./service.js";
import {
  missionCreateSchema,
  missionListSchema,
  missionUpdateSchema,
} from "./schemas.js";

const identifier = z.uuid();

/**
 * Espace missions de l'entreprise. Monté derrière `requireAuth` par le routeur
 * de comptes : `res.locals.profile` est la seule source d'identité, et
 * `company_id` n'est jamais lu depuis la requête.
 *
 * Les transitions `filled`, `completed` et `cancelled` ne sont pas exposées :
 * elles viendront avec la candidature et l'attribution.
 */
export function missionRouter(missions: MissionService) {
  const router = Router();
  const company = requireRole("company");
  const me = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).id;

  router.get("/missions", company, async (req, res) => {
    const { status } = missionListSchema.parse(req.query);
    const companyId = me(res);
    const [items, counts] = await Promise.all([
      missions.list(companyId, status),
      missions.counts(companyId),
    ]);
    res.json({ missions: items, counts });
  });

  router.get("/missions/:id", company, async (req, res) =>
    res.json(await missions.get(me(res), identifier.parse(req.params.id))),
  );

  router.post("/missions", company, async (req, res) => {
    const companyId = me(res);
    const id = await missions.create(
      companyId,
      missionCreateSchema.parse(req.body),
    );
    // La mission créée est relue et renvoyée entière, comme le ferait un GET :
    // le client connaît ainsi son identifiant, son statut et ses coordonnées.
    res.status(201).json(await missions.get(companyId, id));
  });

  router.patch("/missions/:id", company, async (req, res) =>
    res.json(
      await missions.update(
        me(res),
        identifier.parse(req.params.id),
        missionUpdateSchema.parse(req.body),
      ),
    ),
  );

  router.post("/missions/:id/publish", company, async (req, res) =>
    // Sans corps : la date de publication est décidée par le serveur.
    res.json(await missions.publish(me(res), identifier.parse(req.params.id))),
  );

  return router;
}
