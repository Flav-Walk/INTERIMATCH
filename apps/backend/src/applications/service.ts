import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { ApplicationStatus } from "./schemas.js";

interface ApplicationRow {
  id: string;
  mission_id: string;
  worker_id: string;
  status: ApplicationStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

interface WorkerApplicationRow extends ApplicationRow {
  title: string;
  job: string;
  starts_at: Date | string;
  ends_at: Date | string;
  city: string;
  postal_code: string;
  mission_status: string;
  establishment_name: string | null;
}

interface CompanyApplicationRow extends ApplicationRow {
  first_name: string;
  last_name: string;
  city: string | null;
  main_job: string | null;
}

const applicationFields =
  "a.id,a.mission_id,a.worker_id,a.status,a.created_at,a.updated_at";

const databaseCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;

export class ApplicationService {
  constructor(public readonly db: Db) {}

  /**
   * La mission doit être exactement celle qu'un worker peut encore consulter :
   * publiée, non terminée et du même univers réel/démo que son compte.
   */
  async create(workerId: string, missionId: string) {
    return this.db.transaction(async (db) => {
      const mission = await db.query<{
        id: string;
        mission_demo: boolean;
        worker_demo: boolean;
        candidatable: boolean;
      }>(
        `SELECT m.id,m.demo AS mission_demo,p.demo AS worker_demo,
                (m.status='open' AND m.ends_at > now()) AS candidatable
           FROM missions m
           JOIN profiles p ON p.id=$2
          WHERE m.id=$1
          FOR SHARE OF m,p`,
        [missionId, workerId],
      );
      const target = mission.rows[0];
      if (!target || target.mission_demo !== target.worker_demo)
        throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
      if (!target.candidatable)
        throw new HttpError(
          409,
          "APPLICATION_CLOSED",
          "Cette mission n’accepte plus de candidatures.",
        );

      try {
        return (
          await db.query<ApplicationRow>(
            `INSERT INTO applications(mission_id,worker_id)
             VALUES($1,$2)
             RETURNING id,mission_id,worker_id,status,created_at,updated_at`,
            [missionId, workerId],
          )
        ).rows[0];
      } catch (error) {
        if (databaseCode(error) === "23505")
          throw new HttpError(
            409,
            "APPLICATION_ALREADY_EXISTS",
            "Vous avez déjà postulé à cette mission.",
          );
        throw error;
      }
    });
  }

  async getForWorkerMission(workerId: string, missionId: string) {
    return (
      (
        await this.db.query<ApplicationRow>(
          `SELECT ${applicationFields}
           FROM applications a
          WHERE a.worker_id=$1 AND a.mission_id=$2`,
          [workerId, missionId],
        )
      ).rows[0] ?? null
    );
  }

  async listForWorker(workerId: string) {
    const { rows } = await this.db.query<WorkerApplicationRow>(
      `SELECT ${applicationFields},
              m.title,m.job,m.starts_at,m.ends_at,m.city,m.postal_code,
              m.status AS mission_status,c.establishment_name
         FROM applications a
         JOIN missions m ON m.id=a.mission_id
         LEFT JOIN company_profiles c ON c.profile_id=m.company_id
        WHERE a.worker_id=$1
        ORDER BY a.created_at DESC,a.id`,
      [workerId],
    );
    return rows.map((row) => ({
      id: row.id,
      mission_id: row.mission_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mission: {
        title: row.title,
        job: row.job,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        city: row.city,
        postal_code: row.postal_code,
        status: row.mission_status,
      },
      company: { establishment_name: row.establishment_name },
    }));
  }

  async listForMission(companyId: string, missionId: string) {
    await this.assertOwnedMission(this.db, companyId, missionId);
    const { rows } = await this.db.query<CompanyApplicationRow>(
      `SELECT ${applicationFields},p.first_name,p.last_name,
              w.city,w.main_job
         FROM applications a
         JOIN profiles p ON p.id=a.worker_id
         LEFT JOIN worker_profiles w ON w.profile_id=a.worker_id
        WHERE a.mission_id=$1
        ORDER BY a.created_at DESC,a.id`,
      [missionId],
    );
    return rows.map((row) => this.toCompanyApplication(row));
  }

  async decide(
    companyId: string,
    missionId: string,
    applicationId: string,
    status: "accepted" | "rejected",
  ) {
    return this.db.transaction(async (db) => {
      const locked = await db.query<CompanyApplicationRow>(
        `SELECT ${applicationFields},p.first_name,p.last_name,
                w.city,w.main_job
           FROM applications a
           JOIN missions m ON m.id=a.mission_id
           JOIN profiles p ON p.id=a.worker_id
           LEFT JOIN worker_profiles w ON w.profile_id=a.worker_id
          WHERE a.id=$1 AND a.mission_id=$2 AND m.company_id=$3
          FOR UPDATE OF a`,
        [applicationId, missionId, companyId],
      );
      const application = locked.rows[0];
      if (!application)
        throw new HttpError(
          404,
          "APPLICATION_NOT_FOUND",
          "Candidature introuvable.",
        );
      if (application.status !== "pending")
        throw new HttpError(
          409,
          "APPLICATION_ALREADY_DECIDED",
          "Cette candidature a déjà reçu une décision.",
        );

      const updated = (
        await db.query<ApplicationRow>(
          `UPDATE applications SET status=$2
            WHERE id=$1
            RETURNING id,mission_id,worker_id,status,created_at,updated_at`,
          [applicationId, status],
        )
      ).rows[0];
      return this.toCompanyApplication({ ...application, ...updated });
    });
  }

  private async assertOwnedMission(
    db: Db,
    companyId: string,
    missionId: string,
  ) {
    const owned = await db.query(
      "SELECT id FROM missions WHERE id=$1 AND company_id=$2",
      [missionId, companyId],
    );
    if (!owned.rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
  }

  private toCompanyApplication(row: CompanyApplicationRow) {
    return {
      id: row.id,
      mission_id: row.mission_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      worker: {
        id: row.worker_id,
        first_name: row.first_name,
        last_name: row.last_name,
        city: row.city,
        main_job: row.main_job,
      },
    };
  }
}
