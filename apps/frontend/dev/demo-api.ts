// Mode démo : une fausse API qui répond à /api/v1/* avec des données fictives.
//
// Pourquoi : sans accès à Supabase ni au backend, le front ne peut rien
// afficher. Ce fichier fait semblant d'être le serveur, pour qu'on puisse
// parcourir tout le site et voir les nouveaux composants avec de vraies cartes,
// de vrais badges, de vraies jauges.
//
// Lancement : npm run dev:demo, puis http://127.0.0.1:5175/__demo
//
// - Le rôle (intérimaire, entreprise, admin) est gardé dans un cookie
//   « demo_role », posé quand on clique sur un espace dans /__demo.
// - Tout est en mémoire : si je candidate ou publie une mission, ça marche,
//   mais tout repart à zéro quand on relance le serveur.
// - Uniquement pour le développement : chargé par vite.demo.config.ts, jamais
//   par le build de production.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type Role = "worker" | "company" | "admin";
type Json = Record<string, unknown>;

// ── Petits outils de dates ──────────────────────────────────────────────────
const day = 86_400_000;
const hour = 3_600_000;

// at(3, 17, 6) = une plage qui commence dans 3 jours à 17h et dure 6 heures.
// Un nombre de jours négatif donne une date passée.
const at = (days: number, startHour: number, hours = 6) => {
  const start = new Date(Date.now() + days * day);
  start.setHours(startHour, 0, 0, 0);
  return [
    start.toISOString(),
    new Date(start.getTime() + hours * hour).toISOString(),
  ] as const;
};
const ago = (hours: number) =>
  new Date(Date.now() - hours * hour).toISOString();

// ── Listes de référence (métiers, secteurs, compétences) ────────────────────
const jobs = [
  { value: "serveur", label: "Serveur" },
  { value: "chef", label: "Chef de partie" },
  { value: "barman", label: "Barman" },
  { value: "reception", label: "Réceptionniste" },
  { value: "plongeur", label: "Plongeur" },
];
const sectors = [
  { value: "hotel", label: "Hôtel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
];
const payUnits = [
  { value: "hour", label: "€ / heure" },
  { value: "day", label: "€ / jour" },
];
const skills = [
  "Service en salle",
  "Cocktails",
  "Cuisine chaude",
  "Accueil client",
  "Plonge",
  "Anglais courant",
].map((name, i) => ({ id: `skill-${i + 1}`, name }));

// ── Les 3 comptes de démo ───────────────────────────────────────────────────
// tour_version: 99 = la visite guidée est considérée comme déjà vue, pour
// qu'elle ne s'ouvre pas à chaque fois.
const users: Record<Role, Json> = {
  worker: {
    id: "demo-worker",
    email: "camille.martin@demo.test",
    role: "worker",
    first_name: "Camille",
    last_name: "Martin",
    onboarding_completed: true,
    tour_version: 99,
    demo: false,
    missing_requirements: [],
    profile: {
      city: "Lyon",
      postal_code: "69002",
      main_job: "serveur",
      secondary_jobs: ["barman"],
      years_experience: 4,
      mobility_radius_km: 30,
      has_driving_licence: true,
      has_vehicle: false,
      open_to_missions: true,
      phone: "06 12 34 56 78",
      skills: skills.slice(0, 3),
      experiences: [
        {
          id: "exp-1",
          job_title: "Serveuse",
          employer: "Brasserie des Terreaux",
          years: 3,
        },
      ],
      certifications: [],
      availabilities: [
        {
          id: "av-1",
          starts_at: at(3, 9, 10)[0],
          ends_at: at(3, 9, 10)[1],
          status: "available",
        },
      ],
    },
  },
  company: {
    id: "demo-company",
    email: "contact@comptoir-halles.test",
    role: "company",
    first_name: "Marie",
    last_name: "Dupont",
    onboarding_completed: true,
    tour_version: 99,
    demo: false,
    profile: {
      establishment_name: "Le Comptoir des Halles",
      legal_name: "Comptoir des Halles SAS",
      sector: "restaurant",
      address: "12 rue de la République",
      city: "Lyon",
      postal_code: "69002",
      phone: "04 78 00 00 00",
      description: "Brasserie lyonnaise, 80 couverts, service midi et soir.",
    },
  },
  admin: {
    id: "demo-admin",
    email: "admin@demo.test",
    role: "admin",
    first_name: "Alex",
    last_name: "Admin",
    onboarding_completed: true,
    tour_version: 99,
    demo: false,
    profile: {},
  },
};

const companyCard = {
  establishment_name: "Le Comptoir des Halles",
  sector: "restaurant",
  description: "Brasserie lyonnaise, 80 couverts, service midi et soir.",
};

// ── Photos des missions ─────────────────────────────────────────────────────
// Des photos Unsplash de restaurants, pour voir les cartes « en vrai ». Si une
// photo ne charge pas (pas de réseau), la carte garde simplement son cadre vide.
// La dernière est l'image locale du projet (public/images/fixtures).
const unsplash = (id: string, author: string) => ({
  provider: "unsplash" as const,
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`,
  thumb_url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=300&q=60`,
  external_id: id,
  author_name: author,
  author_url: "https://unsplash.com",
});
const photos = [
  unsplash("1517248135467-4c7edcad34c4", "Jason Leung"),
  unsplash("1414235077428-338989a2e8c0", "Jay Wennington"),
  unsplash("1555396273-367ea4eb4db5", "Kris Atomic"),
  {
    provider: "upload" as const,
    url: "/images/fixtures/mission.jpg",
    storage_path: "demo/mission.jpg",
  },
];

// ── Missions ────────────────────────────────────────────────────────────────
interface DemoMission extends Json {
  id: string;
  status: string;
  headcount: number;
  starts_at: string;
  ends_at: string;
}

// Combien de candidatures acceptées sur une mission : sert à calculer la
// capacité (postes pourvus / postes demandés), comme le fait le vrai serveur.
const acceptedOn = (id: string) =>
  applications.filter((a) => a.mission_id === id && a.status === "accepted")
    .length;

// Le serveur renvoie aussi la capacité, la phase et l'onglet de la mission.
// Je les recalcule ici à chaque lecture, pour qu'ils restent justes quand on
// accepte une candidature ou qu'on annule une mission pendant la démo.
const withState = (m: DemoMission) => {
  const filled = acceptedOn(m.id);
  const full = filled >= m.headcount;
  const now = Date.now();
  const ended = Date.parse(m.ends_at) <= now;
  const started = Date.parse(m.starts_at) <= now;

  const phase =
    m.status === "draft"
      ? "draft"
      : m.status === "cancelled"
        ? "cancelled"
        : ended
          ? "completed"
          : started
            ? "in_progress"
            : "open";
  const group =
    m.status === "draft" || m.status === "cancelled"
      ? m.status
      : ended
        ? "completed"
        : full
          ? "filled"
          : "open";
  const blocked =
    m.status === "draft"
      ? "draft"
      : m.status === "cancelled"
        ? "cancelled"
        : ended
          ? "ended"
          : full
            ? "full"
            : null;

  return {
    ...m,
    capacity: {
      headcount: m.headcount,
      filled,
      remaining: Math.max(0, m.headcount - filled),
      full,
    },
    phase,
    group,
    recruiting: blocked === null,
    recruiting_blocked: blocked,
  };
};

// Fabrique une mission : n (numéro), titre, métier, ville, statut, dans
// combien de jours elle commence, taux horaire, nombre de postes.
const mission = (
  n: number,
  title: string,
  job: string,
  city: string,
  status: string,
  days: number,
  pay: string,
  headcount = 2,
): DemoMission => {
  const [starts_at, ends_at] = at(days, 17, 6);
  return {
    id: `mission-${n}`,
    title,
    description:
      "Service du soir en équipe. Tenue noire fournie, repas du personnel inclus.",
    job,
    starts_at,
    ends_at,
    address: "12 rue de la République",
    city,
    postal_code: "69002",
    latitude: null,
    longitude: null,
    pay_amount: pay,
    pay_unit: "hour",
    headcount,
    min_years_experience: n % 2 ? "2" : null,
    status,
    published_at: status === "draft" ? null : ago(48),
    demo: false,
    media: photos[(n - 1) % photos.length],
    skills: skills
      .slice(0, 2)
      .map((s, i) => ({ id: s.id, name: s.name, required: i === 0 })),
  };
};

// Un exemple de chaque cas, pour voir tous les badges d'état : à pourvoir,
// pourvue, terminée, brouillon, annulée.
const missions: DemoMission[] = [
  mission(1, "Serveur en restauration", "serveur", "Lyon 2e", "open", 3, "13.50"),
  mission(2, "Chef de partie", "chef", "Lyon 3e", "open", 5, "16.00"),
  mission(3, "Barman cocktails", "barman", "Villeurbanne", "open", 6, "14.20"),
  mission(4, "Réceptionniste de nuit", "reception", "Lyon 1er", "open", 8, "13.00", 1),
  mission(5, "Plongeur", "plongeur", "Lyon 7e", "open", 2, "12.10", 1),
  mission(6, "Serveur brasserie", "serveur", "Lyon 2e", "open", -6, "13.20"),
  mission(7, "Commis de cuisine", "chef", "Lyon 2e", "draft", 12, "12.80"),
  mission(8, "Barman terrasse", "barman", "Lyon 5e", "cancelled", -2, "13.90"),
];
const missionById = (id: string) => missions.find((m) => m.id === id);

// ── Rapprochement (score de compatibilité) ──────────────────────────────────
// Le vrai serveur calcule le score ; ici je donne des valeurs fixes, variées,
// pour voir les 3 paliers de la pastille (≥ 70, ≥ 60, ≥ 50).
const bandOf = (score: number) =>
  score >= 70
    ? { band: 70, band_label: "Très compatibles" }
    : score >= 60
      ? { band: 60, band_label: "Compatibles" }
      : score >= 50
        ? { band: 50, band_label: "Envisageables" }
        : { band: null, band_label: null };

// Une dimension du score : son poids, ce qu'elle rapporte, et si c'est un
// point fort ou un point faible (tone).
const dimension = (
  key: "desired_skills" | "proximity" | "job" | "experience",
  label: string,
  weight: number,
  ratio: number,
) => {
  const points = Math.round(weight * ratio);
  return {
    key,
    label,
    weight,
    ratio,
    points,
    lost: weight - points,
    tone: ratio >= 0.8 ? "strength" : ratio >= 0.5 ? "neutral" : "limitation",
  };
};

const matchWith = (score: number, distance: number) => ({
  compatible: true,
  score,
  blockers: [],
  distance_km: distance,
  outside_zone: false,
  skills: { required: { held: 1, total: 1 }, desired: { held: 1, total: 2 } },
  dimensions: [
    dimension("desired_skills", "Compétences", 40, score / 100),
    dimension("proximity", "Proximité", 30, Math.min(1, (score + 10) / 100)),
    dimension("job", "Métier", 20, 1),
    dimension("experience", "Expérience", 10, 0.6),
  ],
  ...bandOf(score),
});

const matchFor = (m: DemoMission) => {
  const n = Number(m.id.split("-")[1]);
  const score = [92, 74, 64, 55, 88, 70, 60, 52][n - 1] ?? 60;
  return matchWith(score, 2 + n * 3);
};

// ── Candidatures ────────────────────────────────────────────────────────────
interface DemoApplication {
  id: string;
  mission_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
  worker: {
    id: string;
    first_name: string;
    last_name: string;
    city: string;
    main_job: string;
  };
}
const person = (id: string, first: string, last: string, job = "serveur") => ({
  id,
  first_name: first,
  last_name: last,
  city: "Lyon",
  main_job: job,
});
const application = (
  n: number,
  missionId: string,
  status: DemoApplication["status"],
  worker: DemoApplication["worker"],
  hoursAgo: number,
): DemoApplication => ({
  id: `app-${n}`,
  mission_id: missionId,
  status,
  created_at: ago(hoursAgo),
  updated_at: ago(hoursAgo / 2),
  worker,
});
const camille = person("demo-worker", "Camille", "Martin");

// Un mélange d'états pour voir les badges « En attente », « Acceptée »,
// « Non retenue », et une mission pourvue (le plongeur, 1 poste accepté).
const applications: DemoApplication[] = [
  application(1, "mission-1", "pending", camille, 5),
  application(2, "mission-1", "pending", person("w-2", "Emma", "Leroy"), 8),
  application(3, "mission-2", "accepted", { ...camille, main_job: "chef" }, 30),
  application(4, "mission-3", "rejected", person("w-3", "Thomas", "Rieu", "barman"), 26),
  application(5, "mission-3", "pending", person("w-4", "Chloé", "Dubois", "barman"), 3),
  application(6, "mission-5", "accepted", person("w-5", "Nabil", "Aitken", "plongeur"), 50),
  application(7, "mission-6", "accepted", camille, 200),
];

// Résumé de mission, tel qu'il apparaît dans une candidature.
const missionSummary = (m: DemoMission) => {
  const s = withState(m);
  return {
    id: s.id,
    title: s.title,
    job: s.job,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    city: s.city,
    postal_code: s.postal_code,
    status: s.status,
    headcount: s.headcount,
    phase: s.phase,
    capacity: s.capacity,
    recruiting: s.recruiting,
    recruiting_blocked: s.recruiting_blocked,
  };
};
// La même candidature, vue par l'intérimaire, par la mission ou par
// l'entreprise : chaque écran reçoit la forme qu'il attend.
const forWorker = (a: DemoApplication) => ({
  id: a.id,
  mission_id: a.mission_id,
  status: a.status,
  created_at: a.created_at,
  updated_at: a.updated_at,
  mission: missionSummary(missionById(a.mission_id)!),
  company: { establishment_name: companyCard.establishment_name },
});
const forMission = (a: DemoApplication) => ({
  id: a.id,
  mission_id: a.mission_id,
  status: a.status,
  created_at: a.created_at,
  updated_at: a.updated_at,
  worker: a.worker,
  conflict: false,
});
const forCompany = (a: DemoApplication) => ({
  ...forMission(a),
  mission: missionSummary(missionById(a.mission_id)!),
});

// ── Profils suggérés par le rapprochement (côté entreprise) ─────────────────
const candidate = (
  id: string,
  first: string,
  last: string,
  job: string,
  years: number,
  score: number,
) => ({
  id,
  first_name: first,
  last_initial: last[0],
  main_job: job,
  city: "Lyon",
  years_experience: years,
  matched_skills: skills
    .slice(0, 2)
    .map((s, i) => ({ id: s.id, name: s.name, required: i === 0 })),
  match: matchWith(score, 3 + years),
});
const suggested = [
  candidate("c-1", "Emma", "Leroy", "serveur", 3, 92),
  candidate("c-2", "Thomas", "Rieu", "serveur", 2, 78),
  candidate("c-3", "Chloé", "Dubois", "barman", 4, 66),
  candidate("c-4", "Hugo", "Blanc", "serveur", 1, 54),
];

// ── Documents (contrats de mission) ─────────────────────────────────────────
// Un contrat par candidature acceptée, dans différents états pour voir tous
// les badges : à valider, en attente de l'autre partie, finalisé.
const contractStates = [
  "awaiting_worker_signature",
  "awaiting_company_signature",
  "completed",
] as const;
type ContractState =
  | (typeof contractStates)[number]
  | "awaiting_finalization"
  | "draft"
  | "cancelled";

const documents = applications
  .filter((a) => a.status === "accepted")
  .map((a, i) => ({
    id: `doc-${i + 1}`,
    application: a,
    status: contractStates[i % contractStates.length] as ContractState,
    worker_signed_at: i % 3 === 0 ? null : ago(20),
    company_signed_at: i % 3 === 2 ? ago(10) : null,
    created_at: ago(24),
  }));

const docListItem = (d: (typeof documents)[number]) => {
  const m = missionById(d.application.mission_id)!;
  return {
    id: d.id,
    application_id: d.application.id,
    mission_id: m.id,
    worker_id: d.application.worker.id,
    company_id: "demo-company",
    type: "mission_agreement" as const,
    status: d.status,
    document_version: 1,
    worker_signed_at: d.worker_signed_at,
    company_signed_at: d.company_signed_at,
    completed_at: d.status === "completed" ? ago(5) : null,
    created_at: d.created_at,
    updated_at: ago(2),
    mission: { id: m.id, title: m.title, starts_at: m.starts_at },
    worker: {
      id: d.application.worker.id,
      first_name: d.application.worker.first_name,
      last_name: d.application.worker.last_name,
    },
    company: {
      id: "demo-company",
      legal_name: "Comptoir des Halles SAS",
      establishment_name: companyCard.establishment_name,
    },
  };
};

const docDetail = (d: (typeof documents)[number]) => {
  const item = docListItem(d);
  const m = missionById(d.application.mission_id)!;
  const w = d.application.worker;
  const signatures = [
    ...(d.worker_signed_at
      ? [{ id: `${d.id}-w`, actor_role: "worker", created_at: d.worker_signed_at }]
      : []),
    ...(d.company_signed_at
      ? [{ id: `${d.id}-c`, actor_role: "company", created_at: d.company_signed_at }]
      : []),
  ];
  return {
    id: item.id,
    application_id: item.application_id,
    mission_id: item.mission_id,
    worker_id: item.worker_id,
    company_id: item.company_id,
    type: item.type,
    status: item.status,
    document_version: item.document_version,
    worker_signed_at: item.worker_signed_at,
    company_signed_at: item.company_signed_at,
    completed_at: item.completed_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
    snapshot: {
      generated_at: d.created_at,
      legal_notice:
        "Document fictif du mode démo. Il n'a aucune valeur contractuelle.",
      application: { id: d.application.id, accepted_at: d.application.updated_at },
      worker: {
        id: w.id,
        first_name: w.first_name,
        last_name: w.last_name,
        email: `${w.first_name.toLowerCase()}@demo.test`,
        phone: "06 12 34 56 78",
        city: w.city,
        postal_code: "69002",
      },
      company: {
        id: "demo-company",
        legal_name: "Comptoir des Halles SAS",
        establishment_name: companyCard.establishment_name,
        representative_first_name: "Marie",
        representative_last_name: "Dupont",
        email: "contact@comptoir-halles.test",
        phone: "04 78 00 00 00",
        address: "12 rue de la République",
        city: "Lyon",
        postal_code: "69002",
        sector: "restaurant",
      },
      mission: {
        id: m.id,
        title: m.title,
        description: String(m.description),
        job: String(m.job),
        starts_at: m.starts_at,
        ends_at: m.ends_at,
        address: String(m.address),
        city: String(m.city),
        postal_code: String(m.postal_code),
        pay_amount: m.pay_amount as string,
        pay_unit: "hour",
        headcount: m.headcount,
      },
    },
    signatures,
    download_available: false,
  };
};

// ── Offres France Travail (fictives) ────────────────────────────────────────
const publicOffer = (
  n: number,
  title: string,
  company: string | null,
  city: string,
  contract: [string, string],
  salary: string,
) => ({
  id: `ft-${n}`,
  source: "france_travail",
  external_id: `DEMO${1000 + n}`,
  title,
  description:
    "Offre fictive du mode démo. Vous rejoignez une équipe dynamique pour la saison.",
  rome_code: "G1803",
  rome_label: "Service en restauration",
  company_name: company,
  contract_type: contract[0],
  contract_label: contract[1],
  experience_label: n % 2 ? "1 an minimum" : "Débutant accepté",
  postal_code: "69002",
  city,
  latitude: null,
  longitude: null,
  salary_label: salary,
  working_time: "35 h / semaine",
  positions: 1 + (n % 3),
  skills: [
    { name: "Service en salle", required: true },
    { name: "Encaissement", required: false },
    { name: "Accueil client", required: false },
    { name: "Anglais", required: false },
  ],
  professional_qualities: [{ label: "Sens du service" }],
  source_url: null,
  created_at_source: ago(72),
  updated_at_source: ago(24),
  imported_at: ago(12),
});
const publicOffers = [
  publicOffer(1, "Serveur / Serveuse", "Brasserie Georges", "Lyon", ["CDD", "CDD 6 mois"], "12,50 € / h"),
  publicOffer(2, "Chef de rang", "Hôtel Carlton", "Lyon", ["CDI", "CDI"], "2 100 € / mois"),
  publicOffer(3, "Barman / Barmaid", null, "Villeurbanne", ["SAI", "Saisonnier"], "12 € / h"),
  publicOffer(4, "Commis de cuisine", "Les Halles Paul Bocuse", "Lyon", ["CDD", "CDD 3 mois"], "1 850 € / mois"),
];

// Petite bibliothèque « Unsplash » pour le choix de photo d'une mission.
const unsplashPhotos = [
  unsplash("1517248135467-4c7edcad34c4", "Jason Leung"),
  unsplash("1414235077428-338989a2e8c0", "Jay Wennington"),
  unsplash("1555396273-367ea4eb4db5", "Kris Atomic"),
];
const unsplashResults = unsplashPhotos.map((p) => ({
  id: p.external_id,
  thumb_url: p.thumb_url,
  preview_url: p.url,
  alt: "Salle de restaurant",
  author_name: p.author_name,
  author_url: p.author_url,
}));

// ── Admin ───────────────────────────────────────────────────────────────────
const adminUsers = [
  users.admin,
  users.company,
  users.worker,
  {
    id: "w-2",
    email: "emma.leroy@demo.test",
    role: "worker",
    first_name: "Emma",
    last_name: "Leroy",
  },
].map((u) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  first_name: u.first_name,
  last_name: u.last_name,
}));

// ── Outils HTTP ─────────────────────────────────────────────────────────────
const send = (res: ServerResponse, status: number, body?: unknown) => {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};
const fail = (
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
) => send(res, status, { error: { code, message } });

// Lit le rôle dans le cookie demo_role.
const roleOf = (req: IncomingMessage): Role | null => {
  const match = /(?:^|;\s*)demo_role=(worker|company|admin)/.exec(
    req.headers.cookie ?? "",
  );
  return (match?.[1] as Role | undefined) ?? null;
};
// Lit le corps JSON d'une requête (POST, PATCH…). Un corps vide ou non JSON
// (comme l'envoi d'une photo) donne un objet vide.
const readBody = (req: IncomingMessage) =>
  new Promise<Json>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}") as Json);
      } catch {
        resolve({});
      }
    });
  });

const setRole = (res: ServerResponse, role: Role | null) =>
  res.setHeader(
    "Set-Cookie",
    role
      ? `demo_role=${role}; Path=/; SameSite=Lax`
      : "demo_role=; Path=/; Max-Age=0; SameSite=Lax",
  );

const home = (role: Role) => (role === "admin" ? "/admin" : `/${role}`);

// La page /__demo : 4 boutons pour choisir l'espace à visiter.
const indexPage =
  () => `<!doctype html><meta charset="utf-8"><title>Mode démo · InteriMatch</title>
<style>body{font:16px/1.6 system-ui;max-width:560px;margin:4rem auto;padding:0 1rem;color:#1d2b25}
a{display:block;margin:.5rem 0;padding:.9rem 1.2rem;border-radius:10px;background:#0e3d32;color:#fff;text-decoration:none}
a.o{background:#fff;color:#0e3d32;border:1px solid #0e3d32}</style>
<h1>Mode démo</h1><p>Données fictives, en mémoire. Choisissez un espace :</p>
<a href="/__demo/worker">Intérimaire — Camille Martin</a>
<a href="/__demo/company">Entreprise — Le Comptoir des Halles</a>
<a href="/__demo/admin">Administrateur</a>
<a class="o" href="/__demo/logout">Se déconnecter (pages publiques)</a>`;

// ── Les routes de la fausse API ─────────────────────────────────────────────
async function api(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  path: string,
  query: URLSearchParams,
) {
  const role = roleOf(req);
  const body = method === "GET" ? {} : await readBody(req);

  // Routes publiques (sans connexion)
  if (path === "/health") return send(res, 200, { status: "ok" });
  if (path === "/reference")
    return send(res, 200, { jobs, sectors, pay_units: payUnits });
  if (path === "/skills") return send(res, 200, skills);
  if (path === "/auth/logout") {
    setRole(res, null);
    return send(res, 204);
  }
  // Connexion : n'importe quel mot de passe marche. Le rôle est deviné depuis
  // l'email (« admin… » → admin, « hotel/entreprise… » → entreprise).
  if (path === "/auth/login" || path === "/auth/register") {
    const email = String(body.email ?? "");
    const chosen: Role = /admin/i.test(email)
      ? "admin"
      : /company|entreprise|hotel|comptoir/i.test(email)
        ? "company"
        : "worker";
    setRole(res, chosen);
    return send(res, 200, { access_token: "demo" });
  }
  if (path === "/auth/refresh") {
    if (!role) return fail(res, 401, "UNAUTHENTICATED", "Session absente.");
    return send(res, 200, { access_token: "demo" });
  }

  // Tout le reste demande d'être connecté.
  if (!role) return fail(res, 401, "UNAUTHENTICATED", "Session absente.");
  const me = users[role];
  const worker = users.worker;

  if (path === "/me") return send(res, 200, me);

  // ── Documents ──
  if (path === "/workers/me/documents")
    return send(res, 200, {
      documents: documents
        .filter((d) => d.application.worker.id === "demo-worker")
        .map(docListItem),
    });
  if (path === "/company/me/documents")
    return send(res, 200, { documents: documents.map(docListItem) });
  const doc = /^\/documents\/([^/]+)(?:\/(sign|download))?$/.exec(path);
  if (doc) {
    const d = documents.find((x) => x.id === decodeURIComponent(doc[1]));
    if (!d) return fail(res, 404, "NOT_FOUND", "Document introuvable.");
    if (doc[2] === "download")
      return fail(res, 404, "NOT_AVAILABLE", "Pas de PDF en mode démo.");
    if (doc[2] === "sign") {
      // Signer fait avancer le contrat, comme le vrai parcours.
      if (role === "worker") {
        d.worker_signed_at = new Date().toISOString();
        d.status = "awaiting_company_signature";
      } else {
        d.company_signed_at = new Date().toISOString();
        d.status = "completed";
      }
    }
    return send(res, 200, docDetail(d));
  }

  // ── Offres France Travail ──
  if (path === "/public-job-offers") {
    const search = (query.get("search") ?? "").toLowerCase();
    const list = publicOffers.filter(
      (o) => !search || o.title.toLowerCase().includes(search),
    );
    return send(res, 200, {
      offers: list,
      total: list.length,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  }
  const offer = /^\/public-job-offers\/([^/]+)$/.exec(path);
  if (offer) {
    const o = publicOffers.find((x) => x.id === decodeURIComponent(offer[1]));
    return o ? send(res, 200, o) : fail(res, 404, "NOT_FOUND", "Offre introuvable.");
  }

  // ── Profil intérimaire : on renvoie le compte tel quel ──
  // (fusionné pour un PATCH), sans rien valider : c'est une démo.
  if (
    path.startsWith("/workers/me") &&
    !path.startsWith("/workers/me/missions") &&
    !path.startsWith("/workers/me/applications")
  ) {
    if (method === "PATCH") {
      const { first_name, last_name, ...profile } = body;
      if (typeof first_name === "string") worker.first_name = first_name;
      if (typeof last_name === "string") worker.last_name = last_name;
      worker.profile = { ...(worker.profile as Json), ...profile };
    }
    return send(res, 200, worker);
  }

  // ── Photos de mission (entreprise) ──
  if (path === "/company/media/unsplash")
    return send(res, 200, {
      results: unsplashResults,
      total: unsplashResults.length,
      total_pages: 1,
    });
  if (path === "/company/media") return send(res, 201, photos[3]);

  if (
    path.startsWith("/company/me") &&
    path !== "/company/me/applications"
  ) {
    if (method !== "GET")
      users.company.profile = { ...(users.company.profile as Json), ...body };
    return send(res, 200, users.company);
  }
  if (path.startsWith("/onboarding/")) return send(res, 200, me);
  if (path.startsWith("/me/") || path.startsWith("/tours"))
    return send(res, 200, me);

  // ── Intérimaire : missions proposées ──
  if (path === "/workers/me/missions") {
    const open = missions
      .map(withState)
      .filter((m) => m.recruiting)
      .map((m) => ({ ...m, company: companyCard, match: matchFor(m) }));
    return send(res, 200, {
      missions: open,
      excluded: { total: 2, reasons: { out_of_range: 1, unavailable: 1 } },
    });
  }
  const openOne = /^\/workers\/me\/missions\/([^/]+)$/.exec(path);
  if (openOne) {
    const m = missionById(decodeURIComponent(openOne[1]));
    if (!m) return fail(res, 404, "NOT_FOUND", "Mission introuvable.");
    return send(res, 200, {
      ...withState(m),
      company: companyCard,
      match: matchFor(m),
    });
  }

  // ── Intérimaire : candidatures ──
  if (path === "/workers/me/applications") {
    if (method === "POST") {
      const found = applications.find(
        (a) =>
          a.mission_id === body.mission_id && a.worker.id === "demo-worker",
      );
      if (found) return send(res, 201, { ...found, worker_id: "demo-worker" });
      const created = application(
        applications.length + 1,
        String(body.mission_id),
        "pending",
        camille,
        0,
      );
      applications.push(created);
      return send(res, 201, { ...created, worker_id: "demo-worker" });
    }
    return send(res, 200, {
      applications: applications
        .filter((a) => a.worker.id === "demo-worker")
        .map(forWorker),
    });
  }
  const mine = /^\/workers\/me\/applications\/([^/]+)$/.exec(path);
  if (mine) {
    const found = applications.find(
      (a) =>
        a.mission_id === decodeURIComponent(mine[1]) &&
        a.worker.id === "demo-worker",
    );
    return send(res, 200, {
      application: found ? { ...found, worker_id: "demo-worker" } : null,
    });
  }

  // ── Entreprise : missions ──
  if (path === "/missions") {
    if (method === "POST") {
      const n = missions.length + 1;
      const created = {
        ...mission(
          n,
          String(body.title ?? "Nouvelle mission"),
          String(body.job ?? "serveur"),
          String(body.city ?? "Lyon"),
          "draft",
          10,
          String(body.pay_amount ?? "13"),
        ),
        ...body,
        id: `mission-${n}`,
        status: "draft",
        skills: [],
        media: photos[(n - 1) % photos.length],
      } as DemoMission;
      missions.push(created);
      return send(res, 201, withState(created));
    }
    const all = missions.map(withState);
    const counts: Record<string, number> = {};
    for (const m of all) counts[m.group] = (counts[m.group] ?? 0) + 1;
    const status = query.get("status");
    return send(res, 200, {
      missions: all.filter((m) => !status || m.status === status),
      counts,
    });
  }
  const one =
    /^\/missions\/([^/]+)(?:\/(publish|cancel|candidates|applications)(?:\/([^/]+))?)?$/.exec(
      path,
    );
  if (one) {
    const m = missionById(decodeURIComponent(one[1]));
    if (!m) return fail(res, 404, "NOT_FOUND", "Mission introuvable.");
    if (one[2] === "publish") {
      m.status = "open";
      m.published_at = new Date().toISOString();
      return send(res, 200, withState(m));
    }
    if (one[2] === "cancel") {
      m.status = "cancelled";
      return send(res, 200, withState(m));
    }
    if (one[2] === "candidates") {
      const s = withState(m);
      return send(res, 200, {
        band: 70,
        band_label: "Très compatibles",
        candidates: s.recruiting ? suggested : [],
        outside_zone: [],
        inactive: s.recruiting_blocked,
      });
    }
    if (one[2] === "applications") {
      if (one[3]) {
        // Accepter ou refuser une candidature.
        const app = applications.find(
          (a) => a.id === decodeURIComponent(one[3]),
        );
        if (!app)
          return fail(res, 404, "NOT_FOUND", "Candidature introuvable.");
        app.status = body.status as DemoApplication["status"];
        app.updated_at = new Date().toISOString();
        return send(res, 200, forMission(app));
      }
      return send(res, 200, {
        applications: applications
          .filter((a) => a.mission_id === m.id)
          .map(forMission),
        capacity: withState(m).capacity,
      });
    }
    if (method === "PATCH") Object.assign(m, body);
    return send(res, 200, withState(m));
  }
  if (path === "/company/me/applications") {
    const list = applications.filter((a) => missionById(a.mission_id));
    const count = (s: string) => list.filter((a) => a.status === s).length;
    return send(res, 200, {
      applications: list.map(forCompany),
      counts: {
        pending: count("pending"),
        accepted: count("accepted"),
        rejected: count("rejected"),
        total: list.length,
      },
    });
  }

  // ── Admin ──
  if (path === "/admin/users") return send(res, 200, adminUsers);
  const roleChange = /^\/admin\/users\/([^/]+)\/role$/.exec(path);
  if (roleChange) {
    const target = adminUsers.find(
      (u) => u.id === decodeURIComponent(roleChange[1]),
    );
    if (!target) return fail(res, 404, "NOT_FOUND", "Utilisateur introuvable.");
    target.role = body.role as Role;
    return send(res, 200, target);
  }

  // Route pas encore simulée : le message apparaît dans la console du
  // navigateur, ce qui aide à savoir quoi ajouter ici.
  return fail(res, 404, "NOT_FOUND", `Route démo inconnue : ${method} ${path}`);
}

// ── Le plugin Vite ──────────────────────────────────────────────────────────
// Il s'intercale devant le serveur de dev : /__demo et /api/v1/* sont traités
// ici, tout le reste (les pages, le JS, le CSS) continue vers Vite.
export function demoApi(): Plugin {
  return {
    name: "interimatch-demo-api",
    apply: "serve", // seulement avec « vite » en dev, jamais au build
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://demo.local");
        const method = req.method ?? "GET";

        if (url.pathname === "/__demo") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(indexPage());
          return;
        }
        // /__demo/worker, /__demo/company… : pose le cookie puis redirige
        // vers l'accueil de l'espace choisi.
        const switcher = /^\/__demo\/(worker|company|admin|logout)$/.exec(
          url.pathname,
        );
        if (switcher) {
          const target = switcher[1];
          setRole(res, target === "logout" ? null : (target as Role));
          res.statusCode = 302;
          res.setHeader(
            "Location",
            target === "logout" ? "/" : home(target as Role),
          );
          res.end();
          return;
        }
        if (url.pathname.startsWith("/api/v1/")) {
          void api(
            req,
            res,
            method,
            url.pathname.slice("/api/v1".length),
            url.searchParams,
          ).catch(() => fail(res, 500, "DEMO_ERROR", "Erreur du mode démo."));
          return;
        }
        next();
      });

      // Affiche l'adresse de la démo dans le Terminal au démarrage.
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const port =
          typeof address === "object" && address ? address.port : 5175;
        server.config.logger.info(
          `\n  Mode démo (données fictives) → http://127.0.0.1:${port}/__demo\n`,
        );
      });
    },
  };
}
