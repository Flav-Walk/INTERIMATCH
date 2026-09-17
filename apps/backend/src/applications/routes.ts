import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/routes.js";
import type { Profile } from "../auth/schemas.js";
import {
  applicationCreateSchema,
  applicationDecisionSchema,
} from "./schemas.js";
import type { ApplicationService } from "./service.js";

const identifier = z.uuid();
const me = (res: { locals: Record<string, unknown> }) =>
  (res.locals.profile as Profile).id;

export function applicationRouter(applications: ApplicationService) {
  const router = Router();
  const worker = requireRole("worker");
  const company = requireRole("company");

  router.get("/workers/me/applications", worker, async (_req, res) =>
    res.json({ applications: await applications.listForWorker(me(res)) }),
  );

  router.get("/workers/me/applications/:missionId", worker, async (req, res) =>
    res.json({
      application: await applications.getForWorkerMission(
        me(res),
        identifier.parse(req.params.missionId),
      ),
    }),
  );

  router.post("/workers/me/applications", worker, async (req, res) => {
    const { mission_id } = applicationCreateSchema.parse(req.body);
    res.status(201).json(await applications.create(me(res), mission_id));
  });

  router.get("/missions/:missionId/applications", company, async (req, res) =>
    res.json({
      applications: await applications.listForMission(
        me(res),
        identifier.parse(req.params.missionId),
      ),
    }),
  );

  router.patch(
    "/missions/:missionId/applications/:applicationId",
    company,
    async (req, res) => {
      const { status } = applicationDecisionSchema.parse(req.body);
      res.json(
        await applications.decide(
          me(res),
          identifier.parse(req.params.missionId),
          identifier.parse(req.params.applicationId),
          status,
        ),
      );
    },
  );

  return router;
}
