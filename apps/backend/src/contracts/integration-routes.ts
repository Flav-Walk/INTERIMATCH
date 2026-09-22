import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { validHmacSha256 } from "../events/signature.js";
import type { ContractService } from "./service.js";

export const N8N_DOCUMENT_SIGNATURE_TTL_SECONDS = 300;

/** Chaîne canonique à signer par n8n pour chaque téléchargement. */
export const documentRequestSignatureValue = (
  timestamp: string,
  method: string,
  originalUrl: string,
) => `${timestamp}.${method.toUpperCase()}.${originalUrl}`;

export function n8nDocumentRouter(
  contracts: ContractService,
  secret: string,
  now: () => number = Date.now,
) {
  const router = Router();
  const signed: RequestHandler = (req, _res, next) => {
    const timestamp = req.header("x-interimatch-timestamp");
    const signature = req.header("x-interimatch-signature");
    const seconds = timestamp && /^\d{10}$/.test(timestamp)
      ? Number(timestamp)
      : Number.NaN;
    const age = Math.abs(Math.floor(now() / 1_000) - seconds);
    if (
      !Number.isFinite(seconds) ||
      age > N8N_DOCUMENT_SIGNATURE_TTL_SECONDS ||
      !validHmacSha256(
        secret,
        documentRequestSignatureValue(timestamp ?? "", req.method, req.originalUrl),
        signature,
      )
    )
      return next(
        new HttpError(
          401,
          "INVALID_N8N_SIGNATURE",
          "Signature serveur invalide ou expirée.",
        ),
      );
    next();
  };

  router.get(
    "/integrations/n8n/documents/:contractId/deliveries/:deliveryId",
    signed,
    async (req, res) => {
      const identifier = z.uuid();
      const file = await contracts.downloadForDelivery(
        identifier.parse(req.params.contractId),
        identifier.parse(req.params.deliveryId),
      );
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Content-Length": String(file.bytes.byteLength),
      });
      res.send(Buffer.from(file.bytes));
    },
  );
  return router;
}
