import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { capacityOf } from "../missions/service.js";
import { missionLifecycle, notOpenToWorkers } from "../missions/lifecycle.js";
import type { MissionStatus } from "../missions/schemas.js";
import type { BusinessEventPublisher } from "../events/dispatcher.js";
import { loadApplicationEventData } from "../events/payloads.js";
import type { ApplicationStatus } from "./schemas.js";
import type { ContractService } from "../contracts/service.js";

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
  mission_status: MissionStatus;
  headcount: number;
  mission_filled: number;
  establishment_name: string | null;
}

/** Ce qu'une candidature emporte de sa mission dans la vue d'ensemble. */
interface MissionSummaryRow {
  title: string;
  job: string;
  mission_starts_at: Date | string;
  mission_ends_at: Date | string;
  mission_city: string;
  mission_status: MissionStatus;
  mission_filled: number;
  headcount: number;
}

interface CompanyApplicationRow extends ApplicationRow {
  first_name: string;
  last_name: string;
  city: string | null;
  main_job: string | null;
  /**
   * L'intérimaire est déjà engagé ailleurs sur ce créneau.
   *
   * Un booléen, volontairement. Nommer la mission concurrente apprendrait à
   * cette entreprise où travaille l'intérimaire, et pour le compte de qui :
   * ce n'est pas une information qu'une candidature lui donne le droit d'avoir.
   */
  conflict?: boolean;
}

/**
 * Cet intérimaire est-il déjà engagé ailleurs pendant ce créneau ?
 *
 * Deux missions se disputent quelqu'un si et seulement si chacune commence avant
 * que l'autre ne finisse. Bornes semi-ouvertes [début, fin), comme partout
 * ailleurs : une mission qui s'achève à 16 h et une autre qui débute à 16 h se
 * cumulent, ce qui est le quotidien du métier.
 *
 * Les quatre fragments sont des noms de colonnes ou des repères de paramètres,
 * écrits dans ce fichier — jamais des valeurs venues d'une requête. La lecture
 * et la décision partagent ce fragment pour qu'elles ne puissent pas répondre
 * différemment à la même question.
 */
const engagedElsewhere = (sql: {
  worker: string;
  mission: string;
  start: string;
  end: string;
}) => `
  EXISTS (SELECT 1 FROM applications a2
            JOIN missions m2 ON m2.id = a2.mission_id
           WHERE a2.worker_id = ${sql.worker}
             AND a2.status = 'accepted'
             AND a2.mission_id <> ${sql.mission}
             AND m2.status <> 'cancelled'
             AND m2.starts_at < ${sql.end}
             AND ${sql.start} < m2.ends_at)`;

const applicationFields =
  "a.id,a.mission_id,a.worker_id,a.status,a.created_at,a.updated_at";

/**
 * Nombre d'intérimaires retenus sur la mission de la ligne courante.
 *
 * C'est la seule information qui manque, dans une liste de candidatures, pour
 * situer la mission dans son cycle : les dates et le statut sont déjà là, le
 * décompte des acceptations sépare « à venir » de « publiée ». Sous-requête
 * corrélée plutôt que jointure agrégée, parce qu'elle tombe exactement sur
 * `applications_accepted_idx`, l'index partiel de la migration 007.
 */
const acceptedOnMission = `(SELECT count(*) FROM applications af
    WHERE af.mission_id=m.id AND af.status='accepted')::int AS mission_filled`;

/**
 * Ce qu'une candidature doit dire de la mission qu'elle vise.
 *
 * CE QUI MANQUAIT. Une candidature en attente sur une mission dont tous les
 * postes viennent d'être pourvus s'affichait exactement comme une candidature
 * encore jouable : « en attente », indéfiniment. L'entreprise, elle, voyait
 * déjà qu'elle ne pouvait plus la retenir. Les deux côtés décrivaient la même
 * situation différemment, et c'est l'intérimaire qui restait dans le flou.
 *
 * La candidature n'est pas modifiée pour autant — voir `decide` : une place
 * prise ailleurs n'est pas un refus de l'entreprise, et l'écrire serait lui
 * attribuer une décision qu'elle n'a pas prise. C'est le contexte qui manquait,
 * pas le statut.
 *
 * `missionLifecycle` est réutilisée telle quelle : `phase`, `recruiting` et
 * `recruiting_blocked` ont ici exactement le sens qu'ils ont sur une mission
 * servie par `MissionService`. Deux vocabulaires pour une même notion auraient
 * fini par diverger.
 */
const missionContext = (row: {
  status: MissionStatus;
  starts_at: Date | string;
  ends_at: Date | string;
  headcount: number;
  filled: number;
}) => {
  const capacity = {
    headcount: row.headcount,
    filled: row.filled,
    remaining: Math.max(0, row.headcount - row.filled),
    full: row.filled >= row.headcount,
  };
  return { capacity, ...missionLifecycle(row, capacity, new Date()) };
};

const databaseCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;

export class ApplicationService {
  constructor(
    public readonly db: Db,
    private events?: BusinessEventPublisher,
    private contracts?: ContractService,
  ) {}

  /**
   * La mission doit être exactement celle qu'un worker peut encore consulter :
   * publiée, non terminée et du même univers réel/démo que son compte.
   */
  async create(workerId: string, missionId: string) {
    const outcome = await this.db.transaction(async (db) => {
      const mission = await db.query<{
        id: string;
        headcount: number;
        status: MissionStatus;
        starts_at: Date | string;
        ends_at: Date | string;
        mission_demo: boolean;
        worker_demo: boolean;
      }>(
        `SELECT m.id,m.headcount,m.status,m.starts_at,m.ends_at,
                m.demo AS mission_demo,p.demo AS worker_demo
           FROM missions m
           JOIN profiles p ON p.id=$2
          WHERE m.id=$1
          FOR SHARE OF m,p`,
        [missionId, workerId],
      );
      const target = mission.rows[0];
      if (!target || target.mission_demo !== target.worker_demo)
        throw new HttpError(404, "MISSION_NOT_FOUND", "Mission introuvable.");

      // Le motif, et plus seulement le refus. « Cette mission n'accepte plus de
      // candidatures » est vrai d'un brouillon, d'une mission annulée et d'une
      // mission passée — trois situations que l'intérimaire ne vit pas de la
      // même façon, et dont une seule signifie qu'il a raté quelque chose.
      const blocked = notOpenToWorkers(target);
      if (blocked === "cancelled")
        throw new HttpError(
          409,
          "MISSION_CANCELLED",
          "Cette mission a été annulée par l’entreprise.",
        );
      if (blocked === "ended")
        throw new HttpError(
          409,
          "MISSION_ENDED",
          "Cette mission est terminée.",
        );
      if (blocked)
        throw new HttpError(
          409,
          "APPLICATION_CLOSED",
          "Cette mission n’accepte plus de candidatures.",
        );

      // Le verrou partagé sur la mission est acquis avant le décompte. Une
      // acceptation concurrente verrouille la même ligne en écriture : après
      // son commit, cette lecture voit donc la capacité réellement restante.
      const accepted = Number(
        (
          await db.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM applications
              WHERE mission_id=$1 AND status='accepted'`,
            [missionId],
          )
        ).rows[0].n,
      );
      if (accepted >= target.headcount)
        throw new HttpError(
          409,
          "MISSION_FULL",
          target.headcount > 1
            ? `Les ${target.headcount} postes de cette mission sont déjà pourvus.`
            : "Le poste de cette mission est déjà pourvu.",
        );

      try {
        const application = (
          await db.query<ApplicationRow>(
            `INSERT INTO applications(mission_id,worker_id)
             VALUES($1,$2)
             RETURNING id,mission_id,worker_id,status,created_at,updated_at`,
            [missionId, workerId],
          )
        ).rows[0];
        return {
          application,
          eventData: await loadApplicationEventData(db, application.id),
        };
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
    // L'identifiant n'est publié qu'après le COMMIT de la nouvelle candidature.
    this.events?.publish("application.created", outcome.eventData);
    return outcome.application;
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
              m.status AS mission_status,m.headcount,${acceptedOnMission},
              c.establishment_name
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
        // L'intérimaire doit pouvoir distinguer « ma mission est annulée » de
        // « ma mission est passée » — et de « tous les postes sont pris » —
        // sans rejouer aucune de ces règles dans le navigateur.
        ...missionContext({
          status: row.mission_status,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          headcount: row.headcount,
          filled: row.mission_filled,
        }),
      },
      company: { establishment_name: row.establishment_name },
    }));
  }

  /**
   * Toutes les candidatures reçues par une entreprise, missions confondues.
   *
   * C'est la vue qui manquait : jusqu'ici, savoir si quelqu'un avait postulé
   * imposait d'ouvrir les missions une par une. Une entreprise ne doit pas avoir
   * à chercher ce qui lui est adressé.
   *
   * La liste est bornée. Un POC ne produit pas des milliers de candidatures, et
   * une page qui en afficherait autant ne serait de toute façon pas lisible ;
   * `counts` reste exact quel que soit le nombre renvoyé, pour que le compteur
   * ne mente jamais même si la liste est tronquée.
   */
  async listForCompany(companyId: string, limit = 200) {
    const conflict = engagedElsewhere({
      worker: "a.worker_id",
      mission: "a.mission_id",
      start: "m.starts_at",
      end: "m.ends_at",
    });
    const [list, tally] = await Promise.all([
      this.db.query<CompanyApplicationRow & MissionSummaryRow>(
        `SELECT ${applicationFields},p.first_name,p.last_name,
                w.city,w.main_job,${conflict} AS conflict,
                m.title,m.job,m.starts_at AS mission_starts_at,
                m.ends_at AS mission_ends_at,m.city AS mission_city,
                m.status AS mission_status,m.headcount,${acceptedOnMission}
           FROM applications a
           JOIN missions m ON m.id=a.mission_id
           JOIN profiles p ON p.id=a.worker_id
           LEFT JOIN worker_profiles w ON w.profile_id=a.worker_id
          WHERE m.company_id=$1
          ORDER BY a.created_at DESC,a.id
          LIMIT $2`,
        [companyId, limit],
      ),
      this.db.query<{ status: ApplicationStatus; n: string }>(
        `SELECT a.status,count(*)::text AS n
           FROM applications a JOIN missions m ON m.id=a.mission_id
          WHERE m.company_id=$1 GROUP BY a.status`,
        [companyId],
      ),
    ]);

    const counts = { pending: 0, accepted: 0, rejected: 0, total: 0 };
    for (const row of tally.rows) {
      counts[row.status] = Number(row.n);
      counts.total += Number(row.n);
    }
    return {
      applications: list.rows.map((row) => ({
        ...this.toCompanyApplication(row),
        mission: {
          id: row.mission_id,
          title: row.title,
          job: row.job,
          starts_at: row.mission_starts_at,
          ends_at: row.mission_ends_at,
          city: row.mission_city,
          status: row.mission_status,
          headcount: row.headcount,
          ...missionContext({
            status: row.mission_status,
            starts_at: row.mission_starts_at,
            ends_at: row.mission_ends_at,
            headcount: row.headcount,
            filled: row.mission_filled,
          }),
        },
      })),
      counts,
    };
  }

  /**
   * Candidatures d'une mission, avec l'état de son recrutement.
   *
   * Les deux vont ensemble : décider d'une candidature sans savoir s'il reste
   * une place, c'est cliquer « Accepter » pour découvrir un refus. La capacité
   * est donc servie par le même appel, et non par un second aller-retour qui
   * pourrait déjà être périmé.
   */
  async listForMission(companyId: string, missionId: string) {
    await this.assertOwnedMission(this.db, companyId, missionId);
    const conflict = engagedElsewhere({
      worker: "a.worker_id",
      mission: "a.mission_id",
      start: "m.starts_at",
      end: "m.ends_at",
    });
    const { rows } = await this.db.query<CompanyApplicationRow>(
      `SELECT ${applicationFields},p.first_name,p.last_name,
              w.city,w.main_job,${conflict} AS conflict
         FROM applications a
         JOIN missions m ON m.id=a.mission_id
         JOIN profiles p ON p.id=a.worker_id
         LEFT JOIN worker_profiles w ON w.profile_id=a.worker_id
        WHERE a.mission_id=$1
        ORDER BY a.created_at DESC,a.id`,
      [missionId],
    );
    return {
      applications: rows.map((row) => this.toCompanyApplication(row)),
      capacity: await capacityOf(this.db, missionId),
    };
  }

  /**
   * Décision d'une entreprise sur une candidature.
   *
   * Trois refus possibles, dans cet ordre, et aucun n'est cosmétique :
   *  - la candidature a déjà reçu une décision ;
   *  - la mission n'a plus de poste libre ;
   *  - l'intérimaire s'est engagé ailleurs sur ce créneau depuis qu'il a postulé.
   *
   * Le refus, lui, n'est jamais bloqué. Une candidature devenue impossible à
   * accepter doit rester close-able : l'entreprise a le droit de clore un
   * dossier qu'elle ne peut plus honorer.
   *
   * La transaction commence par verrouiller la **mission**, pas la candidature.
   * C'est ce qui sérialise deux responsables qui acceptent en même temps deux
   * candidatures différentes de la même mission — le cas que le verrou sur la
   * seule ligne candidature laissait passer, puisque ces deux lignes sont
   * distinctes et ne se voient pas.
   */
  async decide(
    companyId: string,
    missionId: string,
    applicationId: string,
    status: "accepted" | "rejected",
  ) {
    const outcome = await this.db.transaction(async (db) => {
      const mission = (
        await db.query<{
          headcount: number;
          status: MissionStatus;
          starts_at: Date | string;
          ends_at: Date | string;
        }>(
          `SELECT headcount,status,starts_at,ends_at FROM missions
            WHERE id=$1 AND company_id=$2 FOR UPDATE`,
          [missionId, companyId],
        )
      ).rows[0];
      // Mission d'une autre entreprise : la candidature est déclarée
      // introuvable, comme avant. On ne révèle pas l'existence de la mission.
      if (!mission)
        throw new HttpError(
          404,
          "APPLICATION_NOT_FOUND",
          "Candidature introuvable.",
        );

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

      if (status === "accepted") {
        // L'état de la mission passe avant tout le reste.
        //
        // Ce contrôle manquait : `decide()` ne lisait que la capacité et
        // l'engagement, si bien qu'une mission annulée — ou dont le créneau
        // était passé — continuait d'accepter des candidatures. On engageait
        // quelqu'un sur un travail qui n'aurait pas lieu, ou qui avait déjà eu
        // lieu sans lui.
        //
        // Le refus, lui, reste ouvert dans tous les cas : il est plus bas, hors
        // de cette branche. Une entreprise qui annule doit pouvoir continuer de
        // clore les dossiers en attente — c'est même la seule chose qu'il lui
        // reste à faire.
        const blocked = notOpenToWorkers(mission);
        if (blocked === "cancelled")
          throw new HttpError(
            409,
            "MISSION_CANCELLED",
            "Cette mission a été annulée : elle ne peut plus recruter.",
          );
        if (blocked === "ended")
          throw new HttpError(
            409,
            "MISSION_ENDED",
            "Cette mission est terminée : elle ne peut plus recruter.",
          );

        // Verrou sur la personne, avant de chercher un conflit.
        //
        // Le verrou pris plus haut porte sur la mission : il empêche deux
        // acceptations concurrentes de dépasser la capacité **de cette
        // mission**. Il ne dit rien de ce qui se décide au même instant sur une
        // autre mission pour la même personne — deux entreprises verrouillent
        // alors deux lignes différentes et ne se voient pas.
        //
        // Celui-ci sérialise toutes les acceptations visant cet intérimaire.
        // L'ordre reste mission puis personne, partout, donc sans interblocage.
        // Le déclencheur `applications_engagement` tient la même garantie en
        // base ; ce verrou-ci existe pour que la seconde entreprise reçoive un
        // refus métier lisible plutôt qu'une erreur du moteur SQL.
        await db.query("SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE", [
          application.worker_id,
        ]);

        const taken = Number(
          (
            await db.query<{ n: string }>(
              `SELECT count(*)::text AS n FROM applications
                WHERE mission_id=$1 AND status='accepted'`,
              [missionId],
            )
          ).rows[0].n,
        );
        if (taken >= mission.headcount)
          throw new HttpError(
            409,
            "MISSION_FULL",
            mission.headcount > 1
              ? `Les ${mission.headcount} postes de cette mission sont déjà pourvus.`
              : "Le poste de cette mission est déjà pourvu.",
          );

        const clash = engagedElsewhere({
          worker: "$1",
          mission: "$4",
          start: "$2::timestamptz",
          end: "$3::timestamptz",
        });
        const engaged = (
          await db.query<{ engaged: boolean }>(`SELECT ${clash} AS engaged`, [
            application.worker_id,
            new Date(mission.starts_at).toISOString(),
            new Date(mission.ends_at).toISOString(),
            missionId,
          ])
        ).rows[0].engaged;
        if (engaged)
          throw new HttpError(
            409,
            "WORKER_ENGAGED",
            "Cette personne a accepté une autre mission sur ce créneau.",
          );
      }

      const updated = await this.write(
        db,
        applicationId,
        status,
        mission.headcount,
      );
      return {
        application: this.toCompanyApplication({ ...application, ...updated }),
        eventData: await loadApplicationEventData(db, applicationId),
      };
    });
    // Une seule transition est autorisée depuis pending. L'émission après
    // COMMIT garantit qu'un refus métier ou un rollback ne part jamais vers n8n.
    this.events?.publish(`application.${status}`, outcome.eventData);
    if (status === "accepted")
      await this.contracts?.onApplicationAccepted(outcome.application.id);
    return outcome.application;
  }

  /**
   * Écrit la décision, en traduisant les refus de la base en refus métier.
   *
   * Les deux déclencheurs — capacité et engagement — sont la garantie réelle :
   * ils tiennent même pour une écriture qui ne passerait pas par ce service. Le
   * service les précède par ses propres contrôles, si bien qu'en temps normal
   * ils ne parlent jamais. Mais s'ils parlent, l'appelant doit lire un motif,
   * pas une erreur de contrainte.
   */
  private async write(
    db: Db,
    applicationId: string,
    status: "accepted" | "rejected",
    headcount: number,
  ) {
    try {
      return (
        await db.query<ApplicationRow>(
          `UPDATE applications SET status=$2
            WHERE id=$1
            RETURNING id,mission_id,worker_id,status,created_at,updated_at`,
          [applicationId, status],
        )
      ).rows[0];
    } catch (error) {
      if (databaseCode(error) !== "23514") throw error;
      const message = String((error as { message?: unknown }).message ?? "");
      if (message.includes("already engaged"))
        throw new HttpError(
          409,
          "WORKER_ENGAGED",
          "Cette personne a accepté une autre mission sur ce créneau.",
        );
      throw new HttpError(
        409,
        "MISSION_FULL",
        headcount > 1
          ? `Les ${headcount} postes de cette mission sont déjà pourvus.`
          : "Le poste de cette mission est déjà pourvu.",
      );
    }
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
      /**
       * Seule une candidature en attente peut « devenir » incompatible : une
       * décision déjà prise ne se rediscute pas, et l'afficher comme en conflit
       * laisserait croire qu'elle est à reprendre.
       */
      conflict: row.status === "pending" && row.conflict === true,
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
