// Ephemeral PostgreSQL engine for browser tests; never connects to remote services.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import { AccountService } from "../auth/service.js";
import { WorkerService } from "../worker/service.js";
import { MissionService } from "../missions/service.js";
import { MissionMediaService } from "../media/service.js";
import {
  fakeUnsplash,
  localFixtureMediaStore,
  unsplashPhoto,
} from "../media/testing.js";
import { ApplicationService } from "../applications/service.js";
import { PublicJobOfferService } from "../public-data/service.js";
import type { Db } from "../db.js";
import { ContractService } from "../contracts/service.js";
import { memoryContractStore } from "../contracts/testing.js";

/**
 * Photo déterministe des missions de recette.
 *
 * Les jeux de données écrivent `status='open'` en SQL direct : ils franchissent
 * donc le déclencheur de la migration 010, qui exige une photo à la publication.
 * Ce chemin est servi par le frontend local ; il n'atteint jamais la production,
 * qui ne charge aucun de ces scripts.
 */
const RECETTE_MEDIA = JSON.stringify({
  provider: "upload",
  url: "/images/fixtures/mission.jpg",
  storage_path: "fixtures/mission.jpg",
});

if (process.env.NODE_ENV !== "test")
  throw new Error("Test server requires NODE_ENV=test");
const pg = new PGlite();
for (const name of (await readdir("migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort())
  await pg.exec(await readFile("migrations/" + name, "utf8"));
const db: Db = {
  query: (sql, values) => pg.query(sql, values),
  transaction: (work) =>
    pg.transaction((tx) =>
      work({
        query: (sql, values) => tx.query(sql, values),
        transaction: () => {
          throw new Error("nested");
        },
      }),
    ),
};
// Fixture navigateur : une adresse entreprise par projet Playwright, pour que les
// projets desktop et mobile ne se disputent pas le même compte.
const projects = ["desktop", "mobile"] as const;
await pg.exec(
  `INSERT INTO company_accounts(email,label) VALUES
     ('company.desktop@example.test','E2E'),('company.mobile@example.test','E2E'),
     ('missions.desktop@example.test','E2E'),('missions.mobile@example.test','E2E'),
     ('application.company.desktop@example.test','E2E'),
     ('application.company.mobile@example.test','E2E'),
     -- Compte laissé vide : le parcours de création part d'une liste sans
     -- mission, donc ses décomptes ne dépendent d'aucune autre fixture.
     ('crud.desktop@example.test','E2E'),('crud.mobile@example.test','E2E'),
     ('place.desktop@example.test','E2E'),('place.mobile@example.test','E2E'),
     ('fresh.desktop@example.test','E2E'),('fresh.mobile@example.test','E2E'),
     ('open.desktop@example.test','E2E'),('open.mobile@example.test','E2E'),
     -- Photo d'une mission : un compte par scénario, pour que les quatre
     -- parcours restent indépendants de leur ordre d'exécution.
     ('photo.form.desktop@example.test','E2E'),('photo.form.mobile@example.test','E2E'),
     ('photo.panne.desktop@example.test','E2E'),('photo.panne.mobile@example.test','E2E'),
     ('photo.vide.desktop@example.test','E2E'),('photo.vide.mobile@example.test','E2E'),
     ('photo.format.desktop@example.test','E2E'),('photo.format.mobile@example.test','E2E'),
     ('match.desktop@example.test','E2E'),('match.mobile@example.test','E2E'),
     -- Recette des conflits d'engagement : deux entreprises distinctes, pour
     -- que la seconde acceptation vienne réellement d'ailleurs.
     ('engage.a.desktop@example.test','E2E'),('engage.a.mobile@example.test','E2E'),
     ('engage.b.desktop@example.test','E2E'),('engage.b.mobile@example.test','E2E'),
     -- Rapprochement et score : entreprise dédiée, pour que la liste des
     -- profils correspondants ne dépende d'aucune candidature déposée ailleurs.
     ('scoring.desktop@example.test','E2E'),('scoring.mobile@example.test','E2E'),
     -- Attribution : une mission à un poste et deux candidats, pour observer ce
     -- que devient celui qui n'a pas été retenu faute de place.
     ('attribution.desktop@example.test','E2E'),
     ('attribution.mobile@example.test','E2E')
   ON CONFLICT DO NOTHING`,
);

// Géocodeur déterministe : la suite navigateur n'appelle aucun service distant.
const geocode = async () => ({ latitude: 45.75, longitude: 4.85 });
const accounts = new AccountService(db, undefined, geocode);
const workers = new WorkerService(db, geocode);
// Doublure locale complète : la sélection, la résolution et le point de
// comptage sont testables sans clé, quota ou appel réseau vers Unsplash.
const fakeUnsplashApi = fakeUnsplash((url) => ({
  body: url.includes("/photos/salle-1") ? unsplashPhoto("salle-1") : {},
}));
const missionMedia = new MissionMediaService(
  localFixtureMediaStore(),
  fakeUnsplashApi.service,
);
const missions = new MissionService(db, geocode, undefined, missionMedia);
const contractEmail = { send: async () => undefined };
const contractLogger = { info: () => undefined, error: () => undefined };
const contractStorage = memoryContractStore();
const contracts = new ContractService(
  db,
  contractStorage.store,
  contractEmail,
  "http://127.0.0.1:5174",
  contractLogger,
);
const applications = new ApplicationService(db, undefined, contracts);
const publicOffers = new PublicJobOfferService(db);

/**
 * Compte entreprise pré-rempli avec des missions, pour que la suite navigateur
 * puisse vérifier la liste et les filtres sur des données réelles plutôt que sur
 * un écran vide. Ce compte n'existe que dans ce serveur éphémère.
 */
const slot = (dayOffset: number, hour: number, hours: number) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset);
  start.setUTCHours(hour, 0, 0, 0);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + hours * 3600_000).toISOString(),
  };
};

for (const project of projects) {
  const email = `missions.${project}@example.test`;
  const { access_token } = await accounts.register(
    email,
    "Browser-test-password-42!",
  );
  const profile = await accounts.authenticate(access_token);
  const drafts = [
    {
      title: "Serveur en restauration",
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      headcount: 2,
      publish: true,
      ...slot(4, 16, 8),
    },
    {
      title: "Hôte d'accueil salon",
      job: "hote_accueil",
      city: "Lyon",
      postal_code: "69003",
      headcount: 1,
      publish: true,
      ...slot(9, 10, 8),
    },
    {
      title: "Commis de cuisine brunch",
      job: "commis_cuisine",
      city: "Villeurbanne",
      postal_code: "69100",
      headcount: 1,
      publish: false,
      ...slot(16, 9, 6),
    },
  ];
  for (const { publish, ...input } of drafts) {
    const id = await missions.create(profile.id, {
      description: "Mission de test navigateur.",
      address: "",
      pay_amount: null,
      pay_unit: null,
      min_years_experience: null,
      required_skill_ids: [],
      desired_skill_ids: [],
      ...input,
    });
    if (publish)
      await db.query(
        "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
        [id, RECETTE_MEDIA],
      );
  }

  // Entreprise et mission réservées au parcours E2E candidature. Cette fixture
  // ne partage ainsi ni visite guidée ni état métier avec les scénarios SL1.
  const applicationCompanySession = await accounts.register(
    `application.company.${project}@example.test`,
    "Browser-test-password-42!",
  );
  const applicationCompany = await accounts.authenticate(
    applicationCompanySession.access_token,
  );
  const applicationMissionId = await missions.create(applicationCompany.id, {
    title: "Serveur candidature",
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    headcount: 1,
    description: "Mission de test du parcours candidature.",
    address: "",
    pay_amount: null,
    pay_unit: null,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    ...slot(4, 16, 8),
  });
  await db.query(
    "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
    [applicationMissionId, RECETTE_MEDIA],
  );
  const rejectedMissionId = await missions.create(applicationCompany.id, {
    title: "Serveur candidature non retenue",
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    headcount: 1,
    description: "Mission de test du refus de candidature.",
    address: "",
    pay_amount: null,
    pay_unit: null,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    ...slot(9, 16, 8),
  });
  await db.query(
    "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
    [rejectedMissionId, RECETTE_MEDIA],
  );

  // Intérimaire complet réservé au parcours E2E candidature. Les deux projets
  // ont chacun le leur : aucune session ni candidature n'est partagée.
  const workerSession = await accounts.register(
    `application.worker.${project}@example.test`,
    "Browser-test-password-42!",
  );
  const worker = await accounts.authenticate(workerSession.access_token);
  await db.query(
    `UPDATE profiles
        SET first_name='Camille',last_name='Recette',
            onboarding_completed=true,tour_version=1
      WHERE id=$1`,
    [worker.id],
  );
  await db.query(
    `INSERT INTO worker_profiles(
       profile_id,city,postal_code,latitude,longitude,mobility_radius_km,
       main_job,open_to_missions)
     VALUES($1,'Lyon','69002',45.75,4.85,50,'serveur',true)`,
    [worker.id],
  );
  await db.query(
    `INSERT INTO worker_skills(profile_id,skill_id)
     SELECT $1,id FROM skills`,
    [worker.id],
  );
  await db.query(
    `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
     VALUES($1,now(),now()+interval '30 days','available')`,
    [worker.id],
  );
}

/**
 * Recette des conflits d'engagement.
 *
 * Deux entreprises **différentes** publient deux missions qui se chevauchent le
 * même jour — 10 h → 22 h et 18 h → 23 h, la forme exacte du scénario de
 * recette. Un intérimaire complet peut postuler aux deux ; il ne pourra être
 * accepté que sur l'une.
 *
 * Les deux entreprises sont distinctes à dessein : c'est ce qui rend le conflit
 * réel. Une même entreprise verrait ses deux missions, alors que le cas à
 * couvrir est celui de deux recruteurs qui s'ignorent.
 */
for (const project of projects) {
  // Les titres portent le projet : les deux suites Playwright partagent ce
  // serveur, et un intérimaire verrait sinon deux missions homonymes.
  const windows = [
    { title: `Engagement A ${project}`, ...slot(7, 10, 12) },
    { title: `Engagement B ${project}`, ...slot(7, 18, 5) },
  ];
  for (const [index, letter] of ["a", "b"].entries()) {
    const session = await accounts.register(
      `engage.${letter}.${project}@example.test`,
      "Browser-test-password-42!",
    );
    const company = await accounts.authenticate(session.access_token);
    // Visite guidée déjà vue : la recette porte sur les conflits d'engagement,
    // pas sur l'accueil, et un dialogue de bienvenue n'a rien à y arbitrer.
    await db.query("UPDATE profiles SET tour_version=1 WHERE id=$1", [
      company.id,
    ]);
    const { title, ...window } = windows[index];
    const id = await missions.create(company.id, {
      title,
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      headcount: 1,
      description: "Mission de recette des conflits d'engagement.",
      address: "",
      pay_amount: null,
      pay_unit: null,
      min_years_experience: null,
      required_skill_ids: [],
      desired_skill_ids: [],
      ...window,
    });
    await db.query(
      "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
      [id, RECETTE_MEDIA],
    );
  }

  const engageWorker = await accounts.register(
    `engage.worker.${project}@example.test`,
    "Browser-test-password-42!",
  );
  const engaged = await accounts.authenticate(engageWorker.access_token);
  await db.query(
    `UPDATE profiles
        SET first_name='Nadia',last_name='Berger',
            onboarding_completed=true,tour_version=1
      WHERE id=$1`,
    [engaged.id],
  );
  await db.query(
    `INSERT INTO worker_profiles(
       profile_id,city,postal_code,latitude,longitude,mobility_radius_km,
       main_job,open_to_missions)
     VALUES($1,'Lyon','69002',45.75,4.85,50,'serveur',true)`,
    [engaged.id],
  );
  await db.query(
    `INSERT INTO worker_skills(profile_id,skill_id) SELECT $1,id FROM skills`,
    [engaged.id],
  );
  await db.query(
    `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
     VALUES($1,now(),now()+interval '30 days','available')`,
    [engaged.id],
  );
}

/**
 * Rapprochement et score — fixture dédiée.
 *
 * Trois profils choisis pour que le moteur ait réellement quelque chose à dire,
 * et pour que chacun illustre un cas distinct du classement :
 *
 *  - Adèle, métier principal, toutes les compétences, sur place, expérimentée :
 *    le haut du palier, et une explication faite de points forts ;
 *  - Basile, mêmes compétences qu'Adèle mais chef de rang seulement en métier
 *    secondaire, et un an d'expérience face aux trois demandés : le même écran
 *    doit savoir nommer ce qui le limite, pas seulement le classer plus bas.
 *    Ses compétences le maintiennent dans le palier des 70 ; c'est ce qui rend
 *    l'explication nécessaire, puisque le score seul ne dirait pas où est
 *    l'écart avec Adèle ;
 *  - Céleste, parfaitement qualifiée mais à Marseille avec un rayon de 30 km :
 *    seule la distance l'écarte, donc elle doit rester consultable hors zone.
 *
 * L'entreprise est propre à ce scénario. Les fixtures partagées reçoivent des
 * candidatures déposées par d'autres parcours, et une personne qui a postulé
 * quitte la liste des profils correspondants : le classement observé ici
 * dépendrait alors de l'ordre d'exécution des suites.
 */
for (const project of projects) {
  const companySession = await accounts.register(
    `scoring.${project}@example.test`,
    "Browser-test-password-42!",
  );
  const company = await accounts.authenticate(companySession.access_token);
  await db.query("UPDATE profiles SET tour_version=1 WHERE id=$1", [
    company.id,
  ]);

  const skillId = async (name: string) =>
    (
      await db.query<{ id: string }>("SELECT id FROM skills WHERE name=$1", [
        name,
      ])
    ).rows[0].id;
  const salle = await skillId("Service en salle");
  const commande = await skillId("Prise de commande");
  const encaissement = await skillId("Encaissement");

  const missionId = await missions.create(company.id, {
    title: `Chef de rang événement ${project}`,
    job: "chef_de_rang",
    city: "Lyon",
    postal_code: "69002",
    headcount: 2,
    description: "Rapprochement et score : mission de référence.",
    address: "",
    pay_amount: null,
    pay_unit: null,
    min_years_experience: 3,
    required_skill_ids: [salle],
    desired_skill_ids: [commande, encaissement],
    ...slot(12, 18, 5),
  });
  await db.query(
    "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
    [missionId, RECETTE_MEDIA],
  );

  // Les deux projets Playwright partagent ce serveur, et une entreprise voit
  // TOUS les intérimaires, pas seulement les siens. Deux fixtures homonymes
  // deviendraient donc indistinguables à l'écran, où seuls le prénom et
  // l'initiale s'affichent. Chaque projet a donc ses propres prénoms.
  const named = (desktop: string, mobile: string) =>
    project === "desktop" ? desktop : mobile;

  const profiles = [
    {
      email: `scoring.fort.${project}@example.test`,
      first_name: named("Adèle", "Alizée"),
      last_name: "Fontaine",
      main_job: "chef_de_rang",
      secondary_jobs: "{}",
      latitude: 45.75,
      longitude: 4.85,
      radius: 40,
      years: 8,
      skills: [salle, commande, encaissement],
    },
    {
      email: `scoring.limite.${project}@example.test`,
      first_name: named("Basile", "Bastien"),
      last_name: "Marchand",
      main_job: "serveur",
      secondary_jobs: "{chef_de_rang}",
      latitude: 45.75,
      longitude: 4.85,
      radius: 40,
      years: 1,
      skills: [salle, commande, encaissement],
    },
    {
      // Marseille : environ 275 km de Lyon, hors d'un rayon de 30 km.
      email: `scoring.loin.${project}@example.test`,
      first_name: named("Céleste", "Clémence"),
      last_name: "Arnaud",
      main_job: "chef_de_rang",
      secondary_jobs: "{}",
      latitude: 43.3,
      longitude: 5.37,
      radius: 30,
      years: 9,
      skills: [salle, commande, encaissement],
    },
  ];

  for (const profile of profiles) {
    const session = await accounts.register(
      profile.email,
      "Browser-test-password-42!",
    );
    const account = await accounts.authenticate(session.access_token);
    await db.query(
      `UPDATE profiles
          SET first_name=$2,last_name=$3,onboarding_completed=true,tour_version=1
        WHERE id=$1`,
      [account.id, profile.first_name, profile.last_name],
    );
    await db.query(
      `INSERT INTO worker_profiles(
         profile_id,city,postal_code,latitude,longitude,mobility_radius_km,
         main_job,secondary_jobs,years_experience,open_to_missions)
       VALUES($1,'Lyon','69002',$2,$3,$4,$5,$6::text[],$7,true)`,
      [
        account.id,
        profile.latitude,
        profile.longitude,
        profile.radius,
        profile.main_job,
        profile.secondary_jobs,
        profile.years,
      ],
    );
    for (const skill of profile.skills)
      await db.query(
        "INSERT INTO worker_skills(profile_id,skill_id) VALUES($1,$2)",
        [account.id, skill],
      );
    await db.query(
      `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
       VALUES($1,now(),now()+interval '60 days','available')`,
      [account.id],
    );
  }
}

/**
 * Attribution — la dernière place, et celui qui l'a manquée.
 *
 * Une mission à UN poste, deux candidats complets. C'est le plus petit montage
 * qui fasse apparaître la situation que SL2d devait rendre lisible : lorsque la
 * place part, la seconde candidature reste « en attente » — le serveur ne la
 * refuse pas d'office, l'entreprise n'ayant rien décidé à son sujet — mais elle
 * n'a plus d'issue, et les deux espaces doivent le dire.
 *
 * Fixture dédiée : les comptes partagés reçoivent des candidatures déposées par
 * d'autres parcours, et la capacité observée ici dépendrait alors de l'ordre
 * d'exécution des suites.
 */
for (const project of projects) {
  const session = await accounts.register(
    `attribution.${project}@example.test`,
    "Browser-test-password-42!",
  );
  const company = await accounts.authenticate(session.access_token);
  await db.query("UPDATE profiles SET tour_version=1 WHERE id=$1", [
    company.id,
  ]);

  const missionId = await missions.create(company.id, {
    title: `Attribution ${project}`,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    headcount: 1,
    description: "Un seul poste : la place part au premier retenu.",
    address: "",
    pay_amount: null,
    pay_unit: null,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    ...slot(15, 9, 6),
  });
  await db.query(
    "UPDATE missions SET status='open', published_at=now(), media=$2::jsonb WHERE id=$1",
    [missionId, RECETTE_MEDIA],
  );

  // Une mission déjà passée, pour que l'onglet « Terminées » ait de quoi se
  // remplir. Aucune route ne sait la créer — `publish` refuse une mission déjà
  // commencée — donc les bornes sont reculées après coup, relativement à
  // `now()` : une date écrite en dur finirait par ne plus être passée.
  const passeeId = await missions.create(company.id, {
    title: `Attribution passée ${project}`,
    job: "serveur",
    city: "Lyon",
    postal_code: "69002",
    headcount: 1,
    description: "Mission dont le créneau est derrière nous.",
    address: "",
    pay_amount: null,
    pay_unit: null,
    min_years_experience: null,
    required_skill_ids: [],
    desired_skill_ids: [],
    ...slot(16, 9, 6),
  });
  await db.query(
    `UPDATE missions
        SET status='open', published_at=now(), media=$2::jsonb,
            starts_at=now()-interval '10 hours',
            ends_at=now()-interval '4 hours'
      WHERE id=$1`,
    [passeeId, RECETTE_MEDIA],
  );

  // Prénoms propres au projet : les deux suites partagent ce serveur.
  const noms =
    project === "desktop"
      ? [
          { first: "Irène", last: "Dumas" },
          { first: "Jonas", last: "Leclerc" },
        ]
      : [
          { first: "Ilona", last: "Dumas" },
          { first: "Jules", last: "Leclerc" },
        ];

  for (const [index, role] of ["retenu", "attente"].entries()) {
    const compte = await accounts.register(
      `attribution.${role}.${project}@example.test`,
      "Browser-test-password-42!",
    );
    const worker = await accounts.authenticate(compte.access_token);
    await db.query(
      `UPDATE profiles
          SET first_name=$2,last_name=$3,onboarding_completed=true,tour_version=1
        WHERE id=$1`,
      [worker.id, noms[index].first, noms[index].last],
    );
    await db.query(
      `INSERT INTO worker_profiles(
         profile_id,city,postal_code,latitude,longitude,mobility_radius_km,
         main_job,open_to_missions)
       VALUES($1,'Lyon','69002',45.75,4.85,50,'serveur',true)`,
      [worker.id],
    );
    await db.query(
      `INSERT INTO worker_skills(profile_id,skill_id) SELECT $1,id FROM skills`,
      [worker.id],
    );
    await db.query(
      `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
       VALUES($1,now(),now()+interval '60 days','available')`,
      [worker.id],
    );
  }
}

createApp(
  readConfig({
    NODE_ENV: "test",
    FRONTEND_URL: "http://127.0.0.1:5174",
    // Le harnais navigateur enchaîne les parcours depuis une seule IP.
    AUTH_RATE_LIMIT: "5000",
    RATE_LIMIT: "100000",
  }),
  accounts,
  workers,
  missions,
  undefined,
  applications,
  publicOffers,
  missionMedia,
  contracts,
).listen(3001, "127.0.0.1");
