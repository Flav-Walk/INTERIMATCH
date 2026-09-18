import type { Db } from "../db.js";
import {
  notOpenToWorkers,
  type MissionService,
  type NotOpenReason,
} from "../missions/service.js";
import type { OpenMission } from "../missions/schemas.js";
import {
  evaluate,
  selectByBands,
  type BlockerCode,
  type Engagement,
  type MatchResult,
  type MissionCriteria,
  type WorkerCriteria,
} from "./score.js";

/**
 * Un engagement, augmenté de la mission dont il provient.
 *
 * `score.ts` n'a que faire de cette origine — il ne connaît que des bornes.
 * Elle sert ici à une seule chose : ne pas opposer à un intérimaire l'engagement
 * qu'il a pris sur la mission même qu'on est en train d'évaluer. Sans cela, un
 * candidat retenu deviendrait « déjà engagé » pour le poste qu'il vient
 * d'obtenir, ce qui serait vrai mais absurde.
 */
interface LoadedEngagement extends Engagement {
  mission_id: string;
}

/** Écarte l'engagement né de cette mission, et lui seul. */
const elsewhere = (criteria: WorkerCriteria, missionId: string) => ({
  ...criteria,
  engagements: (criteria.engagements as LoadedEngagement[]).filter(
    (taken) => taken.mission_id !== missionId,
  ),
});

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

/**
 * Le rapprochement tel qu'il franchit la frontière de l'API.
 *
 * Une liste explicite, et non un `Omit<>` : ce qui s'ajoutera un jour à
 * `MatchResult` pour les besoins du moteur ne partira pas au client par
 * inadvertance. Il faudra l'inscrire ici, donc le vouloir.
 *
 * `raw_score` en est absent. Il sert au classement — les paliers se calculent
 * dessus — mais un « 81,33 % » affiché donnerait à une estimation une précision
 * qu'elle n'a pas.
 */
export type PublicMatch = Omit<MatchResult, "raw_score">;

const publicMatch = (match: MatchResult): PublicMatch => ({
  compatible: match.compatible,
  score: match.score,
  blockers: match.blockers,
  dimensions: match.dimensions,
  distance_km: match.distance_km,
  outside_zone: match.outside_zone,
  skills: match.skills,
});

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
  match: PublicMatch;
}

export interface MissionMatch {
  mission: OpenMission;
  match: PublicMatch;
}

/**
 * Ce que l'intérimaire n'a pas reçu, et pourquoi.
 *
 * Des nombres, rien d'autre. Une mission incompatible ne doit pas franchir la
 * frontière : ni son intitulé, ni son établissement, ni sa date. Compter les
 * motifs suffit à écrire une phrase utile — « aucune mission ne correspond à
 * vos disponibilités » — sans rien divulguer d'une offre qui ne le concerne pas.
 *
 * `total` compte les missions, `reasons` les motifs : une mission qui cumule
 * deux bloqueurs pèse une fois dans `total` et une fois dans chacun des deux.
 * La somme des motifs peut donc dépasser le total, ce qui est voulu.
 */
export interface Exclusions {
  total: number;
  reasons: Partial<Record<BlockerCode, number>>;
}

export interface WorkerMissions {
  matches: MissionMatch[];
  excluded: Exclusions;
}

/** Profils rapprochés d'une mission, ou le motif pour lequel on n'a rien cherché. */
export interface CandidateSelection {
  band: number | null;
  band_label: string | null;
  /** Profils retenus : compatibles, dans la zone, au palier annoncé. */
  candidates: Candidate[];
  /**
   * Profils que seule la distance écarte.
   *
   * Le cahier (D04) veut qu'un profil hors rayon reste consultable et que
   * l'élargissement soit un geste de l'entreprise, pas une décision du moteur.
   * Ils vivent donc à part : ni mêlés aux profils retenus, ni supprimés.
   *
   * Seule la distance les sépare du reste. Un profil à qui il manque en plus
   * une compétence exigée n'y figure pas : élargir la zone ne la lui rendrait
   * pas, et l'afficher laisserait croire le contraire.
   */
  outside_zone: Candidate[];
  /** `null` quand le rapprochement a bien tourné. */
  inactive: NotOpenReason | null;
}

/**
 * Combien de profils hors zone sont proposés à la consultation.
 *
 * Une borne, parce qu'élargir la zone n'est pas ouvrir les vannes : au-delà de
 * quelques profils, une entreprise ne lit plus, elle survole.
 *
 * Aucun plancher de score en revanche, et c'est délibéré. Un profil hors zone
 * est déjà pénalisé par la distance : la proximité pèse 25 points et lui en
 * rapporte zéro, ce que le cahier prévoit explicitement. Lui opposer ensuite un
 * seuil de 50 % reviendrait à le sanctionner deux fois pour le même motif, et à
 * vider la liste de son contenu — un serveur parfaitement qualifié à 400 km
 * plafonne mécaniquement autour de 45 %. Le plancher des 50 % du cahier porte
 * sur les propositions **automatiques** ; ici, c'est l'entreprise qui demande à
 * regarder plus loin.
 */
const OUTSIDE_ZONE_LIMIT = 10;

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
    // Les missions déjà obtenues. Une mission annulée ne réserve plus rien :
    // l'entreprise a retiré son offre, l'intérimaire récupère son créneau.
    const { rows: taken } = await this.db.query<{
      profile_id: string;
      mission_id: string;
      starts_at: string | Date;
      ends_at: string | Date;
    }>(
      `SELECT a.worker_id AS profile_id, m.id AS mission_id, m.starts_at, m.ends_at
         FROM applications a
         JOIN missions m ON m.id = a.mission_id
        WHERE a.worker_id = ANY($1::uuid[])
          AND a.status = 'accepted'
          AND m.status <> 'cancelled'`,
      [ids],
    );

    const bySkill = new Map<string, string[]>();
    for (const row of skills)
      bySkill.set(row.profile_id, [
        ...(bySkill.get(row.profile_id) ?? []),
        row.skill_id,
      ]);
    const byEngagement = new Map<string, LoadedEngagement[]>();
    for (const row of taken)
      byEngagement.set(row.profile_id, [
        ...(byEngagement.get(row.profile_id) ?? []),
        {
          mission_id: row.mission_id,
          starts_at: new Date(row.starts_at).toISOString(),
          ends_at: new Date(row.ends_at).toISOString(),
        },
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
          engagements: byEngagement.get(row.id) ?? [],
        } satisfies WorkerCriteria,
      ]),
    );
  }

  /** Missions auxquelles cet intérimaire a déjà répondu, quel que soit le sort. */
  private async answeredMissions(workerId: string) {
    const { rows } = await this.db.query<{ mission_id: string }>(
      "SELECT mission_id FROM applications WHERE worker_id = $1",
      [workerId],
    );
    return new Set(rows.map((row) => row.mission_id));
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
  async missionsForWorker(
    workerId: string,
    demo: boolean,
  ): Promise<WorkerMissions> {
    const [all, criteria, answered] = await Promise.all([
      this.missions.listOpen(demo),
      this.workerCriteria(workerId),
      this.answeredMissions(workerId),
    ]);
    // Une mission à laquelle on a déjà répondu n'est plus une proposition : elle
    // a rejoint « Mes candidatures », avec son statut. La laisser ici afficherait
    // un bouton « Postuler » que le serveur refuserait, et ferait passer pour une
    // offre ce qui est devenu un dossier en cours.
    const open = all.filter((mission) => !answered.has(mission.id));
    // Profil intérimaire absent : rien n'est évaluable, donc rien n'est
    // proposé — et rien n'est écarté non plus, car aucun motif ne serait
    // fondé. L'écran a déjà de quoi dire quoi faire : compléter le profil.
    if (!criteria) return { matches: [], excluded: { total: 0, reasons: {} } };

    const evaluated = open.map((mission) => ({
      mission,
      match: publicMatch(
        evaluate(criteriaOf(mission), elsewhere(criteria, mission.id)),
      ),
    }));

    const excluded: Exclusions = { total: 0, reasons: {} };
    for (const { match } of evaluated) {
      if (match.compatible) continue;
      excluded.total += 1;
      for (const code of match.blockers)
        excluded.reasons[code] = (excluded.reasons[code] ?? 0) + 1;
    }

    return {
      matches: evaluated
        .filter((entry) => entry.match.compatible)
        .sort((a, b) => b.match.score - a.match.score),
      excluded,
    };
  }

  /**
   * Évaluation d'une mission précise pour un intérimaire.
   *
   * Renvoyée même lorsqu'elle est incompatible : arriver sur le détail d'une
   * mission par un lien et n'y trouver qu'une erreur n'apprend rien, alors que
   * la raison du refus, elle, est utile.
   */
  async evaluateForWorker(workerId: string, missionId: string, demo: boolean) {
    const mission = await this.missions.getForWorker(missionId, demo, workerId);
    const criteria = await this.workerCriteria(workerId);
    return {
      mission,
      match: criteria
        ? publicMatch(
            evaluate(criteriaOf(mission), elsewhere(criteria, mission.id)),
          )
        : null,
    };
  }

  /**
   * Candidats pour une mission de l'entreprise.
   *
   * La propriété est vérifiée par `MissionService.get`, qui répond 404 pour la
   * mission d'une autre entreprise : aucune société ne peut donc obtenir les
   * candidats d'une mission qui ne lui appartient pas.
   *
   * Le rapprochement ne tourne que sur une mission réellement offerte. Sans
   * cette condition, les deux côtés ne parlaient pas de la même chose : une
   * entreprise voyait des « profils compatibles » pour un brouillon ou pour une
   * mission déjà terminée, alors qu'aucun intérimaire ne pouvait voir cette
   * mission — et donc qu'aucun de ces profils n'aurait pu se manifester.
   *
   * La mission reste consultable pour autant : `get` a déjà répondu, et c'est
   * le motif qui est renvoyé, pas une erreur. Une mission qui appartient bien à
   * l'entreprise ne devient pas introuvable parce qu'elle est passée.
   */
  async candidatesForMission(
    companyId: string,
    missionId: string,
    demo: boolean,
  ): Promise<CandidateSelection> {
    const mission = await this.missions.get(companyId, missionId);
    const inactive = notOpenToWorkers(mission);
    if (inactive)
      return {
        band: null,
        band_label: null,
        candidates: [],
        outside_zone: [],
        inactive,
      };
    // Mission complète : le rapprochement s'arrête, mais la mission reste
    // publiée et active. Le motif le dit — `closed` laisserait croire qu'elle
    // a été fermée, alors qu'elle a simplement trouvé tout son monde.
    if (!(await this.missions.hasCapacity(mission.id)))
      return {
        band: null,
        band_label: null,
        candidates: [],
        outside_zone: [],
        inactive: "full",
      };

    const criteria = criteriaOf(mission);

    // Une personne qui a postulé n'est plus une suggestion : elle est une
    // candidature, et se traite comme telle. La laisser figurer ici aussi lui
    // donnerait deux sens différents sur le même écran — et laisserait croire
    // à l'entreprise qu'elle a deux dossiers là où il n'y en a qu'un.
    const { rows } = await this.db.query<WorkerRow>(
      `SELECT ${WORKER_COLUMNS} FROM profiles p
         JOIN worker_profiles w ON w.profile_id = p.id
        WHERE p.role = 'worker' AND p.active = true AND p.demo = $1
          AND NOT EXISTS (SELECT 1 FROM applications a
                           WHERE a.worker_id = p.id AND a.mission_id = $2)`,
      [demo, missionId],
    );
    const loaded = await this.loadWorkers(rows);

    // `selectByBands` trie sur `score`, `compatible` et `id` ; le candidat
    // lui-même reste à côté, pour n'exposer ensuite que les champs de
    // `Candidate`. Le score transmis est le score **non arrondi** : comparer des
    // valeurs arrondies ferait entrer dans le palier des 70 un profil à 69,6 %.
    const evaluated = rows.map((row) => {
      const worker = loaded.get(row.id)!;
      const match = evaluate(criteria, elsewhere(worker, missionId));
      const held = new Set(worker.skill_ids);
      const candidate: Candidate = {
        id: row.id,
        first_name: row.first_name,
        last_initial: row.last_name.trim().slice(0, 1).toLocaleUpperCase("fr"),
        main_job: row.main_job,
        city: row.city,
        years_experience: toNumber(row.years_experience),
        matched_skills: mission.skills.filter((s) => held.has(s.id)),
        match: publicMatch(match),
      };
      return {
        id: row.id,
        score: match.raw_score,
        compatible: match.compatible,
        blockers: match.blockers,
        candidate,
      };
    });

    const selection = selectByBands(evaluated);
    return {
      band: selection.band,
      band_label: selection.label,
      candidates: selection.results.map((entry) => entry.candidate),
      outside_zone: evaluated
        // Seule la distance les écarte : un unique bloqueur, et c'est celui-là.
        .filter(
          (entry) =>
            entry.blockers.length === 1 && entry.blockers[0] === "out_of_range",
        )
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, OUTSIDE_ZONE_LIMIT)
        .map((entry) => entry.candidate),
      inactive: null,
    };
  }
}
