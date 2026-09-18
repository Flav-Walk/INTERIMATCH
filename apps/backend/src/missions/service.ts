import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { BusinessEventPublisher } from "../events/dispatcher.js";
import { loadMissionEventData } from "../events/payloads.js";
import type { Geocoder } from "../worker/geocode.js";
import { missionGroup, missionLifecycle } from "./lifecycle.js";
import type { MissionGroup } from "./lifecycle.js";
import {
  brokenRule,
  type Mission,
  type MissionInput,
  type MissionPatch,
  type MissionSkill,
  type MissionCapacity,
  type MissionStatus,
  type OpenMission,
} from "./schemas.js";

export {
  missionGroup,
  missionLifecycle,
  missionPhase,
  notOpenToWorkers,
  type MissionGroup,
  type MissionLifecycle,
  type MissionPhase,
  type NotOpenReason,
} from "./lifecycle.js";

/**
 * Transitions de statut autorisées, déclarées à un seul endroit.
 *
 * Deux seulement, et c'est délibéré : ce sont les deux seules décisions qu'une
 * entreprise prend réellement. Tout le reste de ce qu'on appelle couramment
 * « le statut d'une mission » — pourvue, à venir, en cours, terminée — se lit
 * dans les dates et le décompte des acceptations, et n'a donc pas à s'écrire.
 * Voir `lifecycle.ts` pour le raisonnement complet.
 *
 * L'annulation part de `open` seulement. Un brouillon n'a jamais été offert à
 * personne : l'annuler ne retirerait rien et n'avertirait personne, alors que
 * l'événement `mission.cancelled` promet le contraire. Un brouillon dont on ne
 * veut plus se modifie ou se laisse là, il ne s'annule pas.
 */
const transitions: Partial<Record<MissionStatus, readonly MissionStatus[]>> = {
  draft: ["open"],
  open: ["cancelled"],
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
  `m.status = 'open' AND m.ends_at > now() AND m.demo = ${demoParam}
   AND (SELECT count(*) FROM applications a
         WHERE a.mission_id = m.id AND a.status = 'accepted') < m.headcount`;

/**
 * Capacité d'une mission, lue à la demande.
 *
 * Fonction libre plutôt que méthode : le service des candidatures en a besoin
 * et n'a aucune dépendance vers `MissionService`. Lui en donner une pour un
 * décompte serait cher payé ; dupliquer la règle le serait davantage.
 */
export async function capacityOf(
  db: Db,
  missionId: string,
): Promise<MissionCapacity | null> {
  const { rows } = await db.query<{ headcount: number; filled: string }>(
    `SELECT m.headcount,
            count(a.id) FILTER (WHERE a.status = 'accepted')::text AS filled
       FROM missions m
       LEFT JOIN applications a ON a.mission_id = m.id
      WHERE m.id = $1
      GROUP BY m.id, m.headcount`,
    [missionId],
  );
  if (!rows[0]) return null;
  const filled = Number(rows[0].filled);
  return {
    headcount: rows[0].headcount,
    filled,
    // Borné à zéro, comme dans `attachCapacity` : une seule et même promesse.
    remaining: Math.max(0, rows[0].headcount - filled),
    full: filled >= rows[0].headcount,
  };
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
    private events?: BusinessEventPublisher,
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

  /**
   * Attache à chaque mission son recrutement et sa position dans le cycle.
   *
   * Même forme qu'`attachSkills` : une seule lecture pour toute la liste. La
   * jointure est externe, car une mission sans aucune candidature acceptée doit
   * répondre « zéro poste pourvu », pas disparaître du décompte.
   *
   * Les deux sont posés ensemble parce qu'ils viennent du même décompte : la
   * phase a besoin de savoir si quelqu'un est retenu pour distinguer « à venir »
   * de « publiée », et `recruiting` a besoin de savoir s'il reste une place. Les
   * calculer en deux passes rouvrirait la porte à deux réponses divergentes.
   *
   * L'instant de lecture est fixé une fois pour toute la liste : deux missions
   * de la même réponse ne doivent pas être jugées à deux millisecondes d'écart.
   */
  private async attachCapacity<
    T extends {
      id: string;
      headcount: number;
      status: MissionStatus;
      starts_at: string | Date;
      ends_at: string | Date;
      capacity?: MissionCapacity;
    },
  >(missions: T[]) {
    if (!missions.length) return missions;
    const now = new Date();
    const { rows } = await this.db.query<{ mission_id: string; n: string }>(
      `SELECT mission_id, count(*)::text AS n FROM applications
        WHERE mission_id = ANY($1::uuid[]) AND status = 'accepted'
        GROUP BY mission_id`,
      [missions.map((m) => m.id)],
    );
    const filledBy = new Map(
      rows.map((row) => [row.mission_id, Number(row.n)]),
    );
    for (const mission of missions) {
      const filled = filledBy.get(mission.id) ?? 0;
      mission.capacity = {
        headcount: mission.headcount,
        filled,
        // Borné à zéro : si une donnée héritée dépassait la capacité, annoncer
        // « -1 poste restant » n'aiderait personne.
        remaining: Math.max(0, mission.headcount - filled),
        full: filled >= mission.headcount,
      };
      Object.assign(mission, missionLifecycle(mission, mission.capacity, now));
    }
    return missions;
  }

  async list(companyId: string, status?: MissionStatus) {
    const { rows } = await this.db.query<Mission>(
      `SELECT ${COLUMNS} FROM missions m
        WHERE m.company_id = $1 AND ($2::text IS NULL OR m.status = $2)
        ORDER BY m.starts_at DESC`,
      [companyId, status ?? null],
    );
    return this.attachCapacity(await this.attachSkills(rows));
  }

  /**
   * Répartition par onglet, pour les compteurs des filtres.
   *
   * COMPTAIT AUTREFOIS PAR STATUT ÉCRIT, et se trompait donc exactement là où
   * les onglets se trompaient : `filled` et `completed` n'étant jamais écrits,
   * leurs compteurs affichaient zéro en permanence, quel que soit le nombre de
   * missions réellement pourvues ou passées.
   *
   * Le regroupement est désormais celui de `missionGroup`, la même fonction que
   * celle posée sur chaque mission servie. Compteur et liste ne peuvent donc
   * plus diverger : ils répondent à la même question par le même chemin.
   *
   * Le regroupement se fait en mémoire plutôt qu'en SQL. La règle croise trois
   * dimensions dont l'une, la capacité, vit dans une autre table ; l'écrire une
   * seconde fois en SQL, c'est accepter qu'elle diverge. Le volume d'un POC ne
   * justifie pas ce risque, et l'instant de lecture est fixé une fois pour
   * toutes.
   */
  async counts(companyId: string) {
    const { rows } = await this.db.query<{
      status: MissionStatus;
      starts_at: string | Date;
      ends_at: string | Date;
      headcount: number;
      filled: number;
    }>(
      `SELECT m.status, m.starts_at, m.ends_at, m.headcount,
              count(a.id) FILTER (WHERE a.status = 'accepted')::int AS filled
         FROM missions m
         LEFT JOIN applications a ON a.mission_id = m.id
        WHERE m.company_id = $1
        GROUP BY m.id, m.status, m.starts_at, m.ends_at, m.headcount`,
      [companyId],
    );
    const now = new Date();
    const tally: Partial<Record<MissionGroup, number>> = {};
    for (const row of rows) {
      const group = missionGroup(
        row,
        { full: row.filled >= row.headcount },
        now,
      );
      tally[group] = (tally[group] ?? 0) + 1;
    }
    return tally;
  }

  async get(companyId: string, missionId: string) {
    const { rows } = await this.db.query<Mission>(
      `SELECT ${COLUMNS} FROM missions m WHERE m.id = $1 AND m.company_id = $2`,
      [missionId, companyId],
    );
    if (!rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
    return (await this.attachCapacity(await this.attachSkills(rows)))[0];
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
    return this.attachCapacity(await this.attachSkills(missions));
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
    return (
      await this.attachCapacity(
        await this.attachSkills([this.toOpenMission(rows[0])]),
      )
    )[0];
  }

  /**
   * Détail worker : une offre encore disponible, ou une mission déjà présente
   * dans son historique de candidatures. Cette seconde voie ne la remet jamais
   * dans la liste des propositions et ne permet pas de candidater à nouveau.
   */
  async getForWorker(missionId: string, demo: boolean, workerId: string) {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT ${OPEN_COLUMNS}
         FROM missions m
         LEFT JOIN company_profiles c ON c.profile_id = m.company_id
        WHERE m.id = $1
          AND (${openToWorkers("$2")}
               OR (m.demo = $2 AND EXISTS (
                    SELECT 1 FROM applications a
                     WHERE a.mission_id = m.id AND a.worker_id = $3)))`,
      [missionId, demo, workerId],
    );
    if (!rows[0])
      throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");
    return (
      await this.attachCapacity(
        await this.attachSkills([this.toOpenMission(rows[0])]),
      )
    )[0];
  }

  /** Une mission pleine reste dans l'historique entreprise, mais sort du matching. */
  /** Capacité d'une mission isolée. Voir `capacityOf`. */
  capacity(missionId: string) {
    return capacityOf(this.db, missionId);
  }

  async hasCapacity(missionId: string) {
    const { rows } = await this.db.query<{ available: boolean }>(
      `SELECT count(a.id) < m.headcount AS available
         FROM missions m
         LEFT JOIN applications a
           ON a.mission_id = m.id AND a.status = 'accepted'
        WHERE m.id = $1
        GROUP BY m.id, m.headcount`,
      [missionId],
    );
    return rows[0]?.available === true;
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
    const eventData = await this.db.transaction(async (db) => {
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
      return loadMissionEventData(db, missionId);
    });
    const mission = await this.get(companyId, missionId);
    // Publication après COMMIT et relecture finale : une transition refusée,
    // rollbackée ou une réponse métier incomplète ne produit aucune notification.
    this.events?.publish("mission.published", eventData);
    return mission;
  }

  /**
   * Annulation : `open` → `cancelled`. L'entreprise retire son offre.
   *
   * CE QUE L'ANNULATION NE FAIT PAS. Elle n'écrit pas une ligne dans
   * `applications`. Aucune candidature n'est supprimée, aucune n'est refusée
   * d'office, aucune acceptation n'est défaite. C'est le choix le plus
   * conservateur, et c'est aussi le seul honnête : quelqu'un qui avait été
   * retenu l'avait bien été, et le marquer « refusé » après coup réécrirait son
   * historique pour une décision qui n'est pas la sienne. Le statut de la
   * mission porte à lui seul toute l'information — « vous étiez accepté sur une
   * mission annulée » se lit en croisant les deux, et reste vrai indéfiniment.
   *
   * CE QU'ELLE PRODUIT QUAND MÊME. Le créneau de l'intérimaire se libère
   * immédiatement, sans qu'aucune donnée ne bouge : le déclencheur
   * `applications_engagement` (migration 008) et la lecture `engagedElsewhere`
   * ignorent tous deux les missions annulées. Une personne retenue sur une
   * mission annulée peut donc être acceptée le jour même ailleurs, ce qui est
   * exactement ce que le métier attend.
   *
   * POURQUOI LE CRÉNEAU COMMENCÉ EST REFUSÉ. Une fois la mission en cours, des
   * gens sont sur place. « Annuler » n'y voudrait plus dire retirer une offre
   * mais interrompre un travail commencé — une autre décision, avec d'autres
   * conséquences (heures dues, remplacement), qu'aucune partie du système ne
   * sait traiter aujourd'hui. Prétendre la couvrir d'un changement de statut
   * serait pire que ne pas l'offrir.
   */
  async cancel(companyId: string, missionId: string) {
    const eventData = await this.db.transaction(async (db) => {
      const current = await this.lock(db, companyId, missionId);
      this.assertTransition(current.status, "cancelled");
      const now = Date.now();
      if (new Date(current.ends_at).getTime() <= now)
        throw new HttpError(
          409,
          "MISSION_ENDED",
          "Une mission terminée ne peut plus être annulée.",
        );
      if (new Date(current.starts_at).getTime() <= now)
        throw new HttpError(
          409,
          "MISSION_ALREADY_STARTED",
          "Une mission déjà commencée ne peut plus être annulée.",
        );
      await db.query(
        "UPDATE missions SET status = 'cancelled' WHERE id = $1 AND company_id = $2",
        [missionId, companyId],
      );
      return loadMissionEventData(db, missionId);
    });
    const mission = await this.get(companyId, missionId);
    // Après COMMIT, comme la publication : une annulation refusée ou rollbackée
    // ne doit jamais faire partir d'avis d'annulation.
    this.events?.publish("mission.cancelled", eventData);
    return mission;
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
