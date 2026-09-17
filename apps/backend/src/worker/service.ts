import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { Geocoder } from "./geocode.js";
import { isProfileComplete } from "./completion.js";
import type { BusinessEventPublisher } from "../events/dispatcher.js";
import type {
  AvailabilityInput,
  AvailabilityPatch,
  CertificationInput,
  ExperienceInput,
  WorkerPatch,
} from "./schemas.js";

interface CompletionRow {
  first_name: string;
  last_name: string;
  city: string | null;
  postal_code: string | null;
  mobility_radius_km: number | null;
  main_job: string | null;
  skill_count: string;
  upcoming: string;
}

const COMPLETION_QUERY = `SELECT p.first_name, p.last_name, w.city, w.postal_code,
        w.mobility_radius_km, w.main_job,
        (SELECT count(*) FROM worker_skills ws WHERE ws.profile_id = p.id) AS skill_count,
        (SELECT count(*) FROM availabilities a
          WHERE a.profile_id = p.id AND a.status = 'available' AND a.ends_at > now()) AS upcoming
   FROM profiles p
   LEFT JOIN worker_profiles w ON w.profile_id = p.id
  WHERE p.id = $1`;

const PATCHABLE = [
  "phone",
  "main_job",
  "secondary_jobs",
  "years_experience",
  "city",
  "postal_code",
  "mobility_radius_km",
  "has_driving_licence",
  "has_vehicle",
  "open_to_missions",
] as const;

/**
 * Écritures du profil intérimaire.
 *
 * Deux invariants portés ici et nulle part ailleurs :
 *  - l'identité du profil modifié vient TOUJOURS du paramètre `id`, lui-même issu
 *    de la session authentifiée ; aucune méthode n'accepte d'identifiant venant
 *    du corps de la requête ;
 *  - `onboarding_completed` est recalculé après chaque écriture, dans la même
 *    transaction, à partir de l'état réellement enregistré.
 *
 * Les méthodes privées `write*` prennent la connexion en paramètre : les méthodes
 * publiques les enveloppent dans une transaction, et `replaceAll` les compose en
 * une seule, ce qui évite d'avoir deux implémentations de la même règle métier.
 */
export class WorkerService {
  constructor(
    public db: Db,
    private geocode?: Geocoder,
    private events?: BusinessEventPublisher,
  ) {}

  /** La ligne worker_profiles doit exister : les autres tables y font référence. */
  private async ensureProfile(db: Db, id: string) {
    await db.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [id]);
    const inserted = await db.query(
      "INSERT INTO worker_profiles(profile_id) VALUES($1) ON CONFLICT(profile_id) DO NOTHING RETURNING profile_id",
      [id],
    );
    return inserted.rows.length > 0;
  }

  private async recompute(db: Db, id: string) {
    const { rows } = await db.query<CompletionRow>(COMPLETION_QUERY, [id]);
    const row = rows[0];
    if (!row) throw new HttpError(404, "PROFILE_NOT_FOUND", "Profil absent.");
    const complete = isProfileComplete(toCompletionInput(row));
    await db.query(
      "UPDATE profiles SET onboarding_completed=$2, updated_at=now() WHERE id=$1 AND onboarding_completed IS DISTINCT FROM $2",
      [id, complete],
    );
    return complete;
  }

  private async mutateWithResult<T>(
    id: string,
    write: (db: Db) => Promise<{ changed: boolean; value: T }>,
  ) {
    const outcome = await this.db.transaction(async (db) => {
      const profile = await db.query<{ onboarding_completed: boolean }>(
        "SELECT onboarding_completed FROM profiles WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!profile.rows[0])
        throw new HttpError(404, "PROFILE_NOT_FOUND", "Profil absent.");
      const { changed, value } = await write(db);
      const completed = await this.recompute(db, id);
      return {
        changed,
        completedNow: !profile.rows[0].onboarding_completed && completed,
        value,
      };
    });
    // Publication après COMMIT. Le publisher asynchrone absorbe les pannes n8n.
    if (outcome.changed)
      this.events?.publish("worker.profile.updated", { worker_id: id });
    if (outcome.completedNow)
      this.events?.publish("worker.onboarding.completed", { worker_id: id });
    return outcome.value;
  }

  private async mutate(id: string, write: (db: Db) => Promise<boolean>) {
    await this.mutateWithResult(id, async (db) => ({
      changed: await write(db),
      value: undefined,
    }));
  }

  /**
   * Géocodage hors transaction : un appel réseau ne doit pas retenir une
   * connexion PostgreSQL, et son échec ne doit jamais empêcher l'enregistrement.
   */
  private async resolveCoordinates(id: string, patch: WorkerPatch) {
    const current = (
      await this.db.query<{
        city: string | null;
        postal_code: string | null;
        latitude: number | null;
      }>(
        "SELECT city, postal_code, latitude FROM worker_profiles WHERE profile_id=$1",
        [id],
      )
    ).rows[0];
    const city = patch.city ?? current?.city ?? null;
    const postalCode = patch.postal_code ?? current?.postal_code ?? null;
    const changed =
      (patch.city !== undefined && patch.city !== current?.city) ||
      (patch.postal_code !== undefined &&
        patch.postal_code !== current?.postal_code);
    const missingCoordinates = !current || current.latitude === null;
    if (!city || !postalCode || !(changed || missingCoordinates))
      return { changed, city, postalCode, coordinates: null };
    const coordinates = this.geocode
      ? await this.geocode(city, postalCode)
      : null;
    return { changed, city, postalCode, coordinates };
  }

  private async writePatch(
    db: Db,
    id: string,
    patch: WorkerPatch,
    located: {
      changed: boolean;
      city: string | null;
      postalCode: string | null;
      coordinates: { latitude: number; longitude: number } | null;
    },
  ) {
    const inserted = await this.ensureProfile(db, id);
    // La ligne du profil est verrouillée : valider l'état fusionné, pas seulement
    // les champs présents dans le PATCH (ni un état lu avant la transaction).
    const current = (
      await db.query<{
        city: string | null;
        postal_code: string | null;
        has_driving_licence: boolean;
        has_vehicle: boolean;
        main_job: string | null;
        secondary_jobs: string[];
      }>(
        "SELECT city,postal_code,has_driving_licence,has_vehicle,main_job,secondary_jobs FROM worker_profiles WHERE profile_id=$1",
        [id],
      )
    ).rows[0];
    if (
      ((located.changed || located.coordinates) &&
        ((patch.city ?? current.city) !== located.city ||
          (patch.postal_code ?? current.postal_code) !== located.postalCode)) ||
      (!located.changed &&
        !located.coordinates &&
        ((patch.city !== undefined && patch.city !== current.city) ||
          (patch.postal_code !== undefined &&
            patch.postal_code !== current.postal_code)))
    )
      throw new HttpError(
        409,
        "LOCATION_CHANGED",
        "La localisation a changé pendant l’enregistrement. Rechargez le profil puis réessayez.",
      );
    const licence = patch.has_driving_licence ?? current.has_driving_licence;
    const vehicle = patch.has_vehicle ?? current.has_vehicle;
    if (vehicle && !licence)
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "Un véhicule nécessite le permis.",
      );
    const mainJob = patch.main_job ?? current.main_job;
    const secondaryJobs = patch.secondary_jobs ?? current.secondary_jobs;
    if (mainJob && secondaryJobs.includes(mainJob))
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "Le métier principal ne peut pas être un métier secondaire.",
      );
    const columns: string[] = [];
    const differences: string[] = [];
    const values: unknown[] = [id];
    const set = (column: string, value: unknown) => {
      values.push(value);
      columns.push(`${column}=$${values.length}`);
      differences.push(`${column} IS DISTINCT FROM $${values.length}`);
    };
    for (const key of PATCHABLE)
      if (patch[key] !== undefined) set(key, patch[key]);

    if (located.coordinates) {
      set("latitude", located.coordinates.latitude);
      set("longitude", located.coordinates.longitude);
      set("geocoded_at", new Date().toISOString());
    } else if (located.changed) {
      // La localisation a changé sans géocodage réussi : d'anciennes coordonnées
      // désigneraient une autre commune. Mieux vaut aucune valeur qu'une fausse.
      set("latitude", null);
      set("longitude", null);
      set("geocoded_at", null);
    }
    let changed = inserted;
    if (columns.length) {
      const result = await db.query(
        `UPDATE worker_profiles SET ${columns.join(",")} WHERE profile_id=$1 AND (${differences.join(" OR ")}) RETURNING profile_id`,
        values,
      );
      changed ||= result.rows.length > 0;
    }

    const names: string[] = [];
    const nameValues: unknown[] = [id];
    for (const key of ["first_name", "last_name"] as const)
      if (patch[key] !== undefined) {
        nameValues.push(patch[key]);
        names.push(`${key}=$${nameValues.length}`);
      }
    if (names.length) {
      const nameDifferences = names.map((assignment) => {
        const [column, parameter] = assignment.split("=");
        return `${column} IS DISTINCT FROM ${parameter}`;
      });
      const result = await db.query(
        `UPDATE profiles SET ${names.join(",")}, updated_at=now() WHERE id=$1 AND (${nameDifferences.join(" OR ")}) RETURNING id`,
        nameValues,
      );
      changed ||= result.rows.length > 0;
    }
    return changed;
  }

  private async writeSkills(db: Db, id: string, skillIds: string[]) {
    const inserted = await this.ensureProfile(db, id);
    if (skillIds.length) {
      const known = await db.query(
        "SELECT id FROM skills WHERE id=ANY($1::uuid[])",
        [skillIds],
      );
      if (known.rows.length !== skillIds.length)
        throw new HttpError(400, "INVALID_SKILLS", "Compétence inconnue.");
    }
    const current = (
      await db.query<{ skill_id: string }>(
        "SELECT skill_id::text AS skill_id FROM worker_skills WHERE profile_id=$1 ORDER BY skill_id::text",
        [id],
      )
    ).rows.map((row) => row.skill_id);
    const wanted = [...skillIds].sort();
    if (
      !inserted &&
      current.length === wanted.length &&
      current.every((skillId, index) => skillId === wanted[index])
    )
      return false;
    await db.query("DELETE FROM worker_skills WHERE profile_id=$1", [id]);
    for (const skill of skillIds)
      await db.query(
        "INSERT INTO worker_skills(profile_id,skill_id) VALUES($1,$2)",
        [id, skill],
      );
    return true;
  }

  private async writeExperiences(
    db: Db,
    id: string,
    experiences: ExperienceInput,
  ) {
    await this.ensureProfile(db, id);
    await db.query("DELETE FROM experiences WHERE profile_id=$1", [id]);
    for (const e of experiences)
      await db.query(
        "INSERT INTO experiences(profile_id,job_title,employer,years) VALUES($1,$2,$3,$4)",
        [id, e.job_title, e.employer, e.years],
      );
    return true;
  }

  private async writeCertifications(
    db: Db,
    id: string,
    certifications: CertificationInput,
  ) {
    await this.ensureProfile(db, id);
    await db.query("DELETE FROM certifications WHERE profile_id=$1", [id]);
    for (const c of certifications)
      await db.query(
        "INSERT INTO certifications(profile_id,name,issuer,obtained_on) VALUES($1,$2,$3,$4)",
        [id, c.name, c.issuer ?? "", c.obtained_on ?? null],
      );
    return true;
  }

  private async writeAvailabilities(
    db: Db,
    id: string,
    slots: AvailabilityInput[],
  ) {
    await this.ensureProfile(db, id);
    await db.query("DELETE FROM availabilities WHERE profile_id=$1", [id]);
    for (const slot of slots)
      await db.query(
        "INSERT INTO availabilities(profile_id,starts_at,ends_at,status) VALUES($1,$2,$3,$4)",
        [id, slot.starts_at, slot.ends_at, slot.status],
      );
    return true;
  }

  async patch(id: string, patch: WorkerPatch) {
    const located = await this.resolveCoordinates(id, patch);
    await this.mutate(id, (db) => this.writePatch(db, id, patch, located));
  }

  async setSkills(id: string, skillIds: string[]) {
    await this.mutate(id, (db) => this.writeSkills(db, id, skillIds));
  }

  async setExperiences(id: string, experiences: ExperienceInput) {
    await this.mutate(id, (db) => this.writeExperiences(db, id, experiences));
  }

  async setCertifications(id: string, certifications: CertificationInput) {
    await this.mutate(id, (db) =>
      this.writeCertifications(db, id, certifications),
    );
  }

  /**
   * Remplacement complet du profil — chemin de compatibilité de l'ancienne route
   * `PUT /onboarding/worker`. Réutilise exactement les mêmes écritures que les
   * routes partielles, en une seule transaction.
   */
  async replaceAll(
    id: string,
    input: WorkerPatch & {
      skill_ids: string[];
      experiences: ExperienceInput;
      availabilities: AvailabilityInput[];
    },
  ) {
    const { skill_ids, experiences, availabilities, ...patch } = input;
    const located = await this.resolveCoordinates(id, patch);
    await this.mutate(id, async (db) => {
      const changed = [
        await this.writePatch(db, id, patch, located),
        await this.writeSkills(db, id, skill_ids),
        await this.writeExperiences(db, id, experiences),
        await this.writeAvailabilities(db, id, availabilities),
      ];
      return changed.some(Boolean);
    });
  }

  async listAvailabilities(id: string) {
    return (
      await this.db.query(
        "SELECT id,starts_at,ends_at,status FROM availabilities WHERE profile_id=$1 ORDER BY starts_at",
        [id],
      )
    ).rows;
  }

  async addAvailability(id: string, slot: AvailabilityInput) {
    return this.mutateWithResult(id, async (db) => {
      await this.ensureProfile(db, id);
      await this.assertNoOverlap(db, id, slot.starts_at, slot.ends_at, null);
      const { rows } = await db.query(
        "INSERT INTO availabilities(profile_id,starts_at,ends_at,status) VALUES($1,$2,$3,$4) RETURNING id,starts_at,ends_at,status",
        [id, slot.starts_at, slot.ends_at, slot.status],
      );
      return { changed: true, value: rows[0] };
    });
  }

  async updateAvailability(
    id: string,
    slotId: string,
    patch: AvailabilityPatch,
  ) {
    return this.mutateWithResult(id, async (db) => {
      // Le créneau doit appartenir au profil authentifié : un identifiant
      // appartenant à quelqu'un d'autre est introuvable, pas « interdit ».
      const existing = (
        await db.query<{
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
        }>(
          "SELECT id,starts_at,ends_at,status FROM availabilities WHERE id=$1 AND profile_id=$2 FOR UPDATE",
          [slotId, id],
        )
      ).rows[0];
      if (!existing)
        throw new HttpError(
          404,
          "AVAILABILITY_NOT_FOUND",
          "Disponibilité introuvable.",
        );
      const starts = new Date(
        patch.starts_at ?? existing.starts_at,
      ).toISOString();
      const ends = new Date(patch.ends_at ?? existing.ends_at).toISOString();
      if (Date.parse(ends) <= Date.parse(starts))
        throw new HttpError(
          400,
          "INVALID_REQUEST",
          "La fin doit suivre le début.",
        );
      await this.assertNoOverlap(db, id, starts, ends, slotId);
      const status = patch.status ?? existing.status;
      const changed =
        (patch.starts_at !== undefined &&
          Date.parse(patch.starts_at) !==
            new Date(existing.starts_at).getTime()) ||
        (patch.ends_at !== undefined &&
          Date.parse(patch.ends_at) !== new Date(existing.ends_at).getTime()) ||
        (patch.status !== undefined && patch.status !== existing.status);
      if (!changed) return { changed: false, value: existing };
      const { rows } = await db.query(
        "UPDATE availabilities SET starts_at=$3,ends_at=$4,status=$5 WHERE id=$1 AND profile_id=$2 RETURNING id,starts_at,ends_at,status",
        [slotId, id, starts, ends, status],
      );
      return { changed: true, value: rows[0] };
    });
  }

  async removeAvailability(id: string, slotId: string) {
    await this.mutate(id, async (db) => {
      const { rows } = await db.query(
        "DELETE FROM availabilities WHERE id=$1 AND profile_id=$2 RETURNING id",
        [slotId, id],
      );
      if (!rows[0])
        throw new HttpError(
          404,
          "AVAILABILITY_NOT_FOUND",
          "Disponibilité introuvable.",
        );
      return true;
    });
  }

  private async assertNoOverlap(
    db: Db,
    id: string,
    starts: string,
    ends: string,
    exclude: string | null,
  ) {
    const { rows } = await db.query(
      `SELECT 1 FROM availabilities
        WHERE profile_id=$1 AND starts_at < $3 AND ends_at > $2
          AND ($4::uuid IS NULL OR id <> $4)
        LIMIT 1`,
      [id, starts, ends, exclude],
    );
    if (rows.length)
      throw new HttpError(
        409,
        "AVAILABILITY_OVERLAP",
        "Ce créneau en chevauche un autre.",
      );
  }
}

const toCompletionInput = (row: CompletionRow) => ({
  first_name: row.first_name,
  last_name: row.last_name,
  city: row.city,
  postal_code: row.postal_code,
  mobility_radius_km: row.mobility_radius_km,
  main_job: row.main_job,
  skill_count: Number(row.skill_count),
  upcoming_availability_count: Number(row.upcoming),
});
