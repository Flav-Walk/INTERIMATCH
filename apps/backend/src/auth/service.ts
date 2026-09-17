import { hash, verify, argon2id } from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { Profile, CompanyInput } from "./schemas.js";
import { missingRules } from "../worker/completion.js";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const passwordHash = (password: string) =>
  hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
const dummyHash = passwordHash("invalid-account-password");
const token = () => randomBytes(32).toString("base64url");
export class AccountService {
  constructor(
    public db: Db,
    private googleIdentity?: (
      jwt: string,
    ) => Promise<{ id: string; email: string }>,
  ) {}
  async issue(db: Db, profileId: string) {
    const access = token(),
      refresh = token();
    await db.query(
      "INSERT INTO sessions(profile_id,access_hash,refresh_hash,access_expires_at,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes',now()+interval '7 days')",
      [profileId, digest(access), digest(refresh)],
    );
    return { access_token: access, refresh_token: refresh, expires_in: 900 };
  }
  // The role is decided by the server: worker by default, company when the address is
  // listed in company_accounts. Adding a company is a row, never a code change.
  private async applyCompanyAllowlist(db: Db, profileId: string) {
    await db.query(
      "UPDATE profiles p SET role='company',updated_at=now() WHERE p.id=$1 AND p.role<>'company' AND p.role<>'admin' AND EXISTS(SELECT 1 FROM company_accounts c WHERE c.email=p.email)",
      [profileId],
    );
  }
  async register(email: string, password: string) {
    const encoded = await passwordHash(password);
    return this.db.transaction(async (db) => {
      try {
        const { rows } = await db.query<Profile>(
          "INSERT INTO profiles(email) VALUES($1) RETURNING *",
          [email],
        );
        await db.query(
          "INSERT INTO credentials(profile_id,password_hash) VALUES($1,$2)",
          [rows[0].id, encoded],
        );
        return this.issue(db, rows[0].id);
      } catch (e) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          e.code === "23505"
        )
          throw new HttpError(
            409,
            "ACCOUNT_UNAVAILABLE",
            "Inscription indisponible pour cette adresse. Essayez de vous connecter.",
          );
        throw e;
      }
    });
  }
  async login(email: string, password: string) {
    const { rows } = await this.db.query<Profile & { password_hash: string }>(
      "SELECT p.*,c.password_hash FROM profiles p JOIN credentials c ON c.profile_id=p.id WHERE p.email=$1",
      [email],
    );
    const p = rows[0];
    // Perform equivalent expensive work for unknown accounts.
    const valid = p
      ? await verify(p.password_hash, password)
      : await verify(await dummyHash, password);
    if (!p || !valid || !p.active)
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Email ou mot de passe incorrect.",
      );
    // An address added to company_accounts after signup takes effect at the next login.
    await this.applyCompanyAllowlist(this.db, p.id);
    return this.issue(this.db, p.id);
  }
  async google(jwt: string) {
    if (!this.googleIdentity)
      throw new HttpError(
        503,
        "GOOGLE_UNAVAILABLE",
        "Connexion Google indisponible.",
      );
    const identity = await this.googleIdentity(jwt);
    return this.db.transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        identity.id,
      ]);
      let p = (
        await db.query<Profile>(
          "SELECT * FROM profiles WHERE auth_user_id=$1",
          [identity.id],
        )
      ).rows[0];
      if (!p) {
        if (
          (
            await db.query("SELECT id FROM profiles WHERE email=$1", [
              identity.email.toLowerCase(),
            ])
          ).rows.length
        )
          throw new HttpError(
            409,
            "IDENTITY_CONFLICT",
            "Cette adresse utilise déjà une autre connexion. Utilisez votre méthode initiale.",
          );
        p = (
          await db.query<Profile>(
            "INSERT INTO profiles(email,auth_user_id) VALUES($1,$2) RETURNING *",
            [identity.email.toLowerCase(), identity.id],
          )
        ).rows[0];
      }
      if (!p.active)
        throw new HttpError(403, "ACCOUNT_INACTIVE", "Compte inactif.");
      await this.applyCompanyAllowlist(db, p.id);
      return this.issue(db, p.id);
    });
  }
  async authenticate(access: string) {
    const { rows } = await this.db.query<Profile>(
      "SELECT p.* FROM profiles p JOIN sessions s ON p.id=s.profile_id WHERE s.access_hash=$1 AND s.access_expires_at>now() AND s.expires_at>now() AND p.active=true",
      [digest(access)],
    );
    if (!rows[0])
      throw new HttpError(401, "UNAUTHORIZED", "Session invalide ou expirée.");
    return rows[0];
  }
  async refresh(refresh: string) {
    return this.db.transaction(async (db) => {
      const { rows } = await db.query<{ id: string; profile_id: string }>(
        "SELECT s.id,s.profile_id FROM sessions s JOIN profiles p ON p.id=s.profile_id WHERE s.refresh_hash=$1 AND s.expires_at>now() AND p.active=true FOR UPDATE OF s",
        [digest(refresh)],
      );
      if (!rows[0])
        throw new HttpError(401, "UNAUTHORIZED", "Session expirée.");
      const access = token();
      await db.query(
        "UPDATE sessions SET access_hash=$1,access_expires_at=now()+interval '15 minutes' WHERE id=$2",
        [digest(access), rows[0].id],
      );
      return { access_token: access, expires_in: 900 };
    });
  }
  async logout(refresh: string | undefined, access: string | undefined) {
    if (refresh)
      await this.db.query("DELETE FROM sessions WHERE refresh_hash=$1", [
        digest(refresh),
      ]);
    if (access)
      await this.db.query("DELETE FROM sessions WHERE access_hash=$1", [
        digest(access),
      ]);
  }
  /** Relit un profil par son identifiant, après une écriture par exemple. */
  async reload(id: string) {
    const { rows } = await this.db.query<Profile>(
      "SELECT * FROM profiles WHERE id=$1",
      [id],
    );
    if (!rows[0])
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Compte introuvable.");
    return rows[0];
  }
  async me(p: Profile) {
    let detail: Record<string, unknown> = {};
    if (p.role === "worker") {
      detail =
        (
          await this.db.query(
            "SELECT * FROM worker_profiles WHERE profile_id=$1",
            [p.id],
          )
        ).rows[0] ?? {};
      detail.skills = (
        await this.db.query(
          "SELECT s.id,s.name FROM skills s JOIN worker_skills ws ON ws.skill_id=s.id WHERE ws.profile_id=$1 ORDER BY s.name",
          [p.id],
        )
      ).rows;
      detail.experiences = (
        await this.db.query(
          "SELECT id,job_title,employer,years FROM experiences WHERE profile_id=$1",
          [p.id],
        )
      ).rows;
      detail.availabilities = (
        await this.db.query(
          "SELECT id,starts_at,ends_at,status FROM availabilities WHERE profile_id=$1 ORDER BY starts_at",
          [p.id],
        )
      ).rows;
      detail.certifications = (
        await this.db.query(
          "SELECT id,name,issuer,obtained_on FROM certifications WHERE profile_id=$1 ORDER BY name",
          [p.id],
        )
      ).rows;
    }
    if (p.role === "company")
      detail =
        (
          await this.db.query(
            "SELECT * FROM company_profiles WHERE profile_id=$1",
            [p.id],
          )
        ).rows[0] ?? {};
    if (p.role !== "worker") return { ...p, profile: detail };
    // Les règles de complétion sont évaluées ici à partir des données déjà lues,
    // pour que /me et les routes intérimaire disent exactement la même chose.
    const now = Date.now();
    const slots = detail.availabilities as
      { ends_at: string; status: string }[] | undefined;
    return {
      ...p,
      profile: detail,
      missing_requirements: missingRules({
        first_name: p.first_name,
        last_name: p.last_name,
        city: (detail.city as string | null) ?? null,
        postal_code: (detail.postal_code as string | null) ?? null,
        mobility_radius_km:
          (detail.mobility_radius_km as number | null) ?? null,
        main_job: (detail.main_job as string | null) ?? null,
        skill_count: ((detail.skills as unknown[]) ?? []).length,
        upcoming_availability_count: (slots ?? []).filter(
          (s) => s.status === "available" && Date.parse(s.ends_at) > now,
        ).length,
      }),
    };
  }
  // Guided tour progress. Storing the highest completed version lets a later tour be
  // shown again to existing accounts by raising CURRENT_TOUR_VERSION; 0 replays it.
  async setTourVersion(id: string, version: number) {
    const { rows } = await this.db.query<Profile>(
      "UPDATE profiles SET tour_version=$2,updated_at=now() WHERE id=$1 RETURNING *",
      [id, version],
    );
    if (!rows[0])
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Compte introuvable.");
    return this.me(rows[0]);
  }
  async onboardCompany(id: string, input: CompanyInput) {
    return this.db.transaction(async (db) => {
      await db.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [id]);
      await db.query(
        "INSERT INTO company_profiles(profile_id,legal_name,establishment_name,sector,address,city,postal_code,latitude,longitude,phone,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(profile_id) DO UPDATE SET legal_name=$2,establishment_name=$3,sector=$4,address=$5,city=$6,postal_code=$7,latitude=$8,longitude=$9,phone=$10,description=$11",
        [
          id,
          input.legal_name,
          input.establishment_name,
          input.sector,
          input.address,
          input.city,
          input.postal_code,
          input.latitude,
          input.longitude,
          input.phone,
          input.description,
        ],
      );
      await db.query(
        "UPDATE profiles SET first_name=$2,last_name=$3,onboarding_completed=true,updated_at=now() WHERE id=$1",
        [id, input.first_name, input.last_name],
      );
    });
  }
}
