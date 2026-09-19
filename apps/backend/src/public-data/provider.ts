import { readFile } from "node:fs/promises";

export interface FranceTravailProvider {
  fetchOffers(options?: {
    query?: string;
    location?: string;
  }): Promise<unknown>;
}

export class FixtureFranceTravailProvider implements FranceTravailProvider {
  constructor(private readonly fixturePathOrData: string | unknown) {}

  async fetchOffers(): Promise<unknown> {
    if (typeof this.fixturePathOrData === "string") {
      const content = await readFile(this.fixturePathOrData, "utf8");
      return JSON.parse(content);
    }
    return this.fixturePathOrData;
  }
}

export interface ApiFranceTravailConfig {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  tokenUrl?: string;
  apiUrl?: string;
}

export class ApiFranceTravailProvider implements FranceTravailProvider {
  constructor(private readonly config: ApiFranceTravailConfig = {}) {}

  async fetchOffers(options?: {
    query?: string;
    location?: string;
  }): Promise<unknown> {
    void options;
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(
        "Identifiants API France Travail non configurés (FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET requis).",
      );
    }
    throw new Error(
      "Intégration directe API France Travail en ligne réservée à l'environnement avec credentials vérifiés.",
    );
  }
}
