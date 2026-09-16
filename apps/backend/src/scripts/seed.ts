import "dotenv/config";
import { createDatabase } from "../db.js";
import { readConfig } from "../config.js";
import { AccountService, passwordHash } from "../auth/service.js";
import type { Profile } from "../auth/schemas.js";
const config = readConfig(process.env);
if (config.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true")
  throw new Error(
    "Seed réservé au développement : ALLOW_DEMO_SEED=true requis.",
  );
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error("DEMO_PASSWORD local requis (12 caractères minimum).");
const db = createDatabase(config),
  service = new AccountService(db);
try {
  for (const role of ["worker", "company"] as const) {
    const email = `jimmy.${role}@example.test`;
    const p = await db.transaction(async (tx) => {
      let profile = (
        await tx.query<Profile>(
          "SELECT * FROM profiles WHERE email=$1 FOR UPDATE",
          [email],
        )
      ).rows[0];
      if (profile && !profile.demo)
        throw new Error("Refus de modifier un compte non demo.");
      if (!profile)
        profile = (
          await tx.query<Profile>(
            "INSERT INTO profiles(email,role,demo) VALUES($1,$2,true) RETURNING *",
            [email, role],
          )
        ).rows[0];
      if (profile.role !== role) throw new Error("Rôle demo incohérent.");
      await tx.query(
        "INSERT INTO credentials(profile_id,password_hash) VALUES($1,$2) ON CONFLICT(profile_id) DO UPDATE SET password_hash=$2",
        [profile.id, await passwordHash(password)],
      );
      // Password reseeding revokes every old demo session.
      await tx.query("DELETE FROM sessions WHERE profile_id=$1", [profile.id]);
      return profile;
    });
    const common = {
      first_name: "Jimmy",
      last_name: role === "worker" ? "Martin Démo" : "Laurent Démo",
      city: "Lyon",
      postal_code: "69002",
      latitude: 45.75,
      longitude: 4.85,
    };
    if (role === "worker") {
      const skills = (
        await db.query<{ id: string }>(
          "SELECT id FROM skills WHERE name IN ('Service en salle','Prise de commande','Mise en place','Encaissement','Relation client','Hygiène alimentaire')",
        )
      ).rows;
      const slots = [1, 3, 5].map((days) => {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + days);
        start.setUTCHours(16, 0, 0, 0);
        return {
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 6 * 3600000).toISOString(),
        };
      });
      await service.onboardWorker(p.id, {
        ...common,
        main_job: "Serveur / Chef de rang",
        mobility_radius_km: 15,
        skill_ids: skills.map((s) => s.id),
        experiences: [
          {
            job_title: "Serveur",
            employer: "Restaurant Démonstration A — fictif",
            years: 2,
          },
          {
            job_title: "Chef de rang",
            employer: "Brasserie Démonstration B — fictive",
            years: 1,
          },
        ],
        availabilities: slots,
      });
    } else
      await service.onboardCompany(p.id, {
        ...common,
        legal_name: "InteriMatch Démonstration — société fictive",
        establishment_name: "La Table Démo — établissement fictif",
        sector: "brasserie",
        address: "Adresse fictive de démonstration",
        phone: "+33000000000",
        description:
          "DEVELOPMENT / DEMO DATA — établissement entièrement fictif pour tester le parcours entreprise.",
      });
    console.info("Demo account ready:", email);
  }
} catch (e) {
  console.error("Seed failed:", e instanceof Error ? e.name : "unknown");
  process.exitCode = 1;
} finally {
  await db.close();
}
