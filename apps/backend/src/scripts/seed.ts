import "dotenv/config";
import { createDatabase } from "../db.js";
import { readConfig } from "../config.js";
import { AccountService, passwordHash } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
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
  service = new AccountService(db),
  // Aucun géocodeur : le seed ne doit dépendre d'aucun service externe.
  workers = new WorkerService(db),
  missionService = new MissionService(db);
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
          status: "available" as const,
        };
      });
      await workers.replaceAll(p.id, {
        ...common,
        main_job: "serveur",
        secondary_jobs: ["chef_de_rang"],
        years_experience: 3,
        phone: "+33000000000",
        has_driving_licence: true,
        has_vehicle: false,
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
    if (role === "company") await seedMissions(p.id);
  }
} catch (e) {
  console.error("Seed failed:", e instanceof Error ? e.name : "unknown");
  process.exitCode = 1;
} finally {
  await db.close();
}

/**
 * Missions de démonstration du compte entreprise fictif. Elles portent `demo`
 * en base, ne sont créées que par ce script — lui-même interdit en production —
 * et sont remplacées à chaque exécution pour rester reproductibles.
 */
async function seedMissions(companyId: string) {
  await db.query("DELETE FROM missions WHERE company_id=$1 AND demo=true", [
    companyId,
  ]);
  const catalogue = (
    await db.query<{ id: string; name: string }>(
      "SELECT id,name FROM skills ORDER BY name",
    )
  ).rows;
  const skill = (name: string) =>
    catalogue.find((s) => s.name === name)?.id ?? catalogue[0].id;

  const day = (offset: number, startHour: number, hours: number) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + offset);
    start.setUTCHours(startHour, 0, 0, 0);
    return {
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + hours * 3600_000).toISOString(),
    };
  };

  const drafts = [
    {
      title: "Serveur en restauration",
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      address: "12 rue de la Démonstration",
      ...day(4, 16, 8),
      pay_amount: 13.5,
      pay_unit: "hour" as const,
      headcount: 2,
      min_years_experience: 1,
      required_skill_ids: [
        skill("Service en salle"),
        skill("Prise de commande"),
      ],
      desired_skill_ids: [skill("Relation client")],
      publish: true,
    },
    {
      title: "Hôte / Hôtesse d'accueil",
      job: "hote_accueil",
      city: "Lyon",
      postal_code: "69003",
      address: "5 place Fictive",
      ...day(9, 10, 8),
      pay_amount: 12.5,
      pay_unit: "hour" as const,
      headcount: 1,
      min_years_experience: null,
      required_skill_ids: [skill("Accueil")],
      desired_skill_ids: [],
      publish: true,
    },
    {
      title: "Chef de rang — service du soir",
      job: "chef_de_rang",
      city: "Villeurbanne",
      postal_code: "69100",
      address: "3 avenue de Démonstration",
      ...day(16, 18, 6),
      pay_amount: 15,
      pay_unit: "hour" as const,
      headcount: 1,
      min_years_experience: 3,
      required_skill_ids: [skill("Service en salle"), skill("Encaissement")],
      desired_skill_ids: [skill("Mise en place")],
      publish: true,
    },
    {
      title: "Commis de cuisine — brunch",
      job: "commis_cuisine",
      city: "Lyon",
      postal_code: "69007",
      address: "",
      ...day(23, 9, 6),
      pay_amount: null,
      pay_unit: null,
      headcount: 1,
      min_years_experience: null,
      required_skill_ids: [skill("Cuisine")],
      desired_skill_ids: [skill("Hygiène alimentaire")],
      publish: false,
    },
  ];

  for (const { publish, ...input } of drafts) {
    const id = await missionService.create(
      companyId,
      { ...input, description: "DEVELOPMENT / DEMO DATA — mission fictive." },
      { demo: true },
    );
    if (publish)
      await db.query(
        "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
        [id],
      );
  }
  console.info("Demo missions ready:", drafts.length);
}
