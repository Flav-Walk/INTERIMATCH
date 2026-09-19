import { beforeAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { PublicJobOfferService } from "./service.js";
import { AccountService } from "../auth/service.js";

const FIXTURE_1_PATH = "src/public-data/fixtures/offres_france_travail.json";
const FIXTURE_10_PATH =
  "src/public-data/fixtures/offres_france_travail_10.json";

describe("PublicJobOfferService & API", () => {
  const pg = new PGlite();
  const db: Db = {
    query: (sql, values) => pg.query(sql, values),
    transaction: (work) =>
      pg.transaction((tx) =>
        work({
          query: (sql, values) => tx.query(sql, values),
          transaction: () => {
            throw new Error("nested");
          },
        }),
      ),
  };

  const service = new PublicJobOfferService(db);
  const accounts = new AccountService(db);
  let workerToken = "";
  let companyToken = "";
  const app = createApp(
    readConfig({
      NODE_ENV: "test",
      RATE_LIMIT: "1000",
      AUTH_RATE_LIMIT: "1000",
    }),
    accounts,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
  );

  beforeAll(async () => {
    for (const name of (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      await pg.exec(await readFile("migrations/" + name, "utf8"));
    }
    workerToken = (
      await accounts.register(
        "public-data-worker@example.test",
        "Public-data-test-password-42!",
      )
    ).access_token;
    await db.query(
      "INSERT INTO company_accounts(email,label) VALUES($1,'test')",
      ["public-data-company@example.test"],
    );
    companyToken = (
      await accounts.register(
        "public-data-company@example.test",
        "Public-data-test-password-42!",
      )
    ).access_token;
  }, 30000);

  const authenticated = (path: string) =>
    request(app).get(path).set("Authorization", `Bearer ${workerToken}`);

  it("importe la fixture 1 offre avec succès", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_1_PATH, "utf8"));
    const summary = await service.importFromPayload(raw);

    expect(summary).toEqual({
      received: 1,
      accepted: 1,
      rejected: 0,
      created: 1,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      errors: [],
    });

    const list = await service.list();
    expect(list.total).toBe(1);
    expect(list.offers[0].external_id).toBe("5968295");
    expect(list.offers[0].title).toBe("Maître d'hôtel évènementiel (H/F)");
  });

  it("importe la fixture 10 offres en respectant les existants (dédoublonnage et idempotence)", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_10_PATH, "utf8"));
    const summary = await service.importFromPayload(raw);

    // 10 offres réelles dans la fixture 10 offres, dont 1 déjà présente (l'offre 5968295)
    expect(summary.received).toBe(10);
    expect(summary.accepted).toBe(10);
    expect(summary.rejected).toBe(0);
    expect(summary.created).toBe(9);
    expect(summary.updated).toBe(0);
    expect(summary.unchanged).toBe(1);
    expect(summary.duplicates).toBe(0);

    const list = await service.list();
    expect(list.total).toBe(10);
  });

  it("garantit une idempotence stricte lors d'un ré-import identique (cas S)", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_10_PATH, "utf8"));
    const summary = await service.importFromPayload(raw);

    expect(summary.received).toBe(10);
    expect(summary.accepted).toBe(10);
    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.unchanged).toBe(10);
    expect(summary.duplicates).toBe(0);

    const list = await service.list();
    expect(list.total).toBe(10);
  });

  it("met à jour une offre existante lorsqu'une modification intervient (cas T)", async () => {
    const modifiedPayload = [
      {
        id: "5968295",
        intitule: "Maître d'hôtel événementiel VIP (H/F)",
        description: "Description mise à jour avec nouvelles responsabilités.",
        dateCreation: "2026-08-14T03:29:27.328Z",
        dateActualisation: "2026-09-19T10:00:00.000Z",
        romeCode: "G1802",
        romeLibelle: "Maître d'hôtel",
        typeContrat: "MIS",
        lieuTravail: {
          libelle: "69 - Lyon 5e",
          codePostal: "69005",
        },
      },
    ];

    const summary = await service.importFromPayload(modifiedPayload);
    expect(summary.received).toBe(1);
    expect(summary.accepted).toBe(1);
    expect(summary.created).toBe(0);
    expect(summary.updated).toBe(1);
    expect(summary.unchanged).toBe(0);

    const updated = await service.getById("5968295");
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Maître d'hôtel événementiel VIP (H/F)");
    expect(updated?.description).toBe(
      "Description mise à jour avec nouvelles responsabilités.",
    );
  });

  it("gère les doublons dans un même lot et les offres invalides (cas J & O)", async () => {
    const batchWithDupesAndErrors = [
      { id: "DUPE_1", intitule: "Serveur Test 1" },
      { id: "DUPE_1", intitule: "Serveur Test 1 (doublon dans le même lot)" },
      { intitule: "Offre sans ID" }, // Invalide
      { id: "INVALID_2" }, // Sans intitulé
    ];

    const summary = await service.importFromPayload(batchWithDupesAndErrors);
    expect(summary.received).toBe(4);
    expect(summary.accepted).toBe(1);
    expect(summary.rejected).toBe(2);
    expect(summary.duplicates).toBe(1);
    expect(summary.created).toBe(1);
  });

  it("conserve la version la plus récente d'un doublon intra-lot", async () => {
    const summary = await service.importFromPayload([
      {
        id: " DEDUPE_RECENT ",
        intitule: "Version récente",
        dateActualisation: "2026-09-20T00:00:00Z",
      },
      {
        id: "DEDUPE_RECENT",
        intitule: "Version obsolète placée après",
        dateActualisation: "2026-09-19T00:00:00Z",
      },
    ]);
    expect(summary).toMatchObject({
      received: 2,
      accepted: 1,
      duplicates: 1,
      created: 1,
    });
    expect((await service.getById("DEDUPE_RECENT"))?.title).toBe(
      "Version récente",
    );
  });

  it("n'écrase pas une version datée par une version ultérieure non datée", async () => {
    await service.importFromPayload([
      {
        id: "DATED_THEN_UNDATED",
        intitule: "Version datée",
        dateActualisation: "2026-09-20T00:00:00Z",
      },
    ]);

    const summary = await service.importFromPayload([
      { id: "DATED_THEN_UNDATED", intitule: "Version sans date" },
    ]);

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });
    expect((await service.getById("DATED_THEN_UNDATED"))?.title).toBe(
      "Version datée",
    );
  });

  it("n'écrase pas une version datée avec une date calendrier impossible", async () => {
    await service.importFromPayload([
      {
        id: "DATED_THEN_INVALID_DATE",
        intitule: "Version datée",
        dateActualisation: "2026-03-01T00:00:00Z",
      },
    ]);

    const summary = await service.importFromPayload([
      {
        id: "DATED_THEN_INVALID_DATE",
        intitule: "Version à date impossible",
        dateActualisation: "2026-02-30T00:00:00Z",
      },
    ]);

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });
    expect((await service.getById("DATED_THEN_INVALID_DATE"))?.title).toBe(
      "Version datée",
    );
  });

  it("garde la casse des identifiants France Travail significative", async () => {
    const summary = await service.importFromPayload([
      { id: "Case-ID", intitule: "Majuscules" },
      { id: "case-id", intitule: "Minuscules" },
    ]);
    expect(summary).toMatchObject({ accepted: 2, duplicates: 0, created: 2 });
  });

  it("sérialise deux imports concurrents de la même nouvelle offre", async () => {
    const payload = [
      {
        id: "CONCURRENT_CREATE",
        intitule: "Import concurrent",
        dateActualisation: "2026-09-19T12:00:00Z",
      },
    ];
    const outcomes = await Promise.all([
      service.importFromPayload(payload),
      service.importFromPayload(payload),
    ]);
    expect(outcomes.map((item) => item.created).sort()).toEqual([0, 1]);
    expect(outcomes.map((item) => item.unchanged).sort()).toEqual([0, 1]);
    expect((await service.list({ search: "Import concurrent" })).total).toBe(1);
  });

  it("importe les offres valides d'un lot et rejette seulement la ligne invalide", async () => {
    const summary = await service.importFromPayload([
      { id: "PARTIAL_A", intitule: "Valide A" },
      { id: "PARTIAL_B" },
      { id: "PARTIAL_C", intitule: "Valide C" },
    ]);
    expect(summary).toMatchObject({
      received: 3,
      accepted: 2,
      rejected: 1,
      created: 2,
    });
    expect(await service.getById("PARTIAL_A")).not.toBeNull();
    expect(await service.getById("PARTIAL_C")).not.toBeNull();
  });

  it("refuse un conteneur ambigu au lieu d'annoncer un import vide", async () => {
    await expect(service.importFromPayload({})).rejects.toThrow(/Structure/);
    await expect(service.importFromPayload({ resultats: {} })).rejects.toThrow(
      /tableau/,
    );
  });

  it("filtre les offres par recherche textuelle", async () => {
    const res = await authenticated("/api/v1/public-job-offers")
      .query({ search: "barman" })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.offers[0].external_id).toBe("5026092");
    expect(res.body.offers[0].title).toBe("BARMAN (H/F)");
  });

  it.each(["%", "_", "'"])(
    "traite le filtre %s comme du texte et non comme du SQL",
    async (search) => {
      const res = await authenticated("/api/v1/public-job-offers")
        .query({ search })
        .expect(200);
      for (const offer of res.body.offers as Array<Record<string, unknown>>) {
        const searchable = [
          offer.title,
          offer.description,
          offer.company_name,
          offer.rome_label,
        ]
          .filter((value): value is string => typeof value === "string")
          .join(" ");
        expect(searchable).toContain(search);
      }
      if (search === "_") expect(res.body.total).toBe(0);
    },
  );

  it("recherche sans perdre les accents ni la casse", async () => {
    const res = await authenticated("/api/v1/public-job-offers")
      .query({ search: "Maître" })
      .expect(200);
    expect(
      res.body.offers.some(
        (offer: { external_id: string }) => offer.external_id === "5968295",
      ),
    ).toBe(true);
  });

  it("filtre les offres par code ROME", async () => {
    const res = await authenticated("/api/v1/public-job-offers")
      .query({ rome: "G1803" })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.offers[0].external_id).toBe("213HXKM");
  });

  it("filtre les offres par localisation (code postal / commune)", async () => {
    const res = await authenticated("/api/v1/public-job-offers")
      .query({ location: "69002" })
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.offers[0].postal_code).toBe("69002");
  });

  it("prend en charge la pagination", async () => {
    const page1 = await authenticated("/api/v1/public-job-offers")
      .query({ page: 1, limit: 3 })
      .expect(200);

    expect(page1.body.offers).toHaveLength(3);
    expect(page1.body.page).toBe(1);
    expect(page1.body.limit).toBe(3);
    expect(page1.body.total_pages).toBeGreaterThanOrEqual(4);

    const page2 = await authenticated("/api/v1/public-job-offers")
      .query({ page: 2, limit: 3 })
      .expect(200);

    expect(page2.body.offers).toHaveLength(3);
    expect(page2.body.page).toBe(2);
    expect(page2.body.offers[0].id).not.toBe(page1.body.offers[0].id);
  });

  it("renvoie une pagination vide sans page fantôme", async () => {
    const empty = await authenticated("/api/v1/public-job-offers")
      .query({ search: "aucun-résultat-impossible" })
      .expect(200);
    expect(empty.body).toMatchObject({
      offers: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it.each([
    [{ page: 0 }, 400],
    [{ page: -1 }, 400],
    [{ page: "abc" }, 400],
    [{ limit: 0 }, 400],
    [{ limit: -1 }, 400],
    [{ limit: 101 }, 400],
  ] as const)("valide la pagination %j", async (query, status) => {
    await authenticated("/api/v1/public-job-offers")
      .query(query)
      .expect(status);
  });

  it("récupère le détail d'une offre par UUID et par identifiant externe", async () => {
    const listRes = await authenticated("/api/v1/public-job-offers").expect(
      200,
    );
    const firstOffer = listRes.body.offers[0];

    // Par UUID
    const byUuid = await authenticated(
      `/api/v1/public-job-offers/${firstOffer.id}`,
    ).expect(200);
    expect(byUuid.body.id).toBe(firstOffer.id);
    expect(byUuid.body.title).toBe(firstOffer.title);

    // Par external_id
    const byExternalId = await authenticated(
      `/api/v1/public-job-offers/${firstOffer.external_id}`,
    ).expect(200);
    expect(byExternalId.body.id).toBe(firstOffer.id);
    expect(byExternalId.body.external_id).toBe(firstOffer.external_id);
  });

  it("résout un external_id syntaxiquement UUID si aucun UUID interne ne correspond", async () => {
    const externalId = "00000000-0000-4000-8000-000000000777";
    await service.importFromPayload([
      { id: externalId, intitule: "UUID externe" },
    ]);
    const response = await authenticated(
      `/api/v1/public-job-offers/${externalId}`,
    ).expect(200);
    expect(response.body.external_id).toBe(externalId);
    expect(response.body.title).toBe("UUID externe");
  });

  it("décode les caractères spéciaux d'un external_id dans l'URL", async () => {
    const externalId = "ID spécial/été";
    await service.importFromPayload([{ id: externalId, intitule: "Encodée" }]);
    const response = await authenticated(
      `/api/v1/public-job-offers/${encodeURIComponent(externalId)}`,
    ).expect(200);
    expect(response.body.external_id).toBe(externalId);
  });

  it("renvoie une 404 pour un identifiant inconnu", async () => {
    const res = await authenticated(
      "/api/v1/public-job-offers/unknown-id-123456",
    ).expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Offre publique introuvable.");
  });

  it("réserve les routes aux workers authentifiés", async () => {
    await request(app).get("/api/v1/public-job-offers").expect(401);
    const forbidden = await request(app)
      .get("/api/v1/public-job-offers")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });
});
