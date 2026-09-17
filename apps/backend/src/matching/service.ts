import type { Db } from "../db.js";
import type { MissionService } from "../missions/service.js";
import type { OpenMission } from "../missions/schemas.js";
import {
  evaluate,
  selectByBands,
  type MatchResult,
  type MissionCriteria,
  type WorkerCriteria,
} from "./score.js";

/**
 * Rapprochement appliqué aux données réelles.
 *
 * Ce service ne décide rien : il charge, il délègue à `evaluate`, il ordonne.
 * Toute la règle métier vit dans `score.ts`, qui est pur. Cette séparation est
 * ce qui rend le rapprochement vérifiable sans base de données.
 *
 * Les lectures de missions sont empruntées à `MissionService` plutôt que
 * réécrites : les règles de visibilité du SL2c — publiée, non terminée, du bon
 * côté de la cloison démo — restent définies à un seul endroit.
 */

/** Ce qu'une entreprise apprend d'un candidat avant toute mise en relation. */
export interface Candidate {
  id: string;
  first_name: string;
  /**
   * Initiale seule. Le nom complet, l'adresse et les moyens de contact ne
   * regardent pas encore l'entreprise : aucune candidature n'a été déposée, et
   * le rapprochement n'est qu'une suggestion du système.
   */
  last_initial: string;
  main_job: string | null;
  city: string | null;
  years_experience: number | null;
  /** Compétences de la mission que ce candidat possède réellement. */
  matched_skills: { id: string; name: string; required: boolean }[];
  match: MatchResult;
}

export interface MissionMatch {
  mission: OpenMission;
  match: MatchResult;
}

interface WorkerRow {
  id: string;
  first_name: string;
  last_name: string;
  main_job: string | null;
  secondary_jobs: string[] | null;
  latitude: number | null;
  longitude: number | null;
  mobility_radius_km: number | null;
  years_experience: string | number | null;
  open_to_missions: boolean;
  city: string | null;
}

const WORKER_COLUMNS = `p.id, p.first_name, p.last_name,
  w.main_job, w.secondary_jobs, w.latitude, w.longitude,
  w.mobility_radius_km, w.years_experience, w.open_to_missions, w.city`;

/** `numeric` revient en chaîne de PostgreSQL : le score attend un nombre. */
const toNumber = (value: string | number | null) =>
  value === null ? null : Number(value);

type ScorableMission = Pick<
  OpenMission,
  | "job"
  | "starts_at"
  | "ends_at"
  | "latitude"
  | "longitude"
  | "min_years_experience"
  | "skills"
>;

const criteriaOf = (mission: ScorableMission): MissionCriteria => ({
  job: mission.job,
  starts_at: new Date(mission.starts_at).toISOString(),
  ends_at: new Date(mission.ends_at).toISOString(),
  latitude: mission.latitude,
  longitude: mission.longitude,
  min_years_experience: toNumber(mission.min_years_experience),
  required_skill_ids: mission.skills.filter((s) => s.required).map((s) => s.id),
  desired_skill_ids: mission.skills.filter((s) => !s.required).map((s) => s.id),
});

export class MatchingService {
  constructor(
    private db: Db,
    private missions: MissionService,
  ) {}

  /** Compétences et disponibilités de plusieurs intérimaires, en deux requêtes. */
  private async loadWorkers(rows: WorkerRow[]) {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return new Map<string, WorkerCriteria>();

    const { rows: skills } = await this.db.query<{
      profile_id: string;
      skill_id: string;
    }>(
      "SELECT profile_id, skill_id FROM worker_skills WHERE profile_id = ANY($1::uuid[])",
      [ids],
    );
    const { rows: slots } = await this.db.query<{
      profile_id: string;
      starts_at: string | Date;
      ends_at: string | Date;
      status: "available" | "unavailable";
    }>(
      "SELECT profile_id, starts_at, ends_at, status FROM availabilities WHERE profile_id = ANY($1::uuid[])",
      [ids],
    );

    const bySkill = new Map<string, string[]>();
    for (const row of skills)
      bySkill.set(row.profile_id, [
        ...(bySkill.get(row.profile_id) ?? []),
        row.skill_id,
      ]);
    const bySlot = new Map<string, WorkerCriteria["availabilities"]>();
    for (const row of slots)
      bySlot.set(row.profile_id, [
        ...(bySlot.get(row.profile_id) ?? []),
        {
          starts_at: new Date(row.starts_at).toISOString(),
          ends_at: new Date(row.ends_at).toISOString(),
          status: row.status,
        },
      ]);

    return new Map(
      rows.map((row) => [
        row.id,
        {
          main_job: row.main_job,
          secondary_jobs: row.secondary_jobs ?? [],
          latitude: row.latitude,
          longitude: row.longitude,
          mobility_radius_km: row.mobility_radius_km,
          years_experience: toNumber(row.years_experience),
          open_to_missions: row.open_to_missions,
          skill_ids: bySkill.get(row.id) ?? [],
          availabilities: bySlot.get(row.id) ?? [],
        } satisfies WorkerCriteria,
      ]),
    );
  }

  private async workerCriteria(workerId: string) {
    const { rows } = await this.db.query<WorkerRow>(
      `SELECT ${WORKER_COLUMNS} FROM profiles p
         JOIN worker_profiles w ON w.profile_id = p.id
        WHERE p.id = $1`,
      [workerId],
    );
    if (!rows[0]) return null;
    return (await this.loadWorkers(rows)).get(workerId) ?? null;
  }

  /**
   * Missions proposées à un intérimaire : celles qu'il peut réellement prendre,
   * de la plus compatible à la moins compatible.
   *
   * Aucun palier ici. Les paliers servent à une entreprise qui cherche des
   * candidats et doit élargir faute d'en trouver ; un intérimaire, lui, veut
   * voir ce qui lui est accessible, pas un sous-ensemble arbitraire.
   */
  async missionsForWorker(workerId: string, demo: boolean) {
    const open = await this.missions.listOpen(demo);
    const criteria = await this.workerCriteria(workerId);
    // Profil intérimaire absent : rien n'est évaluable, donc rien n'est proposé.
    if (!criteria) return [] as MissionMatch[];
    return open
      .map((mission) => ({
        mission,
        match: evaluate(criteriaOf(mission), criteria),
      }))
      .filter((entry) => entry.match.compatible)
      .sort((a, b) => b.match.score - a.match.score);
  }

  /**
   * Évaluation d'une mission précise pour un intérimaire.
   *
   * Renvoyée même lorsqu'elle est incompatible : arriver sur le détail d'une
   * mission par un lien et n'y trouver qu'une erreur n'apprend rien, alors que
   * la raison du refus, elle, est utile.
   */
  async evaluateForWorker(workerId: string, missionId: string, demo: boolean) {
    const mission = await this.missions.getOpen(missionId, demo);
    const criteria = await this.workerCriteria(workerId);
    return {
      mission,
      match: criteria ? evaluate(criteriaOf(mission), criteria) : null,
    };
  }

  /**
   * Candidats pour une mission de l'entreprise.
   *
   * La propriété est vérifiée par `MissionService.get`, qui répond 404 pour la
   * mission d'une autre entreprise : aucune société ne peut donc obtenir les
   * candidats d'une mission qui ne lui appartient pas.
   */
  async candidatesForMission(
    companyId: string,
    missionId: string,
    demo: boolean,
  ) {
    const mission = await this.missions.get(companyId, missionId);
    const criteria = criteriaOf(mission);

    const { rows } = await this.db.query<WorkerRow>(
      `SELECT ${WORKER_COLUMNS} FROM profiles p
         JOIN worker_profiles w ON w.profile_id = p.id
        WHERE p.role = 'worker' AND p.active = true AND p.demo = $1`,
      [demo],
    );
    const loaded = await this.loadWorkers(rows);

    // `selectByBands` trie sur `score` et `compatible` ; le candidat lui-même
    // reste à côté, pour n'exposer ensuite que les champs prévus par `Candidate`.
    const evaluated = rows.map((row) => {
      const worker = loaded.get(row.id)!;
      const match = evaluate(criteria, worker);
      const held = new Set(worker.skill_ids);
      const candidate: Candidate = {
        id: row.id,
        first_name: row.first_name,
        last_initial: row.last_name.trim().slice(0, 1).toLocaleUpperCase("fr"),
        main_job: row.main_job,
        city: row.city,
        years_experience: toNumber(row.years_experience),
        matched_skills: mission.skills.filter((s) => held.has(s.id)),
        match,
      };
      return { score: match.score, compatible: match.compatible, candidate };
    });

    const selection = selectByBands(evaluated);
    return {
      band: selection.band,
      band_label: selection.label,
      candidates: selection.results.map((entry) => entry.candidate),
    };
  }
}
