import "dotenv/config";
import { readFile } from "node:fs/promises";
import { readConfig } from "../config.js";
import { createDatabase } from "../db.js";
import { PublicJobOfferService } from "../public-data/service.js";
import { extractRawOffers } from "../public-data/normalizer.js";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run data:france-travail -- <path-to-json-file>");
    process.exit(1);
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Erreur: Impossible de lire le fichier '${filePath}': ${message}`,
    );
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error(
      `Erreur: Le fichier '${filePath}' ne contient pas un JSON valide.`,
    );
    process.exit(1);
  }

  // Valider l'enveloppe avant d'ouvrir une connexion. Un fichier JSON valide
  // mais sans structure France Travail ne doit ni être annoncé comme un lot
  // vide, ni provoquer une connexion inutile à la base configurée.
  try {
    extractRawOffers(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Structure invalide";
    console.error(`Erreur: ${message}`);
    process.exit(1);
  }

  const config = readConfig(process.env);
  const db = createDatabase(config);
  const service = new PublicJobOfferService(db);

  try {
    const summary = await service.importFromPayload(parsed);

    console.info("France Travail import");
    console.info("---------------------");
    console.info(`Received: ${summary.received}`);
    console.info(`Accepted: ${summary.accepted}`);
    console.info(`Rejected: ${summary.rejected}`);
    console.info(`Created: ${summary.created}`);
    console.info(`Updated: ${summary.updated}`);
    console.info(`Unchanged: ${summary.unchanged}`);
    console.info(`Duplicates: ${summary.duplicates}`);

    if (summary.errors && summary.errors.length > 0) {
      console.info("\nDétail des rejets :");
      for (const err of summary.errors) {
        console.info(
          `  - Offre #${err.index + 1}${err.external_id ? ` (${err.external_id})` : ""} : ${err.reason}`,
        );
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inattendue";
    console.error(`Erreur lors de l'import : ${message}`);
    process.exit(1);
  } finally {
    await db.close();
  }
}

void main();
