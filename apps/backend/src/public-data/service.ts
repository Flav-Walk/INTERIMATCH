import type { Db } from "../db.js";
import { extractRawOffers, normalizeFranceTravailOffer } from "./normalizer.js";
import type { FranceTravailProvider } from "./provider.js";
import type {
  ImportSummary,
  PaginatedPublicJobOffers,
  PublicJobOfferDto,
  PublicJobOfferFilters,
  NormalizedPublicJobOffer,
} from "./types.js";

interface DbPublicJobOfferRow {
  id: string;
  source: string;
  external_id: string;
  title: string;
  description: string;
  rome_code: string;
  rome_label: string;
  company_name: string | null;
  contract_type: string;
  contract_label: string;
  experience_label: string | null;
  postal_code: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  salary_label: string | null;
  working_time: string | null;
  positions: number;
  skills: unknown;
  professional_qualities: unknown;
  source_url: string | null;
  created_at_source: Date | string | null;
  updated_at_source: Date | string | null;
  imported_at: Date | string;
  raw_checksum: string;
}

function mapRowToDto(row: DbPublicJobOfferRow): PublicJobOfferDto {
  const skills = Array.isArray(row.skills)
    ? (row.skills as Array<{ name: string; required: boolean }>)
    : [];
  const qualities = Array.isArray(row.professional_qualities)
    ? (row.professional_qualities as Array<{
        label: string;
        description?: string;
      }>)
    : [];

  return {
    id: row.id,
    source: row.source,
    external_id: row.external_id,
    title: row.title,
    description: row.description,
    rome_code: row.rome_code,
    rome_label: row.rome_label,
    company_name: row.company_name,
    contract_type: row.contract_type,
    contract_label: row.contract_label,
    experience_label: row.experience_label,
    postal_code: row.postal_code,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    salary_label: row.salary_label,
    working_time: row.working_time,
    positions: row.positions ?? 1,
    skills,
    professional_qualities: qualities,
    source_url: row.source_url,
    created_at_source:
      row.created_at_source instanceof Date
        ? row.created_at_source.toISOString()
        : (row.created_at_source ?? null),
    updated_at_source:
      row.updated_at_source instanceof Date
        ? row.updated_at_source.toISOString()
        : (row.updated_at_source ?? null),
    imported_at:
      row.imported_at instanceof Date
        ? row.imported_at.toISOString()
        : String(row.imported_at),
  };
}

export class PublicJobOfferService {
  constructor(public readonly db: Db) {}

  /**
   * Importe un ensemble d'offres France Travail à partir d'un payload brut
   * (JSON ou objet). Garantit la déduplication et l'idempotence stricte.
   */
  async importFromPayload(raw: unknown): Promise<ImportSummary> {
    const rawOffers = extractRawOffers(raw);
    const summary: ImportSummary = {
      received: rawOffers.length,
      accepted: 0,
      rejected: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      errors: [],
    };

    const byExternalId = new Map<
      string,
      { offer: NormalizedPublicJobOffer; index: number }
    >();

    for (let i = 0; i < rawOffers.length; i++) {
      const rawOffer = rawOffers[i];
      const res = normalizeFranceTravailOffer(rawOffer);

      if (!res.success) {
        summary.rejected++;
        summary.errors?.push({
          index: i,
          external_id: res.external_id,
          reason: res.error,
        });
        continue;
      }

      const offer = res.data;
      const previous = byExternalId.get(offer.external_id);
      if (previous) {
        summary.duplicates++;
        // Les identifiants France Travail sont sensibles à la casse, mais les
        // espaces périphériques ont déjà été retirés par le normaliseur. Si le
        // lot contient plusieurs versions, la date source la plus récente gagne.
        // À date égale ou absente, la dernière occurrence gagne : conserver la
        // première silencieusement pouvait figer une version obsolète.
        const timestamp = Date.parse(offer.updated_at_source ?? "");
        const previousTimestamp = Date.parse(
          previous.offer.updated_at_source ?? "",
        );
        if (
          (Number.isFinite(timestamp) ? timestamp : -Infinity) >=
          (Number.isFinite(previousTimestamp) ? previousTimestamp : -Infinity)
        )
          byExternalId.set(offer.external_id, { offer, index: i });
        continue;
      }
      byExternalId.set(offer.external_id, { offer, index: i });
      summary.accepted++;
    }

    for (const { offer } of byExternalId.values()) {
      const outcome = await this.upsertOffer(offer);
      summary[outcome]++;
    }

    return summary;
  }

  /**
   * Importe les offres depuis un provider abstrait (fixture ou API).
   */
  async importFromProvider(
    provider: FranceTravailProvider,
    options?: { query?: string; location?: string },
  ): Promise<ImportSummary> {
    const payload = await provider.fetchOffers(options);
    return this.importFromPayload(payload);
  }

  /**
   * Une seule instruction décide et écrit. Deux imports concurrents ne peuvent
   * donc plus franchir ensemble un SELECT « absent » puis se heurter au UNIQUE.
   * Une version source plus ancienne n'écrase jamais une version plus récente.
   */
  private async upsertOffer(
    o: NormalizedPublicJobOffer,
  ): Promise<"created" | "updated" | "unchanged"> {
    const result = await this.db.query<{ inserted: boolean }>(
      `INSERT INTO public_job_offers (
        source, external_id, title, description,
        rome_code, rome_label, company_name,
        contract_type, contract_label, experience_label,
        postal_code, city, latitude, longitude,
        salary_label, working_time, positions,
        skills, professional_qualities, source_url,
        created_at_source, updated_at_source, imported_at,
        raw_checksum
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        $18::jsonb, $19::jsonb, $20,
        $21, $22, now(),
        $23
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        rome_code = EXCLUDED.rome_code,
        rome_label = EXCLUDED.rome_label,
        company_name = EXCLUDED.company_name,
        contract_type = EXCLUDED.contract_type,
        contract_label = EXCLUDED.contract_label,
        experience_label = EXCLUDED.experience_label,
        postal_code = EXCLUDED.postal_code,
        city = EXCLUDED.city,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        salary_label = EXCLUDED.salary_label,
        working_time = EXCLUDED.working_time,
        positions = EXCLUDED.positions,
        skills = EXCLUDED.skills,
        professional_qualities = EXCLUDED.professional_qualities,
        source_url = EXCLUDED.source_url,
        created_at_source = EXCLUDED.created_at_source,
        updated_at_source = EXCLUDED.updated_at_source,
        imported_at = now(),
        raw_checksum = EXCLUDED.raw_checksum
      WHERE public_job_offers.raw_checksum IS DISTINCT FROM EXCLUDED.raw_checksum
        AND (
          public_job_offers.updated_at_source IS NULL
          OR (
            EXCLUDED.updated_at_source IS NOT NULL
            AND EXCLUDED.updated_at_source >= public_job_offers.updated_at_source
          )
        )
      RETURNING (xmax = 0) AS inserted`,
      [
        o.source,
        o.external_id,
        o.title,
        o.description,
        o.rome_code,
        o.rome_label,
        o.company_name,
        o.contract_type,
        o.contract_label,
        o.experience_label,
        o.postal_code,
        o.city,
        o.latitude,
        o.longitude,
        o.salary_label,
        o.working_time,
        o.positions,
        JSON.stringify(o.skills),
        JSON.stringify(o.professional_qualities),
        o.source_url,
        o.created_at_source,
        o.updated_at_source,
        o.raw_checksum,
      ],
    );
    if (!result.rows[0]) return "unchanged";
    return result.rows[0].inserted ? "created" : "updated";
  }

  /**
   * Récupère la liste paginée et filtrée des offres publiques externes.
   */
  async list(
    filters: PublicJobOfferFilters = {},
  ): Promise<PaginatedPublicJobOffers> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${escapeLike(filters.search)}%`);
      const idx = params.length;
      conditions.push(
        `(title ILIKE $${idx} ESCAPE '\\' OR description ILIKE $${idx} ESCAPE '\\' OR company_name ILIKE $${idx} ESCAPE '\\' OR rome_label ILIKE $${idx} ESCAPE '\\')`,
      );
    }

    if (filters.rome) {
      params.push(filters.rome);
      conditions.push(`rome_code = $${params.length}`);
    }

    if (filters.location) {
      params.push(`%${escapeLike(filters.location)}%`);
      const idx = params.length;
      conditions.push(
        `(postal_code ILIKE $${idx} ESCAPE '\\' OR city ILIKE $${idx} ESCAPE '\\')`,
      );
    }

    if (filters.contract_type) {
      params.push(filters.contract_type);
      conditions.push(`contract_type = $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countSql = `SELECT count(*)::int as total FROM public_job_offers WHERE ${whereClause}`;
    const total =
      (await this.db.query<{ total: number }>(countSql, params)).rows[0]
        ?.total ?? 0;

    const listSql = `
      SELECT
        id, source, external_id, title, description,
        rome_code, rome_label, company_name,
        contract_type, contract_label, experience_label,
        postal_code, city, latitude, longitude,
        salary_label, working_time, positions,
        skills, professional_qualities, source_url,
        created_at_source, updated_at_source, imported_at,
        raw_checksum
      FROM public_job_offers
      WHERE ${whereClause}
      ORDER BY updated_at_source DESC NULLS LAST, imported_at DESC, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const rows = (
      await this.db.query<DbPublicJobOfferRow>(listSql, [
        ...params,
        limit,
        offset,
      ])
    ).rows;

    const offers = rows.map(mapRowToDto);

    return {
      offers,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Récupère une offre publique par son identifiant interne (uuid) ou son identifiant externe.
   */
  async getById(idOrExternalId: string): Promise<PublicJobOfferDto | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrExternalId,
      );

    const sql = isUuid
      ? `SELECT * FROM public_job_offers
          WHERE id = $1::uuid OR (source = 'france_travail' AND external_id = $2)
          ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
          LIMIT 1`
      : `SELECT * FROM public_job_offers
          WHERE source = 'france_travail' AND external_id = $1 LIMIT 1`;
    const values = isUuid ? [idOrExternalId, idOrExternalId] : [idOrExternalId];
    const row = (await this.db.query<DbPublicJobOfferRow>(sql, values)).rows[0];
    return row ? mapRowToDto(row) : null;
  }
}

/** `%` et `_` sont des données utilisateur, pas des jokers implicites. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
