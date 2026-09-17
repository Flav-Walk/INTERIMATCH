import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/routes.js";
import type { Profile } from "../auth/schemas.js";
import { roleUpdateSchema } from "./schemas.js";
import type { AdminService } from "./service.js";

const identifier = z.uuid();

export function adminRouter(admin: AdminService) {
  const router = Router();
  router.use(requireRole("admin"));

  router.get("/users", async (_req, res) => res.json(await admin.listUsers()));

  router.patch("/users/:id/role", async (req, res) => {
    const actor = res.locals.profile as Profile;
    const userId = identifier.parse(req.params.id);
    const { role } = roleUpdateSchema.parse(req.body);
    res.json(await admin.updateRole(actor.id, userId, role));
  });

  return router;
}
