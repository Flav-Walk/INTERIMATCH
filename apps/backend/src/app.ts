import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import cookieParser from "cookie-parser";
import { AccountService } from "./auth/service.js";
import { accountRouter } from "./auth/routes.js";
import type { WorkerService } from "./worker/service.js";
import type { MissionService } from "./missions/service.js";
import type { AdminService } from "./admin/service.js";
import { adminRouter } from "./admin/routes.js";
import type { ApplicationService } from "./applications/service.js";
import type { PublicJobOfferService } from "./public-data/service.js";
import { publicJobOffersRouter } from "./public-data/routes.js";
import type { MissionMediaService } from "./media/service.js";
import type { ContractService } from "./contracts/service.js";
import { n8nDocumentRouter } from "./contracts/integration-routes.js";
import { missionMediaRouter } from "./media/routes.js";
import { requireAuth, requireRole } from "./auth/routes.js";
import { HttpError } from "./errors.js";
/**
 * Message d'une requête refusée à la validation. Nommer les champs fautifs rend
 * l'erreur exploitable par l'interface ; les noms de champs font déjà partie du
 * contrat d'API public, contrairement aux libellés internes de la bibliothèque
 * de validation, qui ne sont pas traduits.
 *
 * Une règle portant sur l'objet entier — « Aucune modification transmise. »,
 * « Un véhicule suppose le permis. » — n'a aucun chemin de champ à nommer. Son
 * message est alors repris tel quel : nous l'avons écrit nous-mêmes, en
 * français, et il dit à l'appelant ce qu'aucun nom de champ ne dirait. Seules
 * les règles `custom` sont reprises ; les messages internes de la bibliothèque,
 * eux, restent hors de la réponse.
 */
function invalidRequestMessage(err: unknown) {
  if (!(err instanceof ZodError)) return "Requête invalide.";
  const fields = [
    ...new Set(
      err.issues
        .map((issue) =>
          issue.path.filter((p) => typeof p === "string").join("."),
        )
        .filter(Boolean),
    ),
  ].slice(0, 4);
  if (fields.length) return `Donnée invalide : ${fields.join(", ")}.`;
  const rule = err.issues.find(
    (issue) => issue.code === "custom" && issue.message,
  );
  return rule ? rule.message : "Requête invalide.";
}

/** Code d'erreur technique court et sans donnée : ENETUNREACH, 23505, ECONNRESET… */
function shortErrorCode(err: unknown) {
  if (typeof err !== "object" || err === null || !("code" in err))
    return undefined;
  const code = (err as { code: unknown }).code;
  if (typeof code !== "string" && typeof code !== "number") return undefined;
  const text = String(code);
  return /^[A-Za-z0-9_]{1,32}$/.test(text) ? text : undefined;
}

export function createApp(
  config: Config,
  accounts?: AccountService,
  workers?: WorkerService,
  missions?: MissionService,
  admin?: AdminService,
  applications?: ApplicationService,
  publicOffers?: PublicJobOfferService,
  missionMedia?: MissionMediaService,
  contracts?: ContractService,
) {
  const app = express();
  const logger = pino({
    level: config.NODE_ENV === "test" ? "silent" : "info",
  });
  app.disable("x-powered-by");
  // Doit être posé avant tout middleware dépendant de l'IP cliente — le limiteur en
  // premier — car req.ip en dépend. On ne pose le réglage que s'il y a réellement un
  // proxy : laisser la valeur Express par défaut (false) permet à express-rate-limit
  // de continuer à signaler un X-Forwarded-For inattendu si la topologie change.
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);
  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    const started = Date.now();
    res.on("finish", () =>
      logger.info(
        {
          requestId,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - started,
        },
        "http_request",
      ),
    );
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
      exposedHeaders: ["X-Request-Id"],
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Trop de requêtes.",
            request_id: res.locals.requestId,
          },
        });
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  /**
   * Rien de ce que sert cette API n'est mutualisable : chaque réponse dépend de
   * la session qui l'a demandée. Sans en-tête explicite, Express n'envoyait
   * qu'un ETag, ce qui autorise navigateurs et intermédiaires à conserver et à
   * resservir une réponse — donc à montrer à un utilisateur un état périmé, ou
   * pire, celui d'un autre. `no-store` l'interdit ; l'ETag devient alors inutile.
   */
  app.set("etag", false);
  app.use("/api/v1", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api/v1", healthRouter);
  app.use(cookieParser());
  // Accès serveur-à-serveur : pas de session utilisateur, mais une signature
  // HMAC fraîche liée exactement au chemin contrat/livraison demandé.
  if (contracts && config.N8N_WEBHOOK_SECRET)
    app.use(
      "/api/v1",
      n8nDocumentRouter(contracts, config.N8N_WEBHOOK_SECRET),
    );
  // Le catalogue appartient à l'espace intérimaire. Le protéger ici, et pas
  // seulement dans React, empêche un appel direct anonyme ou entreprise.
  if (accounts && publicOffers)
    app.use(
      "/api/v1/public-job-offers",
      requireAuth(accounts),
      requireRole("worker"),
      publicJobOffersRouter(publicOffers),
    );
  // Photos de mission, sur leur PROPRE chemin.
  //
  // Jamais sur le préfixe `/api/v1` : `app.use(prefixe, mw, routeur)` exécute
  // `mw` pour toute requête commençant par ce préfixe, pas seulement pour les
  // chemins du routeur. Un garde posé là exigerait une session pour atteindre
  // `/auth/login`, et rendrait l'application entière inaccessible.
  if (accounts && missionMedia)
    app.use(
      "/api/v1/company/media",
      requireAuth(accounts),
      requireRole("company"),
      missionMediaRouter(missionMedia),
    );
  if (accounts && admin)
    app.use("/api/v1/admin", requireAuth(accounts), adminRouter(admin));
  if (accounts)
    app.use(
      "/api/v1",
      accountRouter(
        config,
        accounts,
        workers,
        missions,
        applications,
        contracts,
      ),
    );
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route introuvable.",
        request_id: res.locals.requestId,
      },
    });
  });
  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    void _next; // Express identifies error middleware by its four arguments.
    const malformed =
      err instanceof SyntaxError && "status" in err && err.status === 400;
    const tooLarge =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      err.status === 413;
    const status =
      err instanceof HttpError
        ? err.status
        : tooLarge
          ? 413
          : malformed || err instanceof ZodError
            ? 400
            : 500;
    const code =
      err instanceof HttpError
        ? err.code
        : status === 413
          ? "PAYLOAD_TOO_LARGE"
          : status === 400
            ? "INVALID_REQUEST"
            : "INTERNAL_ERROR";
    // Le code et l'origine rendent un refus diagnosticable depuis les logs de
    // production sans exposer de corps, d'en-tête d'autorisation ni de secret.
    // Une 500 reste anormale : on garde le nom de l'erreur, jamais sa pile.
    logger.error(
      {
        requestId: res.locals.requestId,
        status,
        code,
        method: req.method,
        path: req.path,
        origin: req.headers.origin,
        detail: err instanceof HttpError ? err.detail : undefined,
        cause: status === 500 && err instanceof Error ? err.name : undefined,
        // Les codes courts des erreurs d'infrastructure (ENETUNREACH, 23505…)
        // situent une panne sans rien révéler de la requête ni du code. Le
        // message et la pile, eux, restent hors des journaux de production.
        errorCode: status === 500 ? shortErrorCode(err) : undefined,
      },
      "request_failed",
    );
    res.status(status).json({
      error: {
        code,
        message:
          err instanceof HttpError
            ? err.message
            : status === 500
              ? "Erreur interne."
              : invalidRequestMessage(err),
        request_id: res.locals.requestId,
      },
    });
  };
  app.use(errorHandler);
  return app;
}
