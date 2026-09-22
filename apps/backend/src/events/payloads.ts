import type { Db } from "../db.js";

interface WorkerEventRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  main_job: string | null;
  city: string | null;
}

interface MissionEventRow {
  id: string;
  title: string;
  description: string;
  status: string;
  starts_at: Date | string;
  ends_at: Date | string;
  address: string;
  city: string;
  postal_code: string;
  job: string;
  headcount: number;
  pay_amount: string | number | null;
  pay_unit: string | null;
  published_at: Date | string | null;
  company_id: string;
  company_email: string;
  legal_name: string | null;
  establishment_name: string | null;
  sector: string | null;
  company_phone: string | null;
}

interface ApplicationEventRow extends WorkerEventRow {
  application_id: string;
  mission_id: string;
  application_status: string;
  application_created_at: Date | string;
  application_updated_at: Date | string;
}

interface MissionCancellationApplicationRow {
  application_id: string;
  worker_id: string;
  worker_email: string;
  status: "pending" | "accepted" | "rejected";
}

const iso = (value: Date | string) => new Date(value).toISOString();

/** Identité métier utile aux automatisations, sans donnée d'authentification. */
export async function loadWorkerEventData(db: Db, workerId: string) {
  const row = (
    await db.query<WorkerEventRow>(
      `SELECT p.id,p.first_name,p.last_name,p.email,w.main_job,w.city
         FROM profiles p
         LEFT JOIN worker_profiles w ON w.profile_id=p.id
        WHERE p.id=$1 AND p.role='worker'`,
      [workerId],
    )
  ).rows[0];
  if (!row) throw new Error("Worker event source missing");
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    main_job: row.main_job,
    city: row.city,
  };
}

/** Mission et contact entreprise tels qu'ils existent au moment de l'événement. */
export async function loadMissionEventData(db: Db, missionId: string) {
  const row = (
    await db.query<MissionEventRow>(
      `SELECT m.id,m.title,m.description,m.status,m.starts_at,m.ends_at,
              m.address,m.city,m.postal_code,m.job,m.headcount,m.pay_amount,
              m.pay_unit,m.published_at,m.company_id,p.email AS company_email,
              c.legal_name,c.establishment_name,c.sector,
              c.phone AS company_phone
         FROM missions m
         JOIN profiles p ON p.id=m.company_id
         LEFT JOIN company_profiles c ON c.profile_id=m.company_id
        WHERE m.id=$1`,
      [missionId],
    )
  ).rows[0];
  if (!row) throw new Error("Mission event source missing");
  const skills = (
    await db.query<{
      id: string;
      name: string;
      required: boolean;
    }>(
      `SELECT s.id,s.name,ms.required
         FROM mission_skills ms
         JOIN skills s ON s.id=ms.skill_id
        WHERE ms.mission_id=$1
        ORDER BY ms.required DESC,s.name`,
      [missionId],
    )
  ).rows;
  return {
    mission_id: row.id,
    mission: {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      starts_at: iso(row.starts_at),
      ends_at: iso(row.ends_at),
      address: row.address,
      city: row.city,
      postal_code: row.postal_code,
      job: row.job,
      headcount: row.headcount,
      pay_amount: row.pay_amount === null ? null : String(row.pay_amount),
      pay_unit: row.pay_unit,
      published_at: row.published_at === null ? null : iso(row.published_at),
      skills,
    },
    company: {
      id: row.company_id,
      email: row.company_email,
      legal_name: row.legal_name,
      establishment_name: row.establishment_name,
      sector: row.sector,
      phone: row.company_phone,
    },
  };
}

/** Destinataires figés avant l'annulation, sans modifier leur décision passée. */
export async function loadMissionCancellationApplications(
  db: Db,
  missionId: string,
) {
  const { rows } = await db.query<MissionCancellationApplicationRow>(
    `SELECT a.id AS application_id,a.worker_id,p.email AS worker_email,a.status
       FROM applications a
       JOIN profiles p ON p.id=a.worker_id AND p.role='worker'
      WHERE a.mission_id=$1
      ORDER BY a.id`,
    [missionId],
  );
  return rows.map((row) => ({
    application_id: row.application_id,
    worker_id: row.worker_id,
    worker: { email: row.worker_email },
    status: row.status,
  }));
}

/** Contexte autosuffisant d'une candidature, lu dans la transaction métier. */
export async function loadApplicationEventData(db: Db, applicationId: string) {
  const row = (
    await db.query<ApplicationEventRow>(
      `SELECT a.id AS application_id,a.mission_id,
              a.status AS application_status,
              a.created_at AS application_created_at,
              a.updated_at AS application_updated_at,
              p.id,p.first_name,p.last_name,p.email,w.main_job,w.city
         FROM applications a
         JOIN profiles p ON p.id=a.worker_id
         LEFT JOIN worker_profiles w ON w.profile_id=a.worker_id
        WHERE a.id=$1`,
      [applicationId],
    )
  ).rows[0];
  if (!row) throw new Error("Application event source missing");
  const context = await loadMissionEventData(db, row.mission_id);
  return {
    application_id: row.application_id,
    application: {
      id: row.application_id,
      status: row.application_status,
      created_at: iso(row.application_created_at),
      updated_at: iso(row.application_updated_at),
    },
    worker: {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      main_job: row.main_job,
      city: row.city,
    },
    mission: context.mission,
    company: context.company,
  };
}
