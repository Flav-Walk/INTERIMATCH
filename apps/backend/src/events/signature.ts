import { createHmac, timingSafeEqual } from "node:crypto";

/** Signature hexadécimale commune aux échanges serveur-à-serveur avec n8n. */
export function hmacSha256(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Compare une signature sans branche dépendant de son contenu. */
export function validHmacSha256(
  secret: string,
  value: string,
  signature: string | undefined,
) {
  if (!signature?.startsWith("sha256=")) return false;
  const received = signature.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = hmacSha256(secret, value);
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}
