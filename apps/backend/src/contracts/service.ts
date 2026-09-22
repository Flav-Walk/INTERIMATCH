import { createHash } from "node:crypto";
import type { Profile } from "../auth/schemas.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { generateContractPdf } from "./pdf.js";
import type {
  ContractNotification,
  ContractNotificationKind,
  ContractNotificationSender,
} from "./notification.js";
import type {
  ContractListItem,
  ContractRow,
  ContractSignatureEvent,
  ContractSnapshot,
} from "./schemas.js";
import type { ContractDocumentStore } from "./store.js";

const LEGAL_NOTICE =
  "Document contractuel de démonstration InteriMatch. Il reprend uniquement les données enregistrées dans le prototype et ne constitue pas, à lui seul, un contrat de travail juridiquement complet ni une signature électronique qualifiée.";

interface ContractLogger {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

interface SourceRow {
  application_id: string;
  application_status: string;
  accepted_at: Date | string;
  worker_id: string;
  worker_first_name: string;
  worker_last_name: string;
  worker_email: string;
  worker_phone: string | null;
  worker_city: string | null;
  worker_postal_code: string | null;
  company_id: string;
  company_first_name: string;
  company_last_name: string;
  company_email: string;
  legal_name: string | null;
  establishment_name: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_sector: string | null;
  mission_id: string;
  mission_status: string;
  mission_title: string;
  mission_description: string;
  mission_job: string;
  starts_at: Date | string;
  ends_at: Date | string;
  mission_address: string;
  mission_city: string;
  mission_postal_code: string;
  pay_amount: string | number | null;
  pay_unit: string | null;
  headcount: number;
}

interface DbContractRow
  extends Omit<
    ContractRow,
    | "worker_signed_at"
    | "company_signed_at"
    | "completed_at"
    | "created_at"
    | "updated_at"
  > {
  worker_signed_at: Date | string | null;
  company_signed_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DbSignatureEvent
  extends Omit<ContractSignatureEvent, "created_at"> {
  created_at: Date | string;
}

const iso = (value: Date | string) => new Date(value).toISOString();
const optionalIso = (value: Date | string | null) =>
  value === null ? null : iso(value);
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function mapContract(row: DbContractRow): ContractRow {
  return {
    ...row,
    worker_signed_at: optionalIso(row.worker_signed_at),
    company_signed_at: optionalIso(row.company_signed_at),
    completed_at: optionalIso(row.completed_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapSignature(row: DbSignatureEvent): ContractSignatureEvent {
  return { ...row, created_at: iso(row.created_at) };
}

export class ContractService {
  constructor(
    public readonly db: Db,
    private readonly store: ContractDocumentStore,
    private readonly notifications: ContractNotificationSender | undefined,
    private readonly frontendUrl: string,
    private readonly logger: ContractLogger,
  ) {}

  /** Point d'intégration post-commit : une panne documentaire ne remonte jamais
   * dans la décision métier déjà validée. */
  async onApplicationAccepted(applicationId: string) {
    this.logger.info(
      { application_id: applicationId },
      "contract.creation.requested",
    );
    try {
      const contract = await this.ensureForAcceptedApplication(applicationId);
      this.logger.info(
        {
          application_id: applicationId,
          contract_id: contract.id,
          status: contract.status,
        },
        "contract.creation.completed",
      );
      return contract;
    } catch (error) {
      this.logger.error(
        { application_id: applicationId, error_code: errorCode(error) },
        "contract.creation.failed",
      );
      return undefined;
    }
  }

  /** Rattrape les acceptations validées pendant une indisponibilité du module
   * documentaire. L'unicité application_id rend l'opération rejouable. */
  async reconcileAcceptedApplications(limit = 20) {
    const rows = await this.db.query<{ id: string }>(
      `SELECT a.id
         FROM applications a
         JOIN missions m ON m.id=a.mission_id
         LEFT JOIN contracts c ON c.application_id=a.id
        WHERE a.status='accepted' AND m.status <> 'cancelled' AND c.id IS NULL
        ORDER BY a.updated_at,a.id
        LIMIT $1`,
      [limit],
    );
    if (rows.rows.length)
      this.logger.info(
        { count: rows.rows.length },
        "contract.creation.reconciliation_started",
      );
    for (const row of rows.rows) await this.onApplicationAccepted(row.id);
  }

  /** Crée au plus un contrat, uniquement à partir de l'attribution persistée. */
  async ensureForAcceptedApplication(applicationId: string) {
    const contract = await this.db.transaction(async (db) => {
      const source = await this.loadSource(db, applicationId);
      if (source.application_status !== "accepted")
        throw new HttpError(
          409,
          "CONTRACT_REQUIRES_ACCEPTED_APPLICATION",
          "Un document ne peut être créé que pour une candidature acceptée.",
        );
      if (source.mission_status === "cancelled")
        throw new HttpError(
          409,
          "CONTRACT_MISSION_CANCELLED",
          "Aucun document ne peut être créé pour une mission annulée.",
        );
      const snapshot = this.snapshotOf(source);
      const inserted = await db.query<DbContractRow>(
        `INSERT INTO contracts(
           application_id,mission_id,worker_id,company_id,snapshot
         ) VALUES($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT(application_id) DO NOTHING
         RETURNING *`,
        [
          source.application_id,
          source.mission_id,
          source.worker_id,
          source.company_id,
          JSON.stringify(snapshot),
        ],
      );
      if (inserted.rows[0]) return mapContract(inserted.rows[0]);
      return this.byApplication(db, applicationId);
    });

    if (contract.status === "draft") await this.prepareOriginal(contract.id);
    return this.getInternal(contract.id);
  }

  async listFor(actor: Profile): Promise<ContractListItem[]> {
    if (actor.role !== "worker" && actor.role !== "company") return [];
    const column = actor.role === "worker" ? "worker_id" : "company_id";
    const rows = (
      await this.db.query<DbContractRow>(
        `SELECT * FROM contracts WHERE ${column}=$1 ORDER BY created_at DESC,id`,
        [actor.id],
      )
    ).rows.map(mapContract);
    return rows.map((row) => this.listItem(row));
  }

  async getFor(contractId: string, actor: Profile) {
    const contract = await this.getInternal(contractId);
    this.assertParty(contract, actor);
    const signatures = await this.signatures(contract.id);
    return this.detail(contract, signatures);
  }

  async sign(contractId: string, actor: Profile) {
    if (actor.role !== "worker" && actor.role !== "company")
      throw new HttpError(403, "FORBIDDEN", "Rôle non autorisé.");

    const signed = await this.db.transaction(async (db) => {
      const contract = await this.lock(db, contractId);
      this.assertParty(contract, actor);
      if (contract.status === "cancelled")
        throw new HttpError(
          409,
          "CONTRACT_CANCELLED",
          "Ce document a été annulé avec la mission.",
        );

      if (actor.role === "worker") {
        if (contract.worker_signed_at) return contract;
        if (contract.status !== "awaiting_worker_signature")
          throw new HttpError(
            409,
            "CONTRACT_NOT_READY",
            "Ce document n'est pas prêt à être validé.",
          );
        const updated = await this.transition(
          db,
          contract,
          actor,
          "worker_signed",
          "awaiting_company_signature",
          "worker_signed_at",
        );
        await this.enqueue(
          db,
          updated,
          "worker_signed",
          updated.snapshot.company.email,
        );
        return updated;
      }

      if (contract.company_signed_at) return contract;
      if (contract.status === "awaiting_worker_signature")
        throw new HttpError(
          409,
          "WORKER_SIGNATURE_REQUIRED",
          "La validation de l'intérimaire est requise en premier.",
        );
      if (contract.status !== "awaiting_company_signature")
        throw new HttpError(
          409,
          "CONTRACT_NOT_READY",
          "Ce document n'est pas prêt à être validé.",
        );
      return this.transition(
        db,
        contract,
        actor,
        "company_signed",
        "awaiting_finalization",
        "company_signed_at",
      );
    });

    this.logger.info(
      {
        contract_id: signed.id,
        actor_role: actor.role,
        status: signed.status,
      },
      "contract.signature.recorded",
    );

    if (signed.status === "awaiting_company_signature")
      await this.deliverForContract(signed.id);
    if (signed.status === "awaiting_finalization")
      return this.detail(
        await this.finalize(signed.id),
        await this.signatures(signed.id),
      );
    return this.detail(signed, await this.signatures(signed.id));
  }

  async download(contractId: string, actor: Profile) {
    const contract = await this.getInternal(contractId);
    this.assertParty(contract, actor);
    const path =
      contract.status === "completed"
        ? contract.final_file_path
        : contract.original_file_path;
    if (!path)
      throw new HttpError(
        409,
        "DOCUMENT_NOT_READY",
        "Le PDF est encore en préparation.",
      );
    return {
      bytes: await this.store.download(path),
      filename: `interimatch-document-${contract.id}.pdf`,
    };
  }

  /** Téléchargement réservé à une livraison n8n connue et rattachée au contrat.
   * L'authentification HMAC est vérifiée par le routeur avant cet appel. */
  async downloadForDelivery(contractId: string, deliveryId: string) {
    const row = (
      await this.db.query<{
        kind: ContractNotificationKind;
        original_file_path: string | null;
        final_file_path: string | null;
      }>(
        `SELECT d.kind,c.original_file_path,c.final_file_path
           FROM contract_email_deliveries d
           JOIN contracts c ON c.id=d.contract_id
          WHERE c.id=$1 AND d.id=$2`,
        [contractId, deliveryId],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document introuvable.");
    const path = row.kind.startsWith("contract_completed_")
      ? row.final_file_path
      : row.original_file_path;
    if (!path)
      throw new HttpError(
        409,
        "DOCUMENT_NOT_READY",
        "Le PDF est encore en préparation.",
      );
    return {
      bytes: await this.store.download(path),
      filename: `interimatch-document-${contractId}.pdf`,
    };
  }

  async retryPendingNotifications(limit = 20) {
    if (!this.notifications) return;
    // Un processus peut s'arrêter après avoir revendiqué une livraison. Elle
    // redevient reprenable au démarrage suivant, sans débloquer les envois qui
    // sont encore réellement en cours dans une autre instance.
    await this.db.query(
      `UPDATE contract_email_deliveries SET status='failed',last_error_code='STALE_CLAIM'
        WHERE status='sending' AND updated_at < now()-interval '5 minutes'`,
    );
    const rows = await this.db.query<{ contract_id: string }>(
      `SELECT DISTINCT contract_id FROM contract_email_deliveries
        WHERE status IN ('pending','failed')
        ORDER BY contract_id LIMIT $1`,
      [limit],
    );
    for (const row of rows.rows) await this.deliverForContract(row.contract_id);
  }

  async retryPendingDocuments(limit = 20) {
    const rows = await this.db.query<{ id: string; status: ContractRow["status"] }>(
      `SELECT id,status FROM contracts
        WHERE status IN ('draft','awaiting_finalization')
        ORDER BY updated_at,id LIMIT $1`,
      [limit],
    );
    for (const row of rows.rows) {
      if (row.status === "draft") await this.prepareOriginal(row.id);
      else await this.finalize(row.id);
    }
  }

  private async prepareOriginal(contractId: string) {
    const contract = await this.getInternal(contractId);
    if (contract.status !== "draft") return contract;
    let failureEvent: "contract.pdf.failed" | "contract.storage.failed" =
      "contract.pdf.failed";
    try {
      const bytes = await generateContractPdf(
        contract.id,
        contract.document_version,
        contract.snapshot,
      );
      this.logger.info(
        { contract_id: contract.id, document_version: contract.document_version },
        "contract.pdf.generated",
      );
      const path = `contracts/${contract.id}/v${contract.document_version}/original.pdf`;
      failureEvent = "contract.storage.failed";
      await this.store.upload(path, bytes);
      this.logger.info(
        { contract_id: contract.id, document_kind: "original" },
        "contract.storage.written",
      );
      const ready = await this.db.transaction(async (db) => {
        const updated = (
          await db.query<DbContractRow>(
            `UPDATE contracts
                SET original_file_path=$2,original_sha256=$3,
                    status='awaiting_worker_signature',last_error_code=NULL
              WHERE id=$1 AND status='draft'
              RETURNING *`,
            [contract.id, path, digest(bytes)],
          )
        ).rows[0];
        const result = updated ? mapContract(updated) : await this.byId(db, contract.id);
        if (result.status === "awaiting_worker_signature")
          await this.enqueue(
            db,
            result,
            "contract_available",
            result.snapshot.worker.email,
          );
        return result;
      });
      await this.deliverForContract(contract.id);
      return ready;
    } catch (error) {
      await this.recordFailure(contract.id, failureEvent, error);
      return this.getInternal(contract.id);
    }
  }

  private async finalize(contractId: string) {
    const contract = await this.getInternal(contractId);
    if (contract.status === "completed") return contract;
    if (contract.status !== "awaiting_finalization") return contract;
    let failureEvent:
      | "contract.finalization.failed"
      | "contract.pdf.failed"
      | "contract.storage.failed" = "contract.finalization.failed";
    try {
      const signatures = await this.signatures(contract.id);
      failureEvent = "contract.pdf.failed";
      const bytes = await generateContractPdf(
        contract.id,
        contract.document_version,
        contract.snapshot,
        signatures,
      );
      this.logger.info(
        { contract_id: contract.id, document_version: contract.document_version },
        "contract.pdf.generated",
      );
      const path = `contracts/${contract.id}/v${contract.document_version}/final.pdf`;
      failureEvent = "contract.storage.failed";
      await this.store.upload(path, bytes);
      this.logger.info(
        { contract_id: contract.id, document_kind: "final" },
        "contract.storage.written",
      );
      failureEvent = "contract.finalization.failed";
      const completed = await this.db.transaction(async (db) => {
        const updated = (
          await db.query<DbContractRow>(
            `UPDATE contracts
                SET final_file_path=$2,final_sha256=$3,status='completed',
                    completed_at=now(),last_error_code=NULL
              WHERE id=$1 AND status='awaiting_finalization'
              RETURNING *`,
            [contract.id, path, digest(bytes)],
          )
        ).rows[0];
        const result = updated ? mapContract(updated) : await this.byId(db, contract.id);
        if (result.status === "completed") {
          await this.enqueue(
            db,
            result,
            "contract_completed_worker",
            result.snapshot.worker.email,
          );
          await this.enqueue(
            db,
            result,
            "contract_completed_company",
            result.snapshot.company.email,
          );
        }
        return result;
      });
      await this.deliverForContract(contract.id);
      this.logger.info(
        { contract_id: contract.id, status: completed.status },
        "contract.finalization.completed",
      );
      return completed;
    } catch (error) {
      await this.recordFailure(contract.id, failureEvent, error);
      return this.getInternal(contract.id);
    }
  }

  private async loadSource(db: Db, applicationId: string) {
    const row = (
      await db.query<SourceRow>(
        `SELECT a.id AS application_id,a.status AS application_status,
                a.updated_at AS accepted_at,
                wp.id AS worker_id,wp.first_name AS worker_first_name,
                wp.last_name AS worker_last_name,wp.email AS worker_email,
                w.phone AS worker_phone,w.city AS worker_city,
                w.postal_code AS worker_postal_code,
                cp.id AS company_id,cp.first_name AS company_first_name,
                cp.last_name AS company_last_name,cp.email AS company_email,
                c.legal_name,c.establishment_name,c.phone AS company_phone,
                c.address AS company_address,c.city AS company_city,
                c.postal_code AS company_postal_code,c.sector AS company_sector,
                m.id AS mission_id,m.status AS mission_status,m.title AS mission_title,
                m.description AS mission_description,m.job AS mission_job,
                m.starts_at,m.ends_at,m.address AS mission_address,
                m.city AS mission_city,m.postal_code AS mission_postal_code,
                m.pay_amount,m.pay_unit,m.headcount
           FROM applications a
           JOIN missions m ON m.id=a.mission_id
           JOIN profiles wp ON wp.id=a.worker_id
           LEFT JOIN worker_profiles w ON w.profile_id=wp.id
           JOIN profiles cp ON cp.id=m.company_id
           LEFT JOIN company_profiles c ON c.profile_id=cp.id
          WHERE a.id=$1`,
        [applicationId],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(
        404,
        "APPLICATION_NOT_FOUND",
        "Candidature introuvable.",
      );
    return row;
  }

  private snapshotOf(row: SourceRow): ContractSnapshot {
    return {
      generated_at: new Date().toISOString(),
      legal_notice: LEGAL_NOTICE,
      application: { id: row.application_id, accepted_at: iso(row.accepted_at) },
      worker: {
        id: row.worker_id,
        first_name: row.worker_first_name,
        last_name: row.worker_last_name,
        email: row.worker_email,
        phone: row.worker_phone,
        city: row.worker_city,
        postal_code: row.worker_postal_code,
      },
      company: {
        id: row.company_id,
        legal_name: row.legal_name,
        establishment_name: row.establishment_name,
        representative_first_name: row.company_first_name,
        representative_last_name: row.company_last_name,
        email: row.company_email,
        phone: row.company_phone,
        address: row.company_address,
        city: row.company_city,
        postal_code: row.company_postal_code,
        sector: row.company_sector,
      },
      mission: {
        id: row.mission_id,
        title: row.mission_title,
        description: row.mission_description,
        job: row.mission_job,
        starts_at: iso(row.starts_at),
        ends_at: iso(row.ends_at),
        address: row.mission_address,
        city: row.mission_city,
        postal_code: row.mission_postal_code,
        pay_amount: row.pay_amount === null ? null : String(row.pay_amount),
        pay_unit: row.pay_unit,
        headcount: row.headcount,
      },
    };
  }

  private async transition(
    db: Db,
    contract: ContractRow,
    actor: Profile,
    action: "worker_signed" | "company_signed",
    status: "awaiting_company_signature" | "awaiting_finalization",
    signedColumn: "worker_signed_at" | "company_signed_at",
  ) {
    const updated = mapContract(
      (
        await db.query<DbContractRow>(
          `UPDATE contracts SET status=$2,${signedColumn}=now(),last_error_code=NULL
            WHERE id=$1 RETURNING *`,
          [contract.id, status],
        )
      ).rows[0],
    );
    await db.query(
      `INSERT INTO contract_signature_events(
         contract_id,actor_id,actor_role,action,from_status,to_status,
         document_version
       ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        contract.id,
        actor.id,
        actor.role,
        action,
        contract.status,
        status,
        contract.document_version,
      ],
    );
    return updated;
  }

  private async enqueue(
    db: Db,
    contract: ContractRow,
    kind: ContractNotificationKind,
    email: string,
  ) {
    await db.query(
      `INSERT INTO contract_email_deliveries(contract_id,kind,recipient_email)
       VALUES($1,$2,$3) ON CONFLICT(contract_id,kind) DO NOTHING`,
      [contract.id, kind, email],
    );
  }

  private async deliverForContract(contractId: string) {
    if (!this.notifications) return;
    const contract = await this.getInternal(contractId);
    const pending = await this.db.query<{
      id: string;
      kind: ContractNotificationKind;
      recipient_email: string;
      created_at: Date | string;
    }>(
      `SELECT id,kind,recipient_email,created_at FROM contract_email_deliveries
        WHERE contract_id=$1 AND status IN ('pending','failed')
        ORDER BY created_at,id`,
      [contractId],
    );
    for (const delivery of pending.rows) {
      const claimed = await this.db.query<{ id: string }>(
        `UPDATE contract_email_deliveries
            SET status='sending',attempts=attempts+1,last_error_code=NULL
          WHERE id=$1 AND status IN ('pending','failed') RETURNING id`,
        [delivery.id],
      );
      if (!claimed.rows[0]) continue;
      try {
        await this.notifications.send(
          this.notification(contract, delivery),
        );
        await this.db.query(
          `UPDATE contract_email_deliveries
              SET status='sent',sent_at=now(),last_error_code=NULL WHERE id=$1`,
          [delivery.id],
        );
        this.logger.info(
          {
            contract_id: contract.id,
            notification_kind: delivery.kind,
            delivery_id: delivery.id,
          },
          "contract.notification.accepted",
        );
      } catch (error) {
        await this.db.query(
          `UPDATE contract_email_deliveries
              SET status='failed',last_error_code=$2 WHERE id=$1`,
          [delivery.id, errorCode(error)],
        );
        this.logger.error(
          {
            contract_id: contract.id,
            notification_kind: delivery.kind,
            delivery_id: delivery.id,
            error_code: errorCode(error),
          },
          "contract.notification.failed",
        );
      }
    }
  }

  private notification(
    contract: ContractRow,
    delivery: {
      id: string;
      kind: ContractNotificationKind;
      recipient_email: string;
      created_at: Date | string;
    },
  ): ContractNotification {
    const { snapshot } = contract;
    const workerName = `${snapshot.worker.first_name} ${snapshot.worker.last_name}`.trim();
    const representativeName =
      `${snapshot.company.representative_first_name} ${snapshot.company.representative_last_name}`.trim();
    const companyName =
      snapshot.company.establishment_name ??
      snapshot.company.legal_name ??
      (representativeName || "Entreprise");
    const workerUrl = `${this.frontendUrl}/worker/documents/${contract.id}`;
    const companyUrl = `${this.frontendUrl}/company/documents/${contract.id}`;
    const downloadPath =
      `/api/v1/integrations/n8n/documents/${contract.id}` +
      `/deliveries/${delivery.id}`;
    const worker = {
      id: snapshot.worker.id,
      first_name: snapshot.worker.first_name,
      last_name: snapshot.worker.last_name,
      email: snapshot.worker.email,
    };
    // Le modèle ne distingue pas encore un email de contact d'un email de
    // compte : `email` expose donc explicitement la seule donnée disponible.
    const company = {
      id: snapshot.company.id,
      name: companyName,
      legal_name: snapshot.company.legal_name,
      establishment_name: snapshot.company.establishment_name,
      email: snapshot.company.email,
      phone: snapshot.company.phone,
      address: snapshot.company.address,
      city: snapshot.company.city,
      postal_code: snapshot.company.postal_code,
    };
    const common = {
      delivery_id: delivery.id,
      contract: {
        id: contract.id,
        status: contract.status,
        document_version: contract.document_version,
      },
      mission: {
        id: snapshot.mission.id,
        title: snapshot.mission.title,
        starts_at: snapshot.mission.starts_at,
        ends_at: snapshot.mission.ends_at,
        address: snapshot.mission.address,
        city: snapshot.mission.city,
        postal_code: snapshot.mission.postal_code,
        job: snapshot.mission.job,
      },
      document: {
        id: contract.id,
        type: contract.type,
        filename: `interimatch-document-${contract.id}.pdf`,
        mime_type: "application/pdf" as const,
        download_path: downloadPath,
      },
    };
    const templates: Record<
      ContractNotificationKind,
      Pick<ContractNotification, "eventType" | "data">
    > = {
      contract_available: {
        eventType: "contract.available",
        data: {
          ...common,
          worker,
          company,
          links: { document: workerUrl },
        },
      },
      worker_signed: {
        eventType: "contract.worker_signed",
        data: {
          ...common,
          worker,
          company,
          links: { document: companyUrl },
        },
      },
      contract_completed_worker: {
        eventType: "contract.completed",
        data: {
          ...common,
          recipient: {
            role: "worker",
            name: workerName,
            email: delivery.recipient_email,
          },
          worker,
          company,
          links: { document: workerUrl },
        },
      },
      contract_completed_company: {
        eventType: "contract.completed",
        data: {
          ...common,
          recipient: {
            role: "company",
            name: companyName,
            email: delivery.recipient_email,
          },
          worker,
          company,
          links: { document: companyUrl },
        },
      },
    };
    return {
      deliveryId: delivery.id,
      occurredAt: iso(delivery.created_at),
      ...templates[delivery.kind],
    };
  }

  private async signatures(contractId: string) {
    return (
      await this.db.query<DbSignatureEvent>(
        `SELECT id,actor_id,actor_role,action,from_status,to_status,
                document_version,declaration_version,created_at
           FROM contract_signature_events WHERE contract_id=$1
          ORDER BY created_at,id`,
        [contractId],
      )
    ).rows.map(mapSignature);
  }

  private detail(contract: ContractRow, signatures: ContractSignatureEvent[]) {
    const {
      original_file_path,
      final_file_path,
      original_sha256: _originalHash,
      final_sha256: _finalHash,
      last_error_code: _processingError,
      ...safe
    } = contract;
    void _originalHash;
    void _finalHash;
    void _processingError;
    return {
      ...safe,
      signatures,
      download_available: Boolean(
        contract.status === "completed" ? final_file_path : original_file_path,
      ),
    };
  }

  private listItem(contract: ContractRow): ContractListItem {
    const {
      snapshot,
      original_file_path: _original,
      final_file_path: _final,
      original_sha256: _originalHash,
      final_sha256: _finalHash,
      last_error_code: _processingError,
      ...safe
    } = contract;
    void _original;
    void _final;
    void _originalHash;
    void _finalHash;
    void _processingError;
    return {
      ...safe,
      mission: {
        id: snapshot.mission.id,
        title: snapshot.mission.title,
        starts_at: snapshot.mission.starts_at,
      },
      worker: {
        id: snapshot.worker.id,
        first_name: snapshot.worker.first_name,
        last_name: snapshot.worker.last_name,
      },
      company: {
        id: snapshot.company.id,
        legal_name: snapshot.company.legal_name,
        establishment_name: snapshot.company.establishment_name,
      },
    };
  }

  private assertParty(contract: ContractRow, actor: Profile) {
    const owns =
      (actor.role === "worker" && contract.worker_id === actor.id) ||
      (actor.role === "company" && contract.company_id === actor.id);
    if (!owns)
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document introuvable.");
  }

  private async getInternal(id: string) {
    return this.byId(this.db, id);
  }

  private async byId(db: Db, id: string) {
    const row = (await db.query<DbContractRow>("SELECT * FROM contracts WHERE id=$1", [id]))
      .rows[0];
    if (!row)
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document introuvable.");
    return mapContract(row);
  }

  private async byApplication(db: Db, applicationId: string) {
    const row = (
      await db.query<DbContractRow>(
        "SELECT * FROM contracts WHERE application_id=$1",
        [applicationId],
      )
    ).rows[0];
    if (!row) throw new Error("Contract insert conflict without existing row");
    return mapContract(row);
  }

  private async lock(db: Db, id: string) {
    const row = (
      await db.query<DbContractRow>(
        "SELECT * FROM contracts WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document introuvable.");
    return mapContract(row);
  }

  private async recordFailure(
    contractId: string,
    event:
      | "contract.pdf.failed"
      | "contract.storage.failed"
      | "contract.finalization.failed",
    error: unknown,
  ) {
    const code = errorCode(error);
    await this.db.query(
      "UPDATE contracts SET last_error_code=$2 WHERE id=$1",
      [contractId, code],
    );
    this.logger.error(
      { contract_id: contractId, error_code: code },
      event,
    );
  }
}

function errorCode(error: unknown) {
  if (error instanceof HttpError) return error.code.slice(0, 64);
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code).toUpperCase();
    if (/^[A-Z0-9_]{1,64}$/.test(code)) return code;
  }
  return "PROCESSING_FAILED";
}
