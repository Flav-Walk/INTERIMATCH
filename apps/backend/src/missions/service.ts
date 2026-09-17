import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { Geocoder } from "../worker/geocode.js";
import {
  brokenRule,
  type Mission,
  type MissionInput,
  type MissionPatch,
  type MissionSkill,
  type MissionStatus,
  type OpenMission,
} from "./schemas.js";

/**
 * Transitions de statut autorisées. Le SL2a n'en implémente qu'une, la
 * publication. `filled`, `completed` et `cancelled` s'ajouteront ici : la règle
 * reste déclarée à un seul endroit, et `assertTransition` n'a pas à changer.
 */
const transitions: Partial<Record<MissionStatus, readonly MissionStatus[]>> = {
  draft: ["open"],
};

/** Colonnes qu'une modification peut écrire directement, dans cet ordre figé. */
const writableColumns = [
  "title",
  "description",
  "job",
  "starts_at",
  "ends_at",
  "address",
  "city",
  "postal_code",
  "pay_amount",
  "pay_unit",
  "headcount",
  "min_years_experience",
] as const;

const COLUMNS = `m.id, m.company_id, m.title, m.description, m.job,
  m.starts_at, m.ends_at, m.address, m.city, m.postal_code,
  m.latitude, m.longitude, m.geocoded_at, m.pay_amount, m.pay_unit,
  m.headcount, m.min_years_experience, m.status, m.published_at,
  m.demo, m.created_at, m.updated_at`;

/**
 * Colonnes d'une mission telles qu'un intérimaire peut les voir, jointes aux
 * informations que l'établissement destine aux intérimaires. La jointure est
 * externe : une entreprise peut publier une mission avant d'avoir présenté son
 * établissement, et la mission doit rester visible dans ce cas.
 */
const OPEN_COLUMNS = `m.id, m.title, m.description, m.job,
  m.starts_at, m.ends_at, m.address, m.city, m.postal_code,
  m.latitude, m.longitude, m.geocoded_at, m.pay_amount, m.pay_unit,
  m.headcount, m.min_years_experience, m.status, m.published_at,
  m.demo, m.created_at, m.updated_at,
  c.establishment_name, c.sector, c.description AS company_description`;

/**
 * Seule définition de ce qu'un intérimaire a le droit de voir, partagée par la
 * liste et le détail : une mission publiée, dont le créneau n'est pas terminé,
 * et dont le caractère fictif correspond à celui du compte qui la demande.
 *
 * Tout le reste en est exclu par construction — un brouillon, une mission
 * pourvue, terminée ou annulée, et une mission publiée mais déjà passée. Le
 * détail s'appuyant sur le même prédicat, demander l'identifiant d'un brouillon
 * répond « introuvable » : on ne révèle pas qu'il existe.
 *
 * La dernière condition est une cloison : les missions de démonstration, créées
 * par `db:seed` et marquées `demo`, ne doivent jamais apparaître à un vrai
 * utilisateur. Jusqu'ici le marqueur n'était lu nulle part, parce que seule
 * l'entreprise propriétaire voyait ses missions — une entreprise de démo ne
 * montrait ses fictions qu'à elle-même. Ouvrir la lecture aux intérimaires a
 * créé le premier chemin par lequel elles pouvaient atteindre un compte réel.
 * La comparaison est symétrique, et non un simple `demo = false` : un compte de
 * démonstration continue de voir les missions de démonstration, ce qui est
 * précisément ce à quoi il sert.
 */
const openToWorkers = (demoParam: string) =>
  `m.status = 'open' AND m.ends_at > now() AND m.demo = ${demoParam}`;

/** Pourquoi une mission n'est pas offerte aux intérimaires. */
export type NotOpenReason = "draft" | "ended" | "closed";

/**
 * Pendant TypeScript de `openToWorkers`, pour les décisions qui ne passent pas
 * par une requête — typiquement : faut-il rapprocher des profils de cette
 * mission ? Le SQL répond « oui / non » ; ici on veut aussi le motif, pour
 * pouvoir le dire à l'entreprise plutôt que de lui servir une liste vide.
 *
 * Les deux prédicats doivent rester d'accord. `missions.test.ts` le vérifie en
 * confrontant, sur les mêmes missions, ce que `listOpen` retient et ce que
 * cette fonction déclare offert.
 *
 * La cloison démo n'est pas reprise : elle sépare deux univers de comptes, et
 * une entreprise consulte toujours ses propres missions, donc son propre
 * univers. Le partage démo / réel reste appliqué là où il a un sens, sur
 * l'ensemble des intérimaires interrogés.
 *
 * `ended` passe avant le statut : un brouillon dont le créneau est passé ne se
 * publie plus, et lui répondre « publiez-la » serait faux.
 */
export function notOpenToWorkers(
  mission: { status: MissionStatus; ends_at: string | Date },
  now: Date = new Date(),
): NotOpenReason | null {
  if (new Date(mission.ends_at) <= now) return "ended";
  if (mission.status === "draft") return "draft";
  if (mission.status !== "open") return "closed";
  return null;
}

/**
 * Missions d'une entreprise.
 *
 * Deux invariants, comme pour le profil intérimaire :
 *  - l'identité de l'entreprise vient TOUJOURS du paramètre `companyId`, issu de
 *    la session authentifiée ; aucune méthode n'accepte d'identifiant du client ;
 *  - une mission appartenant à quelqu'un d'autre est **introuvable** (404), pas
 *    « interdite » (403) : on ne révèle pas son existence.
 */
export class MissionService {
  constructor(
    public db: Db,
    private geocode?: Geocoder,
  ) {}

  private async attachSkills<T extends { id: string; skills: MissionSkill[] }>(
    missions: T[],
  ) {
    if (!missions.length) return missions;
    const { rows } = await this.db.query<{
      mission_id: string;
      id: string;
      name: string;
      required: boolean;
    }>(
      `SELECT ms.mission_id, s.id, s.name, ms.required
         FROM mission_skills ms JOIN skills s ON s.id = ms.skill_id
        WHERE ms.mission_id = ANY($1::uuid[])
        ORDER BY ms.required DESC, s.name`,
      [missions.map((m) => m.id)],
    );
    const bySkill = new Map<string, MissionSkill[]>();
    for (const row of rows) {
      const list = bySkill.get(row.mission_id) ?? [];
      list.push({ id: row.id, name: row.name, required: row.required });
      bySkill.set(row.mission_id, list);
    }
    for (const mission of missions)
      mission.skills = bySkill.get(mission.id) ?? [];
    return missions;
  }

  async list(companyId: string, status?: MissionStatus) {
    const { rows } = await this.db.query<Mission>(
      `SELECT ${COLUMNS} FROM missions m
        WHERE m.company_id = $1 AND ($2::text IS NULL OR m.status = $2)
        ORDER BY m.starts_at DESC`,
      [companyId, status ?? null],
    );
    return this.attachSkills(rows);
  }

  /** Répartition par statut, pour les compteurs des filtres. */
  async counts(companyId: string) {
    const { rows } = await this.db.query<{ status: MissionStatus; n: string }>(
      "SELECT status, count(*)::text AS n FROM missions WHERE company_id=$1 GROUP BY status",
      [companyId],
    );
    return Object.fromEntries(
      rows.map((r) => [r.status, Number(r.n)]),
    ) as Partial<Record<MissionStatus, number>>;
  }

  async get(companyId: string, missionId: string) {
    const { rows } = await this.db.query<Mission>(
      `SELECT ${COLUMNS} FROM missions m WHERE m.id = $1 AND m.company_id = $2`,
      [missionId, companyId],
    );
    if (!rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
    return (await this.attachSkills(rows))[0];
  }

  /** Assemble une ligne de la vue intérimaire : la mission, puis son établissement. */
  private toOpenMission(row: Record<string, unknown>): OpenMission {
    const { establishment_name, sector, company_description, ...mission } = row;
    return {
      ...(mission as Omit<OpenMission, "company">),
      company: {
        establishment_name: (establishment_name as string | null) ?? null,
        sector: (sector as string | null) ?? null,
        description: (company_description as string | null) ?? null,
      },
    };
  }

  /**
   * Missions offertes aux intérimaires, de la plus proche à la plus lointaine.
   *
   * Aucun classement par affinité ici : le rapprochement viendra avec le moteur
   * de matching. L'ordre est celui de la date, qui est le seul objectivement
   * utile tant qu'aucun score n'existe.
   */
  async listOpen(demo: boolean) {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT ${OPEN_COLUMNS}
         FROM missions m
         LEFT JOIN company_profiles c ON c.profile_id = m.company_id
        WHERE ${openToWorkers("$1")}
        ORDER BY m.starts_at`,
      [demo],
    );
    const missions = rows.map((row) => this.toOpenMission(row));
    return this.attachSkills(missions);
  }

  /** Détail d'une mission offerte. Toute autre est introuvable, jamais interdite. */
  async getOpen(missionId: string, demo: boolean) {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT ${OPEN_COLUMNS}
         FROM missions m
         LEFT JOIN company_profiles c ON c.profile_id = m.company_id
        WHERE m.id = $1 AND ${openToWorkers("$2")}`,
      [missionId, demo],
    );
    if (!rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
    return (await this.attachSkills([this.toOpenMission(rows[0])]))[0];
  }

  /**
   * Création. Le géocodage est effectué hors transaction — un appel réseau ne
   * doit pas retenir une connexion — et son échec ne bloque jamais la création :
   * les coordonnées restent nulles et pourront être recalculées.
   */
  async create(
    companyId: string,
    input: MissionInput,
    options: { demo?: boolean } = {},
  ) {
    const coordinates =
      this.geocode && (await this.geocode(input.city, input.postal_code));
    const skillIds = [...input.required_skill_ids, ...input.desired_skill_ids];
    return this.db.transaction(async (db) => {
      await this.assertKnownSkills(db, skillIds);
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO missions(company_id, title, description, job, starts_at, ends_at,
            address, city, postal_code, latitude, longitude, geocoded_at,
            pay_amount, pay_unit, headcount, min_years_experience, demo)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          companyId,
          input.title,
          input.description,
          input.job,
          input.starts_at,
          input.ends_at,
          input.address,
          input.city,
          input.postal_code,
          coordinates ? coordinates.latitude : null,
          coordinates ? coordinates.longitude : null,
          coordinates ? new Date().toISOString() : null,
          input.pay_amount,
          input.pay_unit,
          input.headcount,
          input.min_years_experience,
          options.demo ?? false,
        ],
      );
      const id = rows[0].id;
      await this.writeSkills(
        db,
        id,
        input.required_skill_ids,
        input.desired_skill_ids,
      );
      return id;
    });
  }

  /** Refuse d'un bloc une liste contenant une compétence hors référentiel. */
  private async assertKnownSkills(db: Db, skillIds: string[]) {
    if (!skillIds.length) return;
    const known = await db.query(
      "SELECT id FROM skills WHERE id = ANY($1::uuid[])",
      [skillIds],
    );
    if (known.rows.length !== new Set(skillIds).size)
      throw new HttpError(400, "INVALID_SKILLS", "Compétence inconnue.");
  }

  private async writeSkills(
    db: Db,
    missionId: string,
    required: string[],
    desired: string[],
  ) {
    for (const [ids, isRequired] of [
      [required, true],
      [desired, false],
    ] as const)
      for (const skillId of ids)
        await db.query(
          "INSERT INTO mission_skills(mission_id, skill_id, required) VALUES($1,$2,$3)",
          [missionId, skillId, isRequired],
        );
  }

  /**
   * Charge la mission et verrouille sa ligne pour la durée de la transaction.
   * Une mission appartenant à une autre entreprise est **introuvable**, comme
   * pour `get` : le 404 ne révèle pas qu'elle existe ailleurs.
   */
  private async lock(db: Db, companyId: string, missionId: string) {
    const { rows } = await db.query<{
      status: MissionStatus;
      starts_at: string | Date;
      ends_at: string | Date;
      city: string;
      postal_code: string;
      pay_amount: string | null;
      pay_unit: string | null;
    }>(
      `SELECT status, starts_at, ends_at, city, postal_code, pay_amount, pay_unit
         FROM missions WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [missionId, companyId],
    );
    if (!rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
    const { rows: skills } = await db.query<{ id: string; required: boolean }>(
      "SELECT skill_id AS id, required FROM mission_skills WHERE mission_id = $1",
      [missionId],
    );
    return {
      ...rows[0],
      required_skill_ids: skills.filter((s) => s.required).map((s) => s.id),
      desired_skill_ids: skills.filter((s) => !s.required).map((s) => s.id),
    };
  }

  /**
   * Modification partielle. Un champ absent reste inchangé ; `null` sur un champ
   * qui l'accepte est un effacement volontaire. Tout se joue dans une seule
   * transaction : une compétence inconnue laisse la mission strictement intacte.
   */
  async update(companyId: string, missionId: string, patch: MissionPatch) {
    await this.db.transaction(async (db) => {
      const current = await this.lock(db, companyId, missionId);
      const keep = <T>(sent: T | undefined, stored: T) =>
        sent === undefined ? stored : sent;

      // Les règles croisées se jugent sur l'état final, pas sur la requête :
      // envoyer `ends_at` seul peut le placer avant un `starts_at` enregistré.
      const iso = (value: string | Date) => new Date(value).toISOString();
      const final = {
        starts_at: keep(patch.starts_at, iso(current.starts_at)),
        ends_at: keep(patch.ends_at, iso(current.ends_at)),
        pay_amount: keep(
          patch.pay_amount,
          current.pay_amount === null ? null : Number(current.pay_amount),
        ),
        pay_unit: keep(patch.pay_unit, current.pay_unit),
        required_skill_ids: keep(
          patch.required_skill_ids,
          current.required_skill_ids,
        ),
        desired_skill_ids: keep(
          patch.desired_skill_ids,
          current.desired_skill_ids,
        ),
      };
      const broken = brokenRule(final);
      if (broken) throw new HttpError(400, "INVALID_MISSION", broken);

      const values: unknown[] = [];
      const assignments: string[] = [];
      const set = (column: string, value: unknown) => {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      };
      for (const column of writableColumns)
        if (patch[column] !== undefined) set(column, patch[column]);

      // Ne géocoder que si la localisation change réellement : une modification
      // de titre ne doit pas déclencher d'appel réseau.
      const relocated =
        (patch.city !== undefined && patch.city !== current.city) ||
        (patch.postal_code !== undefined &&
          patch.postal_code !== current.postal_code);
      if (relocated) {
        // Le géocodeur renonce en silence et renvoie null : la modification
        // aboutit quand même. Les anciennes coordonnées sont effacées plutôt
        // que conservées — elles désignent l'ancienne ville.
        const coordinates = this.geocode
          ? await this.geocode(
              keep(patch.city, current.city),
              keep(patch.postal_code, current.postal_code),
            )
          : null;
        set("latitude", coordinates?.latitude ?? null);
        set("longitude", coordinates?.longitude ?? null);
        set("geocoded_at", coordinates ? new Date().toISOString() : null);
      }

      if (assignments.length) {
        values.push(missionId, companyId);
        await db.query(
          `UPDATE missions SET ${assignments.join(", ")}
             WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
          values,
        );
      }

      if (
        patch.required_skill_ids !== undefined ||
        patch.desired_skill_ids !== undefined
      ) {
        await this.assertKnownSkills(db, [
          ...final.required_skill_ids,
          ...final.desired_skill_ids,
        ]);
        await db.query("DELETE FROM mission_skills WHERE mission_id = $1", [
          missionId,
        ]);
        await this.writeSkills(
          db,
          missionId,
          final.required_skill_ids,
          final.desired_skill_ids,
        );
      }
    });
    return this.get(companyId, missionId);
  }

  private assertTransition(from: MissionStatus, to: MissionStatus) {
    if (!transitions[from]?.includes(to))
      throw new HttpError(
        409,
        "INVALID_TRANSITION",
        `Une mission « ${from} » ne peut pas passer à « ${to} ».`,
      );
  }

  /**
   * Publication : `draft` → `open`. `published_at` est posé par le serveur, le
   * client ne peut ni le fournir ni changer `status` par une modification.
   */
  async publish(companyId: string, missionId: string) {
    await this.db.transaction(async (db) => {
      const current = await this.lock(db, companyId, missionId);
      this.assertTransition(current.status, "open");
      if (new Date(current.starts_at).getTime() <= Date.now())
        throw new HttpError(
          409,
          "MISSION_ALREADY_STARTED",
          "Une mission déjà commencée ne peut plus être publiée.",
        );
      await db.query(
        "UPDATE missions SET status = 'open', published_at = now() WHERE id = $1 AND company_id = $2",
        [missionId, companyId],
      );
    });
    return this.get(companyId, missionId);
  }

  /** Vérifie qu'un profil est bien une entreprise avant de lui attacher une mission. */
  async assertCompany(companyId: string) {
    const { rows } = await this.db.query<{ role: string }>(
      "SELECT role FROM profiles WHERE id=$1",
      [companyId],
    );
    if (rows[0]?.role !== "company")
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Cet espace ne correspond pas à votre rôle.",
      );
  }
}
