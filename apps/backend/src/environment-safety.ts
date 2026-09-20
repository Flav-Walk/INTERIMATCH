import { resolve, relative, isAbsolute } from "node:path";
import type { Config } from "./config.js";

/**
 * Les domaines `.test` sont réservés aux essais (RFC 2606) et ne représentent
 * jamais un compte utilisateur de production InteriMatch.
 */
export function isReservedTestEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@").at(-1) ?? "";
  return domain === "test" || domain.endsWith(".test");
}

/** Une URL PostgreSQL locale, sans exposer son contenu dans les erreurs. */
export function isLocalDatabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Les scripts qui fabriquent des comptes ou missions fictifs ne peuvent viser
 * qu'un PostgreSQL de la machine. NODE_ENV seul n'est pas une frontière : un
 * shell local peut parfaitement contenir l'URL de la base distante.
 */
export function assertLocalDataTarget(config: Config, operation: string) {
  if (
    config.NODE_ENV === "production" ||
    !isLocalDatabaseUrl(config.DATABASE_URL)
  )
    throw new Error(
      `${operation} refusé : une base PostgreSQL locale est obligatoire.`,
    );
}

/** Le fichier appartient-il aux fixtures France Travail versionnées ? */
export function isBundledPublicDataFixture(filePath: string, cwd = process.cwd()) {
  const fixtureRoot = resolve(cwd, "src/public-data/fixtures");
  const target = resolve(cwd, filePath);
  const fromRoot = relative(fixtureRoot, target);
  return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}

/**
 * Un import distant est une opération de production explicite. Une fixture
 * versionnée, ou un shell de développement pointant vers le distant, est refusé.
 */
export function assertPublicDataImportTarget(
  config: Config,
  filePath: string,
  cwd = process.cwd(),
) {
  const local = isLocalDatabaseUrl(config.DATABASE_URL);
  if (isBundledPublicDataFixture(filePath, cwd) && !local)
    throw new Error(
      "Import de fixture refusé : une base PostgreSQL locale est obligatoire.",
    );
  if (config.NODE_ENV !== "production" && !local)
    throw new Error(
      "Import distant refusé depuis un environnement non-production.",
    );
}
