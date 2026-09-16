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
import { HttpError } from "./errors.js";
export function createApp(config: Config, accounts?: AccountService) {
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
      limit: 100,
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
  app.use("/api/v1", healthRouter);
  app.use(cookieParser());
  if (accounts) app.use("/api/v1", accountRouter(config, accounts));
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
        path: req.originalUrl,
        origin: req.headers.origin,
        detail: err instanceof HttpError ? err.detail : undefined,
        cause: status === 500 && err instanceof Error ? err.name : undefined,
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
              : "Requête invalide.",
        request_id: res.locals.requestId,
      },
    });
  };
  app.use(errorHandler);
  return app;
}
