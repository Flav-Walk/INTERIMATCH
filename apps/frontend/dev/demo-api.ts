// Mode démo : répond à /api/v1/* avec des données fictives, en mémoire.
//
// Développement uniquement — chargé par vite.demo.config.ts, jamais par le
// build. Il permet de parcourir tout le front sans backend ni base :
//   npm run dev:demo, puis http://127.0.0.1:5175/__demo
//
// Le rôle est porté par un cookie (demo_role) posé par /__demo/<rôle>.
// Les écritures (candidater, publier, changer un rôle…) modifient l'état en
// mémoire ; il repart de zéro à chaque redémarrage du serveur.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type Role = "worker" | "company" | "admin";
type Json = Record<string, unknown>;

const day = 86_400_000;
const at = (days: number, hour: number, hours = 6) => {
  const start = new Date(Date.now() + days * day);
  start.setHours(hour, 0, 0, 0);
  return [
    start.toISOString(),
    new Date(start.getTime() + hours * 3_600_000).toISOString(),
  ] as const;
};

// ── Référentiels ────────────────────────────────────────────────────────────
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

// ── Comptes ─────────────────────────────────────────────────────────────────
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
      city: "Annecy",
      postal_code: "74000",
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
          employer: "Brasserie du Lac",
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
    email: "contact@hotel-des-alpes.test",
    role: "company",
    first_name: "Julie",
    last_name: "Perrin",
    onboarding_completed: true,
    tour_version: 99,
    demo: false,
    profile: {
      establishment_name: "Hôtel des Alpes",
      sector: "hotel",
      address: "1 rue du Lac",
      city: "Annecy",
      postal_code: "74000",
      description: "Hôtel 4 étoiles au bord du lac.",
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

// ── Missions ────────────────────────────────────────────────────────────────
interface DemoMission extends Json {
  id: string;
  status: string;
}
const mission = (
  n: number,
  title: string,
  job: string,
  city: string,
  status: string,
  days: number,
  pay: string,
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
    address: "1 rue du Lac",
    city,
    postal_code: "74000",
    latitude: null,
    longitude: null,
    pay_amount: pay,
    pay_unit: "hour",
    headcount: 2,
    min_years_experience: n % 2 ? "2" : null,
    status,
    published_at: status === "draft" ? null : new Date().toISOString(),
    demo: false,
    skills: skills
      .slice(0, 2)
      .map((s, i) => ({ id: s.id, name: s.name, required: i === 0 })),
  };
};
const missions: DemoMission[] = [
  mission(1, "Serveur en salle", "serveur", "Annecy", "open", 3, "13.50"),
  mission(2, "Chef de partie", "chef", "Chamonix", "open", 5, "16.00"),
  mission(3, "Barman cocktails", "barman", "Annecy", "open", 6, "14.20"),
  mission(4, "Réceptionniste de nuit", "reception", "Lyon", "open", 8, "13.00"),
  mission(5, "Plongeur", "plongeur", "Grenoble", "filled", 2, "12.10"),
  mission(
    6,
    "Serveur brasserie",
    "serveur",
    "Annecy",
    "completed",
    -6,
    "13.20",
  ),
  mission(7, "Commis de cuisine", "chef", "Annecy", "draft", 12, "12.80"),
  mission(8, "Barman terrasse", "barman", "Annecy", "cancelled", -2, "13.90"),
];

const matchFor = (m: DemoMission) => {
  const n = Number(String(m.id).split("-")[1]);
  const score = [86, 72, 64, 48, 90, 70, 60, 55][n - 1] ?? 60;
  return {
    compatible: true,
    score,
    blockers: [],
    distance_km: 4 + n * 3,
    dimensions: [
      {
        key: "desired_skills",
        label: "Compétences",
        weight: 40,
        ratio: 0.8,
        points: 32,
      },
      {
        key: "proximity",
        label: "Proximité",
        weight: 30,
        ratio: 0.9,
        points: 27,
      },
      { key: "job", label: "Métier", weight: 20, ratio: 1, points: 20 },
      {
        key: "experience",
        label: "Expérience",
        weight: 10,
        ratio: 0.7,
        points: 7,
      },
    ],
  };
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
  city: "Annecy",
  main_job: job,
});
const stamp = new Date(Date.now() - day).toISOString();
const applications: DemoApplication[] = [
  {
    id: "app-1",
    mission_id: "mission-1",
    status: "pending",
    created_at: stamp,
    updated_at: stamp,
    worker: person("demo-worker", "Camille", "Martin"),
  },
  {
    id: "app-2",
    mission_id: "mission-1",
    status: "pending",
    created_at: stamp,
    updated_at: stamp,
    worker: person("w-2", "Lucas", "Dubois"),
  },
  {
    id: "app-3",
    mission_id: "mission-2",
    status: "accepted",
    created_at: stamp,
    updated_at: stamp,
    worker: person("demo-worker", "Camille", "Martin", "chef"),
  },
  {
    id: "app-4",
    mission_id: "mission-3",
    status: "rejected",
    created_at: stamp,
    updated_at: stamp,
    worker: person("w-3", "Inès", "Roux", "barman"),
  },
  {
    id: "app-5",
    mission_id: "mission-3",
    status: "pending",
    created_at: stamp,
    updated_at: stamp,
    worker: person("w-4", "Hugo", "Blanc", "barman"),
  },
];

const missionById = (id: string) => missions.find((m) => m.id === id);
const missionSummary = (m: DemoMission) => ({
  id: m.id,
  title: m.title,
  job: m.job,
  starts_at: m.starts_at,
  ends_at: m.ends_at,
  city: m.city,
  postal_code: m.postal_code,
  status: m.status,
  headcount: m.headcount,
});
const forWorker = (a: DemoApplication) => {
  const m = missionById(a.mission_id)!;
  return {
    id: a.id,
    mission_id: a.mission_id,
    status: a.status,
    created_at: a.created_at,
    updated_at: a.updated_at,
    mission: missionSummary(m),
    company: { establishment_name: "Hôtel des Alpes" },
  };
};
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

const adminUsers = [
  users.admin,
  users.company,
  users.worker,
  {
    id: "w-2",
    email: "lucas.dubois@demo.test",
    role: "worker",
    first_name: "Lucas",
    last_name: "Dubois",
  },
].map((u) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  first_name: u.first_name,
  last_name: u.last_name,
}));

// ── HTTP ────────────────────────────────────────────────────────────────────
const send = (res: ServerResponse, status: number, body?: unknown) => {
  if (body === undefined) {
    res.statusCode = status;
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};
const fail = (
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
) => send(res, status, { error: { code, message } });

const roleOf = (req: IncomingMessage): Role | null => {
  const match = /(?:^|;\s*)demo_role=(worker|company|admin)/.exec(
    req.headers.cookie ?? "",
  );
  return (match?.[1] as Role | undefined) ?? null;
};
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

const indexPage =
  () => `<!doctype html><meta charset="utf-8"><title>Mode démo</title>
<style>body{font:16px/1.6 system-ui;max-width:560px;margin:4rem auto;padding:0 1rem}
a{display:block;margin:.5rem 0;padding:.9rem 1.2rem;border-radius:999px;background:#0e3d32;color:#fff;text-decoration:none}
a.o{background:#fff;color:#0e3d32;border:1px solid #0e3d32}</style>
<h1>Mode démo</h1><p>Données fictives, en mémoire. Choisissez un espace :</p>
<a href="/__demo/worker">Intérimaire — Camille Martin</a>
<a href="/__demo/company">Entreprise — Hôtel des Alpes</a>
<a href="/__demo/admin">Administrateur</a>
<a class="o" href="/__demo/logout">Se déconnecter (pages publiques)</a>`;

async function api(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  path: string,
  query: URLSearchParams,
) {
  const role = roleOf(req);
  const body = method === "GET" ? {} : await readBody(req);

  // Public
  if (path === "/health") return send(res, 200, { status: "ok" });
  if (path === "/reference")
    return send(res, 200, { jobs, sectors, pay_units: payUnits });
  if (path === "/skills") return send(res, 200, skills);
  if (path === "/auth/logout") {
    setRole(res, null);
    return send(res, 204);
  }
  if (path === "/auth/login" || path === "/auth/register") {
    const email = String(body.email ?? "");
    const chosen: Role = /admin/i.test(email)
      ? "admin"
      : /company|entreprise|hotel/i.test(email)
        ? "company"
        : "worker";
    setRole(res, chosen);
    return send(res, 200, { access_token: "demo" });
  }
  if (path === "/auth/refresh") {
    if (!role) return fail(res, 401, "UNAUTHENTICATED", "Session absente.");
    return send(res, 200, { access_token: "demo" });
  }

  if (!role) return fail(res, 401, "UNAUTHENTICATED", "Session absente.");
  const me = users[role];
  const worker = users.worker;

  if (path === "/me") return send(res, 200, me);

  // Écritures de profil et de visite guidée : on renvoie le compte tel quel
  // (fusionné pour PATCH), sans rien valider.
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
  if (path.startsWith("/company/me") && path !== "/company/me/applications") {
    if (method !== "GET")
      users.company.profile = { ...(users.company.profile as Json), ...body };
    return send(res, 200, users.company);
  }
  if (path.startsWith("/me/") || path.startsWith("/tours"))
    return send(res, 200, me);

  // Intérimaire
  if (path === "/workers/me/missions") {
    const open = missions
      .filter((m) => m.status === "open")
      .map((m) => ({
        ...m,
        company: {
          establishment_name: "Hôtel des Alpes",
          sector: "hotel",
          description: "Hôtel 4 étoiles au bord du lac.",
        },
        match: matchFor(m),
      }));
    return send(res, 200, {
      missions: open,
      excluded: { total: 0, reasons: {} },
    });
  }
  const openOne = /^\/workers\/me\/missions\/([^/]+)$/.exec(path);
  if (openOne) {
    const m = missionById(decodeURIComponent(openOne[1]));
    if (!m) return fail(res, 404, "NOT_FOUND", "Mission introuvable.");
    return send(res, 200, {
      ...m,
      company: {
        establishment_name: "Hôtel des Alpes",
        sector: "hotel",
        description: "Hôtel 4 étoiles au bord du lac.",
      },
      match: matchFor(m),
    });
  }
  if (path === "/workers/me/applications") {
    if (method === "POST") {
      const found = applications.find(
        (a) =>
          a.mission_id === body.mission_id && a.worker.id === "demo-worker",
      );
      if (found) return send(res, 201, found);
      const created: DemoApplication = {
        id: `app-${applications.length + 1}`,
        mission_id: String(body.mission_id),
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        worker: person("demo-worker", "Camille", "Martin"),
      };
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
    const application = applications.find(
      (a) =>
        a.mission_id === decodeURIComponent(mine[1]) &&
        a.worker.id === "demo-worker",
    );
    return send(res, 200, { application: application ?? null });
  }

  // Entreprise
  if (path === "/missions") {
    if (method === "POST") {
      const created = {
        ...mission(
          missions.length + 1,
          String(body.title ?? "Nouvelle mission"),
          String(body.job ?? "serveur"),
          String(body.city ?? "Annecy"),
          "draft",
          10,
          String(body.pay_amount ?? "13"),
        ),
        ...body,
        id: `mission-${missions.length + 1}`,
        status: "draft",
        skills: [],
      } as DemoMission;
      missions.push(created);
      return send(res, 201, created);
    }
    const status = query.get("status");
    const counts: Record<string, number> = {};
    for (const m of missions) counts[m.status] = (counts[m.status] ?? 0) + 1;
    return send(res, 200, {
      missions: missions.filter((m) => !status || m.status === status),
      counts,
    });
  }
  const one =
    /^\/missions\/([^/]+)(?:\/(publish|applications)(?:\/([^/]+))?)?$/.exec(
      path,
    );
  if (one) {
    const m = missionById(decodeURIComponent(one[1]));
    if (!m) return fail(res, 404, "NOT_FOUND", "Mission introuvable.");
    if (one[2] === "publish") {
      m.status = "open";
      m.published_at = new Date().toISOString();
      return send(res, 200, m);
    }
    if (one[2] === "applications") {
      if (one[3]) {
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
      });
    }
    if (method === "PATCH") Object.assign(m, body);
    return send(res, 200, m);
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

  // Admin
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

  return fail(res, 404, "NOT_FOUND", `Route démo inconnue : ${method} ${path}`);
}

export function demoApi(): Plugin {
  return {
    name: "interimatch-demo-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://demo.local");
        const method = req.method ?? "GET";

        if (url.pathname === "/__demo") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(indexPage());
          return;
        }
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
