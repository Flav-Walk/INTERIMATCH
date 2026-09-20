import { describe, expect, it } from "vitest";
import { readConfig } from "./config.js";
import {
  assertLocalDataTarget,
  assertPublicDataImportTarget,
  isBundledPublicDataFixture,
  isLocalDatabaseUrl,
  isReservedTestEmail,
} from "./environment-safety.js";

const config = (database: string, environment = "development") =>
  readConfig({ NODE_ENV: environment, DATABASE_URL: database });

describe("séparation des environnements de données", () => {
  it("reconnaît uniquement les identités réservées aux tests", () => {
    expect(isReservedTestEmail("qa.company@example.test")).toBe(true);
    expect(isReservedTestEmail("worker@subdomain.test")).toBe(true);
    expect(isReservedTestEmail("person@example.com")).toBe(false);
    expect(isReservedTestEmail("person@interimatch.fr")).toBe(false);
  });

  it("n'accepte comme cible de seed que PostgreSQL en boucle locale", () => {
    expect(isLocalDatabaseUrl("postgres://user:secret@localhost:5432/app")).toBe(
      true,
    );
    expect(isLocalDatabaseUrl("postgresql://user:secret@127.0.0.1/app")).toBe(
      true,
    );
    expect(isLocalDatabaseUrl("postgres://user:secret@db.example.test/app")).toBe(
      false,
    );
    expect(() =>
      assertLocalDataTarget(
        config("postgres://user:secret@db.example.test/app"),
        "Seed",
      ),
    ).toThrow("base PostgreSQL locale");
    expect(() =>
      assertLocalDataTarget(
        config("postgres://user:secret@localhost/app", "production"),
        "Seed",
      ),
    ).toThrow("base PostgreSQL locale");
    expect(() =>
      assertLocalDataTarget(
        config("postgres://user:secret@localhost/app"),
        "Seed",
      ),
    ).not.toThrow();
  });

  it("identifie les fixtures publiques sans confondre un chemin voisin", () => {
    expect(
      isBundledPublicDataFixture(
        "src/public-data/fixtures/offres_france_travail.json",
        "C:/repo",
      ),
    ).toBe(true);
    expect(
      isBundledPublicDataFixture(
        "src/public-data/fixtures-other/offres.json",
        "C:/repo",
      ),
    ).toBe(false);
  });

  it("interdit une fixture ou un shell de développement sur une base distante", () => {
    const remote = config("postgres://user:secret@db.example.test/app");
    expect(() =>
      assertPublicDataImportTarget(
        remote,
        "src/public-data/fixtures/offres_france_travail.json",
        "C:/repo",
      ),
    ).toThrow("fixture refusé");
    expect(() =>
      assertPublicDataImportTarget(remote, "C:/exports/offres.json", "C:/repo"),
    ).toThrow("Import distant refusé");
    expect(() =>
      assertPublicDataImportTarget(
        config("postgres://user:secret@db.example.test/app", "production"),
        "C:/exports/offres.json",
        "C:/repo",
      ),
    ).not.toThrow();
  });
});
