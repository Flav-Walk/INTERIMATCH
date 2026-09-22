import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import request from "supertest";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { ContractService } from "./service.js";
import { memoryContractStore } from "./testing.js";
import type { ContractNotification } from "./notification.js";
import { MissionService } from "../missions/service.js";

const pg = new PGlite();
const db: Db = {
  query: (sql, values) => pg.query(sql, values),
  transaction: async (work) => {
    await pg.exec("BEGIN");
    try {
      const result = await work(db);
      await pg.exec("COMMIT");
      return result;
    } catch (error) {
      await pg.exec("ROLLBACK");
      throw error;
    }
  },
};

const logger = { info: vi.fn(), error: vi.fn() };
const sent: ContractNotification[] = [];
const memory = memoryContractStore();
const contracts = new ContractService(
  db,
  memory.store,
  { send: async (message) => void sent.push(message) },
  "https://interimatch.example",
  logger,
);
const accounts = new AccountService(db);
const app = createApp(
  readConfig({ NODE_ENV: "test" }),
  accounts,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  contracts,
);

let workerId: string;
let otherWorkerId: string;
let companyId: string;
let otherCompanyId: string;
let applicationId: string;
let contractId: string;
let workerToken: string;
let otherToken: string;
let companyToken: string;
let otherCompanyToken: string;

async function profile(role: "worker" | "company", email: string) {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO profiles(role,email,first_name,last_name,onboarding_completed)
       VALUES($1,$2,'Camille','Martin',true) RETURNING id`,
      [role, email],
    )
  ).rows[0].id;
}

async function acceptedApplication(worker: string, title: string) {
  const mission = (
    await db.query<{ id: string }>(
      `INSERT INTO missions(
         company_id,title,description,job,starts_at,ends_at,address,city,
         postal_code,headcount,status,published_at,media
       ) VALUES($1,$2,'Test contrats','serveur',
         now()+interval '20 days',now()+interval '20 days 4 hours','',
         'Lyon','69002',2,'open',now(),
         '{"provider":"upload","url":"https://storage.test/photo.jpg","storage_path":"missions/test/photo.jpg"}'::jsonb)
       RETURNING id`,
      [companyId, title],
    )
  ).rows[0].id;
  const application = (
    await db.query<{ id: string }>(
      `INSERT INTO applications(mission_id,worker_id,status)
       VALUES($1,$2,'accepted') RETURNING id`,
      [mission, worker],
    )
  ).rows[0].id;
  return { mission, application };
}

beforeAll(async () => {
  for (const name of (await readdir("migrations")).sort())
    if (name.endsWith(".sql"))
      await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  companyId = await profile("company", "company.contract@example.test");
  otherCompanyId = await profile("company", "other.company.contract@example.test");
  workerId = await profile("worker", "worker.contract@example.test");
  otherWorkerId = await profile("worker", "other.contract@example.test");
  await db.query(
    `INSERT INTO company_profiles(
       profile_id,legal_name,establishment_name,sector,address,city,postal_code,
       phone,description
     ) VALUES($1,'InteriMatch Démo','Le Comptoir','restaurant','1 rue Test',
       'Lyon','69002','0102030405','Test')`,
    [companyId],
  );
  for (const id of [workerId, otherWorkerId])
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job,phone)
       VALUES($1,'Lyon','69002','serveur','0600000000')`,
      [id],
    );
  const mission = (
    await db.query<{ id: string }>(
      `INSERT INTO missions(
         company_id,title,description,job,starts_at,ends_at,address,city,
         postal_code,pay_amount,pay_unit,status,published_at,media
       ) VALUES($1,'Service du soir','Accueil et service','serveur',
         '2030-09-25T16:00:00Z','2030-09-25T21:00:00Z','10 quai Test',
         'Lyon','69002',150,'mission','open',now(),
         '{"provider":"upload","url":"https://storage.test/photo.jpg","storage_path":"missions/test/photo.jpg"}'::jsonb)
       RETURNING id`,
      [companyId],
    )
  ).rows[0].id;
  applicationId = (
    await db.query<{ id: string }>(
      `INSERT INTO applications(mission_id,worker_id,status)
       VALUES($1,$2,'accepted') RETURNING id`,
      [mission, workerId],
    )
  ).rows[0].id;
  workerToken = (await accounts.issue(db, workerId)).access_token;
  otherToken = (await accounts.issue(db, otherWorkerId)).access_token;
  companyToken = (await accounts.issue(db, companyId)).access_token;
  otherCompanyToken = (await accounts.issue(db, otherCompanyId)).access_token;
});

afterAll(() => pg.close());

describe("contrats de mission", () => {
  it("refuse une candidature non acceptée et crée une seule archive PDF", async () => {
    const pending = (
      await db.query<{ id: string }>(
        `INSERT INTO applications(mission_id,worker_id)
         SELECT mission_id,$2 FROM applications WHERE id=$1 RETURNING id`,
        [applicationId, otherWorkerId],
      )
    ).rows[0].id;
    await expect(contracts.ensureForAcceptedApplication(pending)).rejects.toMatchObject({
      code: "CONTRACT_REQUIRES_ACCEPTED_APPLICATION",
    });
    await db.query("UPDATE applications SET status='rejected' WHERE id=$1", [
      pending,
    ]);
    await expect(contracts.ensureForAcceptedApplication(pending)).rejects.toMatchObject({
      code: "CONTRACT_REQUIRES_ACCEPTED_APPLICATION",
    });

    const first = await contracts.ensureForAcceptedApplication(applicationId);
    const second = await contracts.ensureForAcceptedApplication(applicationId);
    contractId = first.id;
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("awaiting_worker_signature");
    const count = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM contracts WHERE application_id=$1",
      [applicationId],
    );
    expect(count.rows[0].n).toBe("1");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      eventType: "contract.available",
      data: {
        contract: { id: contractId, status: "awaiting_worker_signature" },
        links: {
          document: `https://interimatch.example/worker/documents/${contractId}`,
        },
      },
    });
    await expect(
      db.query("UPDATE contracts SET status='completed' WHERE id=$1", [contractId]),
    ).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO contracts(application_id,mission_id,worker_id,company_id,snapshot)
         SELECT application_id,mission_id,$2,company_id,snapshot
           FROM contracts WHERE id=$1`,
        [contractId, otherWorkerId],
      ),
    ).rejects.toThrow(/CONTRACT_SOURCE_MISMATCH/);
    const original = [...memory.files.values()][0];
    expect(new TextDecoder().decode(original.slice(0, 5))).toBe("%PDF-");
  });

  it("fige le snapshot même si la mission change", async () => {
    const before = await contracts.getFor(contractId, {
      ...(await accounts.reload(workerId)),
      role: "worker",
    });
    await db.query("UPDATE missions SET title='Titre modifié' WHERE id=$1", [
      before.mission_id,
    ]);
    const after = await contracts.getFor(contractId, await accounts.reload(workerId));
    expect(after.snapshot.mission.title).toBe("Service du soir");
    await expect(
      db.query("UPDATE contracts SET snapshot='{}'::jsonb WHERE id=$1", [contractId]),
    ).rejects.toThrow(/CONTRACT_SNAPSHOT_IMMUTABLE/);
  });

  it("applique l'ordre des validations, les rend idempotentes et finalise", async () => {
    await expect(
      contracts.sign(contractId, await accounts.reload(companyId)),
    ).rejects.toMatchObject({ code: "WORKER_SIGNATURE_REQUIRED" });

    const worker = await contracts.sign(contractId, await accounts.reload(workerId));
    expect(worker.status).toBe("awaiting_company_signature");
    const workerAgain = await contracts.sign(
      contractId,
      await accounts.reload(workerId),
    );
    expect(workerAgain.status).toBe("awaiting_company_signature");

    const completed = await contracts.sign(
      contractId,
      await accounts.reload(companyId),
    );
    expect(completed.status).toBe("completed");
    expect(completed.download_available).toBe(true);
    const companyAgain = await contracts.sign(
      contractId,
      await accounts.reload(companyId),
    );
    expect(companyAgain.status).toBe("completed");
    expect(completed.signatures).toHaveLength(2);
    expect(sent).toHaveLength(4);
    expect(sent.map((notification) => notification.eventType)).toEqual([
      "contract.available",
      "contract.worker_signed",
      "contract.completed",
      "contract.completed",
    ]);
    const workerCompleted = sent.find(
      (notification) =>
        notification.eventType === "contract.completed" &&
        (notification.data.recipient as { role?: string }).role === "worker",
    );
    const companyCompleted = sent.find(
      (notification) =>
        notification.eventType === "contract.completed" &&
        (notification.data.recipient as { role?: string }).role === "company",
    );
    expect(workerCompleted?.data).toMatchObject({
      recipient: { role: "worker", email: "worker.contract@example.test" },
      links: {
        document: `https://interimatch.example/worker/documents/${contractId}`,
      },
    });
    expect(companyCompleted?.data).toMatchObject({
      recipient: { role: "company", email: "company.contract@example.test" },
      links: {
        document: `https://interimatch.example/company/documents/${contractId}`,
      },
    });
    expect(JSON.stringify(sent)).not.toContain("supabase");
    expect(
      (await db.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM contract_email_deliveries",
      )).rows[0].n,
    ).toBe("4");
  });

  it("isole une panne n8n et reprend la même livraison après redémarrage", async () => {
    await db.query(
      `UPDATE contract_email_deliveries SET status='failed',sent_at=NULL
        WHERE contract_id=$1 AND kind='contract_completed_worker'`,
      [contractId],
    );
    const failing = new ContractService(
      db,
      memory.store,
      { send: async () => Promise.reject(new Error("offline")) },
      "https://interimatch.example",
      logger,
    );
    const delivery = (
      await db.query<{ id: string }>(
        `SELECT id FROM contract_email_deliveries
          WHERE contract_id=$1 AND kind='contract_completed_worker'`,
        [contractId],
      )
    ).rows[0];
    await expect(failing.retryPendingNotifications()).resolves.toBeUndefined();
    expect((await contracts.getFor(contractId, await accounts.reload(workerId))).status).toBe(
      "completed",
    );
    expect(
      (
        await db.query<{ status: string }>(
          `SELECT status FROM contract_email_deliveries
            WHERE contract_id=$1 AND kind='contract_completed_worker'`,
          [contractId],
        )
      ).rows[0].status,
    ).toBe("failed");

    const recovered: ContractNotification[] = [];
    const afterRestart = new ContractService(
      db,
      memory.store,
      { send: async (notification) => void recovered.push(notification) },
      "https://interimatch.example",
      logger,
    );
    await afterRestart.retryPendingNotifications();
    expect(recovered).toHaveLength(1);
    expect(recovered[0].deliveryId).toBe(delivery.id);
    expect(
      (
        await db.query<{ status: string; attempts: number }>(
          `SELECT status,attempts FROM contract_email_deliveries WHERE id=$1`,
          [delivery.id],
        )
      ).rows[0],
    ).toMatchObject({ status: "sent", attempts: 3 });
  });

  it("annule le processus en cours avec la mission et refuse une création tardive", async () => {
    const first = await acceptedApplication(
      otherWorkerId,
      "Mission à annuler avec document",
    );
    const existing = await contracts.ensureForAcceptedApplication(first.application);
    const secondWorker = await profile("worker", "cancelled.contract@example.test");
    const secondApplication = (
      await db.query<{ id: string }>(
        `INSERT INTO applications(mission_id,worker_id,status)
         VALUES($1,$2,'accepted') RETURNING id`,
        [first.mission, secondWorker],
      )
    ).rows[0].id;

    await new MissionService(db).cancel(companyId, first.mission);
    expect(
      (await contracts.getFor(existing.id, await accounts.reload(otherWorkerId)))
        .status,
    ).toBe("cancelled");
    await expect(
      contracts.sign(existing.id, await accounts.reload(otherWorkerId)),
    ).rejects.toMatchObject({ code: "CONTRACT_CANCELLED" });
    await expect(
      contracts.ensureForAcceptedApplication(secondApplication),
    ).rejects.toMatchObject({ code: "CONTRACT_MISSION_CANCELLED" });
  });

  it("conserve un contrat reprenable quand le stockage est indisponible", async () => {
    logger.error.mockClear();
    const source = await acceptedApplication(
      otherWorkerId,
      "Mission stockage indisponible",
    );
    const unavailable = new ContractService(
      db,
      {
        upload: async () => Promise.reject(new Error("storage offline")),
        download: async () => Promise.reject(new Error("storage offline")),
      },
      undefined,
      "https://interimatch.example",
      logger,
    );
    const draft = await unavailable.ensureForAcceptedApplication(source.application);
    expect(draft.status).toBe("draft");
    expect(
      (
        await db.query<{ last_error_code: string }>(
          "SELECT last_error_code FROM contracts WHERE id=$1",
          [draft.id],
        )
      ).rows[0].last_error_code,
    ).toBe("PROCESSING_FAILED");
    expect(logger.error).toHaveBeenCalledWith(
      {
        contract_id: draft.id,
        error_code: "PROCESSING_FAILED",
      },
      "contract.storage.failed",
    );
    await contracts.retryPendingDocuments();
    expect(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM contracts WHERE id=$1",
          [draft.id],
        )
      ).rows[0].status,
    ).toBe("awaiting_worker_signature");
  });

  it("protège détail et téléchargement contre les IDOR", async () => {
    await request(app).get("/api/v1/workers/me/documents").expect(401);
    await request(app)
      .get(`/api/v1/documents/${contractId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await request(app)
      .get(`/api/v1/documents/${contractId}`)
      .set("Authorization", `Bearer ${otherCompanyToken}`)
      .expect(404);
    await request(app)
      .post(`/api/v1/documents/${contractId}/sign`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ accepted: true })
      .expect(404);
    await request(app)
      .post(`/api/v1/documents/${contractId}/sign`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ accepted: false })
      .expect(400);
    const list = await request(app)
      .get("/api/v1/workers/me/documents")
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);
    expect(list.body.documents).toHaveLength(1);
    const download = await request(app)
      .get(`/api/v1/documents/${contractId}/download`)
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200)
      .expect("Content-Type", "application/pdf");
    expect(download.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rattrape une acceptation sans contrat une seule fois", async () => {
    logger.info.mockClear();
    const recoveryWorker = await profile(
      "worker",
      "recovery.contract@example.test",
    );
    await db.query(
      `INSERT INTO worker_profiles(profile_id,city,postal_code,main_job,phone)
       VALUES($1,'Lyon','69002','serveur','0600000000')`,
      [recoveryWorker],
    );
    const source = await acceptedApplication(
      recoveryWorker,
      "Mission acceptée pendant une indisponibilité",
    );

    await contracts.reconcileAcceptedApplications();
    await contracts.reconcileAcceptedApplications();

    const created = await db.query<{ id: string }>(
      "SELECT id FROM contracts WHERE application_id=$1",
      [source.application],
    );
    expect(created.rows).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledWith(
      { count: 1 },
      "contract.creation.reconciliation_started",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: source.application,
        contract_id: created.rows[0].id,
        status: "awaiting_worker_signature",
      }),
      "contract.creation.completed",
    );
  });
});
