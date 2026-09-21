import { Router } from "express";
import { z } from "zod";
import type { Profile } from "../auth/schemas.js";
import { requireRole } from "../auth/routes.js";
import { contractSignSchema } from "./schemas.js";
import type { ContractService } from "./service.js";

const identifier = z.uuid();

export function contractRouter(contracts: ContractService) {
  const router = Router();
  const worker = requireRole("worker");
  const company = requireRole("company");
  const party = requireRole("worker", "company");
  const actor = (res: { locals: Record<string, unknown> }) =>
    res.locals.profile as Profile;

  router.get("/workers/me/documents", worker, async (_req, res) =>
    res.json({ documents: await contracts.listFor(actor(res)) }),
  );

  router.get("/company/me/documents", company, async (_req, res) =>
    res.json({ documents: await contracts.listFor(actor(res)) }),
  );

  router.get("/documents/:id", party, async (req, res) =>
    res.json(
      await contracts.getFor(
        identifier.parse(req.params.id),
        actor(res),
      ),
    ),
  );

  router.post("/documents/:id/sign", party, async (req, res) => {
    contractSignSchema.parse(req.body);
    res.json(
      await contracts.sign(identifier.parse(req.params.id), actor(res)),
    );
  });

  router.get("/documents/:id/download", party, async (req, res) => {
    const file = await contracts.download(
      identifier.parse(req.params.id),
      actor(res),
    );
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": String(file.bytes.byteLength),
    });
    res.send(Buffer.from(file.bytes));
  });

  return router;
}

