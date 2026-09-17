import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import type { Profile, Role } from "../auth/schemas.js";

export type AdminUser = Pick<
  Profile,
  "id" | "email" | "role" | "first_name" | "last_name"
>;

const USER_FIELDS = "id,email,role,first_name,last_name";

export class AdminService {
  constructor(public readonly db: Db) {}

  async listUsers() {
    return (
      await this.db.query<AdminUser>(
        `SELECT ${USER_FIELDS} FROM profiles ORDER BY lower(email),id`,
      )
    ).rows;
  }

  async updateRole(actorId: string, userId: string, role: Role) {
    return this.db.transaction(async (db) => {
      // Verrouillage dans un ordre stable : deux administrateurs peuvent agir en
      // parallèle sans introduire un ordre de verrous contradictoire.
      const ids = [...new Set([actorId, userId])].sort();
      const locked = await db.query<Pick<Profile, "id" | "role">>(
        "SELECT id,role FROM profiles WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [ids],
      );
      const actor = locked.rows.find((profile) => profile.id === actorId);
      if (actor?.role !== "admin")
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Cet espace est réservé aux administrateurs.",
        );
      const target = locked.rows.find((profile) => profile.id === userId);
      if (!target)
        throw new HttpError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
      if (actorId === userId && role !== "admin")
        throw new HttpError(
          409,
          "SELF_ROLE_CHANGE",
          "Vous ne pouvez pas retirer votre propre rôle administrateur.",
        );
      const updated = await db.query<AdminUser>(
        `UPDATE profiles SET role=$2,updated_at=now()
          WHERE id=$1 AND role IS DISTINCT FROM $2
          RETURNING ${USER_FIELDS}`,
        [userId, role],
      );
      if (updated.rows[0]) return updated.rows[0];
      return (
        await db.query<AdminUser>(
          `SELECT ${USER_FIELDS} FROM profiles WHERE id=$1`,
          [userId],
        )
      ).rows[0];
    });
  }
}
