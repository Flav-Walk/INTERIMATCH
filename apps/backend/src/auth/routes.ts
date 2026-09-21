import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../errors.js";
import type { Config } from "../config.js";
import { AccountService } from "./service.js";
import {
  loginSchema,
  registerSchema,
  tourSchema,
  workerSchema,
  companySchema,
  type Profile,
  type Role,
} from "./schemas.js";
import {
  sectors,
  jobs,
  payUnits,
  missionStatuses,
  applicationStatuses,
} from "../domain/reference.js";
import type { WorkerService } from "../worker/service.js";
import { workerRouter } from "../worker/routes.js";
import type { MissionService } from "../missions/service.js";
import { missionRouter } from "../missions/routes.js";
import type { ApplicationService } from "../applications/service.js";
import { applicationRouter } from "../applications/routes.js";
import type { ContractService } from "../contracts/service.js";
import { contractRouter } from "../contracts/routes.js";
export const requireAuth =
  (service: AccountService): RequestHandler =>
  async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ") || header.length > 4096)
        throw new HttpError(401, "UNAUTHORIZED", "Connexion requise.");
      res.locals.profile = await service.authenticate(header.slice(7));
      next();
    } catch (e) {
      next(e);
    }
  };
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (_req, res, next) => {
    const p = res.locals.profile as Profile | undefined;
    if (!p)
      return next(new HttpError(401, "UNAUTHORIZED", "Connexion requise."));
    if (!roles.includes(p.role))
      return next(
        new HttpError(
          403,
          "FORBIDDEN",
          "Cet espace ne correspond pas à votre rôle.",
        ),
      );
    next();
  };
export function accountRouter(
  config: Config,
  service: AccountService,
  workers?: WorkerService,
  missions?: MissionService,
  applications?: ApplicationService,
  contracts?: ContractService,
) {
  const router = Router();
  const origin: RequestHandler = (req, _res, next) => {
    if (req.headers.origin !== config.FRONTEND_URL)
      return next(
        new HttpError(403, "INVALID_ORIGIN", "Origine de requête refusée."),
      );
    next();
  };
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.AUTH_RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new HttpError(
          429,
          "AUTH_RATE_LIMIT",
          "Trop de tentatives. Réessayez plus tard.",
        ),
      ),
  });
  const options = {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite:
      config.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60_000,
  };
  for (const action of ["register", "login"] as const)
    router.post("/auth/" + action, origin, limiter, async (req, res) => {
      const input = (
        action === "register" ? registerSchema : loginSchema
      ).parse(req.body);
      const result = await service[action](input.email, input.password);
      res.cookie("im_refresh", result.refresh_token, options);
      res.status(action === "register" ? 201 : 200).json({
        access_token: result.access_token,
        expires_in: result.expires_in,
      });
    });
  router.post("/auth/google", origin, limiter, async (req, res) => {
    const { access_token } = z
      .object({ access_token: z.string().min(1).max(8192) })
      .strict()
      .parse(req.body);
    const result = await service.google(access_token);
    res.cookie("im_refresh", result.refresh_token, options);
    res.json({
      access_token: result.access_token,
      expires_in: result.expires_in,
    });
  });
  router.post("/auth/refresh", origin, async (req, res) => {
    const cookie: unknown = req.cookies?.im_refresh;
    if (typeof cookie !== "string" || cookie.length > 128)
      throw new HttpError(401, "UNAUTHORIZED", "Session expirée.");
    res.json(await service.refresh(cookie));
  });
  router.post("/auth/logout", origin, async (req, res) => {
    const cookie: unknown = req.cookies?.im_refresh;
    await service.logout(
      typeof cookie === "string" ? cookie : undefined,
      req.headers.authorization?.replace(/^Bearer /, ""),
    );
    res.clearCookie("im_refresh", options);
    res.status(204).end();
  });
  router.use(requireAuth(service));
  router.get("/me", async (_req, res) =>
    res.json(await service.me(res.locals.profile as Profile)),
  );
  router.put("/me/tour", async (req, res) =>
    res.json(
      await service.setTourVersion(
        (res.locals.profile as Profile).id,
        tourSchema.parse(req.body).version,
      ),
    ),
  );
  // Vocabulaire métier servi par le backend pour que l'interface ne le redéclare pas.
  router.get("/reference", (_req, res) => {
    res.json({
      sectors,
      jobs,
      pay_units: payUnits,
      mission_statuses: missionStatuses,
      application_statuses: applicationStatuses,
    });
  });
  router.get("/skills", async (_req, res) =>
    res.json(
      (await service.db.query("SELECT id,name FROM skills ORDER BY name")).rows,
    ),
  );
  if (workers) router.use(workerRouter(service, workers));
  if (missions) router.use(missionRouter(missions));
  if (applications) router.use(applicationRouter(applications));
  if (contracts) router.use(contractRouter(contracts));
  router.get("/companies/me", requireRole("company"), async (_req, res) =>
    res.json(await service.me(res.locals.profile as Profile)),
  );
  // Compatibilité : ancienne route de l'onboarding en une seule fois. Elle ne
  // porte aucune logique propre, elle délègue au service intérimaire. Les
  // latitude/longitude éventuellement transmises sont ignorées : les coordonnées
  // sont désormais dérivées du géocodage serveur.
  if (workers)
    router.put(
      "/onboarding/worker",
      requireRole("worker"),
      async (req, res) => {
        const input = workerSchema.parse(req.body);
        const id = (res.locals.profile as Profile).id;
        await workers.replaceAll(id, {
          first_name: input.first_name,
          last_name: input.last_name,
          city: input.city,
          postal_code: input.postal_code,
          main_job: input.main_job,
          mobility_radius_km: input.mobility_radius_km,
          skill_ids: input.skill_ids,
          experiences: input.experiences,
          availabilities: input.availabilities.map((a) => ({
            ...a,
            status: "available" as const,
          })),
        });
        res.json(await service.me(await service.reload(id)));
      },
    );
  router.put(
    "/onboarding/company",
    requireRole("company"),
    async (req, res) => {
      await service.onboardCompany(
        (res.locals.profile as Profile).id,
        companySchema.parse(req.body),
      );
      res.json(
        await service.me(
          await service.reload((res.locals.profile as Profile).id),
        ),
      );
    },
  );
  return router;
}
