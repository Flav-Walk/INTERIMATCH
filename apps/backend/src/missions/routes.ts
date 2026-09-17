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
 * Missions, vues des deux côtés.
 *
 * Monté derrière `requireAuth` par le routeur de comptes : `res.locals.profile`
 * est la seule source d'identité, et `company_id` n'est jamais lu depuis la
 * requête.
 *
 * Deux espaces distincts, servis par le même service :
 *  - `/missions…` pour l'entreprise, qui voit et gère **ses** missions, quel
 *    que soit leur statut ;
 *  - `/workers/me/missions…` pour l'intérimaire, qui voit les missions
 *    **offertes**, sans jamais accéder à celles d'un autre statut. Le chemin dit
 *    « pour moi » : c'est là que le rapprochement viendra les ordonner, sans
 *    changer l'URL ni le contrat.
 *
 * Les transitions `filled`, `completed` et `cancelled` ne sont pas exposées :
 * elles viendront avec la candidature et l'attribution.
 */
export function missionRouter(missions: MissionService) {
  const router = Router();
  const company = requireRole("company");
  const worker = requireRole("worker");
  const me = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).id;
  /**
   * Un compte de démonstration ne voit que des missions de démonstration, et un
   * compte réel n'en voit aucune. Le marqueur vient de la session, jamais de la
   * requête : personne ne peut demander à voir l'autre côté de la cloison.
   */
  const isDemo = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).demo;

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

  // --- Espace intérimaire : lecture seule des missions offertes. ---

  router.get("/workers/me/missions", worker, async (_req, res) =>
    res.json({ missions: await missions.listOpen(isDemo(res)) }),
  );

  router.get("/workers/me/missions/:id", worker, async (req, res) =>
    res.json(
      await missions.getOpen(identifier.parse(req.params.id), isDemo(res)),
    ),
  );

  return router;
}
