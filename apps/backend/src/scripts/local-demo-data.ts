import { readFile } from "node:fs/promises";
import type { Db } from "../db.js";
import type { AccountService } from "../auth/service.js";
import type { WorkerService } from "../worker/service.js";
import type { MissionService } from "../missions/service.js";
import type { PublicJobOfferService } from "../public-data/service.js";

export const LOCAL_DEMO_PASSWORD = "Browser-test-password-42!";

const demoAccounts = [
  {
    email: "demo.service@example.test",
    firstName: "Camille",
    lastName: "Service Démo",
    mainJob: "serveur",
    secondaryJobs: ["chef_de_rang", "maitre_hotel", "commis_salle", "barman"],
    years: 4,
  },
  {
    email: "demo.cuisine@example.test",
    firstName: "Samira",
    lastName: "Cuisine Démo",
    mainJob: "cuisinier",
    secondaryJobs: ["chef_de_partie", "commis_cuisine", "plongeur"],
    years: 5,
  },
  {
    email: "demo.hotel@example.test",
    firstName: "Alex",
    lastName: "Hôtel Démo",
    mainJob: "receptionniste",
    secondaryJobs: ["hote_accueil", "employe_etage"],
    years: 3,
  },
] as const;

export const LOCAL_DEMO_ACCOUNTS = Object.freeze([
  ...demoAccounts.map(({ email }) => email),
  "demo.company@example.test",
]);

const slot = (dayOffset: number, hour: number, hours: number) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
};

export async function seedLocalDemo(
  db: Db,
  accounts: AccountService,
  workers: WorkerService,
  missions: MissionService,
  publicOffers: PublicJobOfferService,
) {
  await db.query(
    "INSERT INTO company_accounts(email,label) VALUES($1,$2) ON CONFLICT DO NOTHING",
    ["demo.company@example.test", "Démonstration locale"],
  );

  const skills = (
    await db.query<{ id: string; name: string }>(
      "SELECT id,name FROM skills ORDER BY name",
    )
  ).rows;
  const skill = (name: string) => {
    const found = skills.find((entry) => entry.name === name);
    if (!found)
      throw new Error(`Compétence de démonstration absente : ${name}`);
    return found.id;
  };

  for (const worker of demoAccounts) {
    const session = await accounts.register(worker.email, LOCAL_DEMO_PASSWORD);
    const profile = await accounts.authenticate(session.access_token);
    await db.query(
      `UPDATE profiles
          SET first_name=$2,last_name=$3,tour_version=1,demo=true
        WHERE id=$1`,
      [profile.id, worker.firstName, worker.lastName],
    );
    await workers.replaceAll(profile.id, {
      city: "Lyon",
      postal_code: "69002",
      main_job: worker.mainJob,
      secondary_jobs: [...worker.secondaryJobs],
      years_experience: worker.years,
      phone: null,
      has_driving_licence: true,
      has_vehicle: false,
      mobility_radius_km: 35,
      open_to_missions: true,
      skill_ids: skills.map(({ id }) => id),
      experiences: [
        {
          job_title:
            worker.firstName === "Samira"
              ? "Cuisinière"
              : worker.firstName === "Alex"
                ? "Réceptionniste"
                : "Chef de rang",
          employer: "Établissement fictif de démonstration",
          years: worker.years,
        },
      ],
      availabilities: [
        {
          starts_at: slot(1, 0, 24 * 40).starts_at,
          ends_at: slot(1, 0, 24 * 40).ends_at,
          status: "available",
        },
      ],
    });
  }

  const companySession = await accounts.register(
    "demo.company@example.test",
    LOCAL_DEMO_PASSWORD,
  );
  const company = await accounts.authenticate(companySession.access_token);
  await db.query(
    "UPDATE profiles SET first_name='Louise',last_name='Démonstration',tour_version=1,demo=true WHERE id=$1",
    [company.id],
  );
  await accounts.onboardCompany(company.id, {
    first_name: "Louise",
    last_name: "Démonstration",
    legal_name: "InteriMatch Démonstration — société fictive",
    establishment_name: "Le Grand Hôtel des Canuts — démonstration",
    sector: "hotel",
    address: "12 rue de la Démonstration",
    city: "Lyon",
    postal_code: "69002",
    phone: "+33000000000",
    description:
      "Établissement entièrement fictif, réservé à la recette locale InteriMatch.",
  });

  const catalogue = [
    [
      "Serveur / Serveuse en restauration",
      "serveur",
      3,
      16,
      8,
      13.5,
      ["Service en salle", "Prise de commande"],
    ],
    [
      "Chef de rang — service du soir",
      "chef_de_rang",
      5,
      18,
      6,
      15,
      ["Service en salle", "Encaissement"],
    ],
    [
      "Commis de salle — banquet",
      "commis_salle",
      7,
      15,
      7,
      12.5,
      ["Mise en place"],
    ],
    [
      "Cuisinier / Cuisinière — déjeuner",
      "cuisinier",
      9,
      8,
      7,
      14.5,
      ["Cuisine", "Hygiène alimentaire"],
    ],
    [
      "Chef de partie — cuisine chaude",
      "chef_de_partie",
      12,
      14,
      8,
      16,
      ["Cuisine"],
    ],
    [
      "Commis de cuisine — brunch",
      "commis_cuisine",
      15,
      7,
      7,
      13,
      ["Cuisine", "Hygiène alimentaire"],
    ],
    [
      "Plongeur / Plongeuse — soirée",
      "plongeur",
      18,
      17,
      6,
      12.5,
      ["Hygiène alimentaire"],
    ],
    [
      "Barman / Barmaid — bar d’hôtel",
      "barman",
      21,
      18,
      7,
      15,
      ["Relation client", "Encaissement"],
    ],
    [
      "Réceptionniste — accueil week-end",
      "receptionniste",
      24,
      8,
      8,
      14,
      ["Accueil", "Relation client"],
    ],
    [
      "Employé / Employée d’étage",
      "employe_etage",
      27,
      9,
      7,
      13,
      ["Hygiène alimentaire"],
    ],
  ] as const;

  const missionIds: string[] = [];
  for (const [title, job, day, hour, hours, pay, required] of catalogue) {
    const id = await missions.create(
      company.id,
      {
        title,
        job,
        city: day % 2 === 0 ? "Villeurbanne" : "Lyon",
        postal_code: day % 2 === 0 ? "69100" : "69002",
        address: "Adresse fictive de démonstration",
        description:
          "Mission fictive destinée exclusivement à la recette locale InteriMatch.",
        headcount: day % 3 === 0 ? 2 : 1,
        pay_amount: pay,
        pay_unit: "hour",
        min_years_experience: job.startsWith("chef") ? 3 : null,
        required_skill_ids: required.map(skill),
        desired_skill_ids: [],
        // Recette locale : la photo est exigée à la publication depuis la
        // migration 010. Ce chemin est servi par le frontend de démonstration.
        media: {
          provider: "upload",
          storage_path: `missions/${company.id}/demo.jpg`,
        },
        ...slot(day, hour, hours),
      },
      { demo: true },
    );
    await missions.publish(company.id, id);
    missionIds.push(id);
  }

  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../public-data/fixtures/offres_france_travail_10.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as unknown;
  const franceTravail = await publicOffers.importFromPayload(fixture);

  return {
    accounts: LOCAL_DEMO_ACCOUNTS,
    missionIds,
    franceTravail,
  };
}
