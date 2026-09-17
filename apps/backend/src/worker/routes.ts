import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AccountService } from "../auth/service.js";
import type { Profile } from "../auth/schemas.js";
import { requireRole } from "../auth/routes.js";
import { WorkerService } from "./service.js";
import {
  availabilityPatchSchema,
  availabilitySchema,
  certificationsSchema,
  experiencesSchema,
  skillsSchema,
  workerPatchSchema,
} from "./schemas.js";

const identifier = z.uuid();

/**
 * Espace intérimaire. Toutes les routes sont déjà derrière `requireAuth`, monté
 * par le routeur de comptes : `res.locals.profile` est la seule source
 * d'identité, et aucun `profile_id` n'est jamais accepté depuis la requête.
 */
export function workerRouter(accounts: AccountService, workers: WorkerService) {
  const router = Router();
  const worker = requireRole("worker");
  const me = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).id;

  /** Toute écriture renvoie le profil complet : l'interface reste synchrone. */
  const respond: RequestHandler = async (_req, res) =>
    res.json(await accounts.me(await accounts.reload(me(res))));

  router.get("/workers/me", worker, respond);

  router.patch("/workers/me", worker, async (req, res, next) => {
    try {
      await workers.patch(me(res), workerPatchSchema.parse(req.body));
      await respond(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  router.put("/workers/me/skills", worker, async (req, res, next) => {
    try {
      await workers.setSkills(me(res), skillsSchema.parse(req.body).skill_ids);
      await respond(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  router.put("/workers/me/experiences", worker, async (req, res, next) => {
    try {
      await workers.setExperiences(
        me(res),
        experiencesSchema.parse(req.body).experiences,
      );
      await respond(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  router.put("/workers/me/certifications", worker, async (req, res, next) => {
    try {
      await workers.setCertifications(
        me(res),
        certificationsSchema.parse(req.body).certifications,
      );
      await respond(req, res, next);
    } catch (e) {
      next(e);
    }
  });

  router.get("/workers/me/availabilities", worker, async (_req, res) =>
    res.json(await workers.listAvailabilities(me(res))),
  );

  router.post("/workers/me/availabilities", worker, async (req, res) =>
    res
      .status(201)
      .json(
        await workers.addAvailability(
          me(res),
          availabilitySchema.parse(req.body),
        ),
      ),
  );

  router.patch("/workers/me/availabilities/:id", worker, async (req, res) =>
    res.json(
      await workers.updateAvailability(
        me(res),
        identifier.parse(req.params.id),
        availabilityPatchSchema.parse(req.body),
      ),
    ),
  );

  router.delete("/workers/me/availabilities/:id", worker, async (req, res) => {
    await workers.removeAvailability(me(res), identifier.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
