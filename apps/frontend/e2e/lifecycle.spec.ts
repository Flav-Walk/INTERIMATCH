import { expect, test, type Page, type Route } from "@playwright/test";

const now = new Date("2030-06-12T12:00:00.000Z");

const profile = {
  city: "Lyon",
  postal_code: "69002",
  mobility_radius_km: 30,
  establishment_name: "Le Central",
  address: "12 rue de la République",
};

const user = (role: "worker" | "company") => ({
  id: `${role}-id`,
  email: `${role}@example.test`,
  role,
  first_name: role === "worker" ? "Camille" : "Alex",
  last_name: "Test",
  onboarding_completed: true,
  tour_version: 99,
  demo: false,
  profile,
});

const mission = (
  id: string,
  title: string,
  status: "draft" | "open" | "filled" | "completed" | "cancelled",
  starts_at: string,
  ends_at: string,
) => ({
  id,
  title,
  description: "Renfort de service.",
  job: "serveur",
  starts_at,
  ends_at,
  address: "12 rue de la République",
  city: "Lyon",
  postal_code: "69002",
  latitude: 45.75,
  longitude: 4.85,
  pay_amount: "14.00",
  pay_unit: "hour",
  headcount: 1,
  capacity: {
    headcount: 1,
    filled: status === "filled" ? 1 : 0,
    remaining: status === "filled" ? 0 : 1,
    full: status === "filled",
  },
  min_years_experience: null,
  status,
  published_at: status === "draft" ? null : "2030-05-01T10:00:00.000Z",
  demo: false,
  skills: [],
});

const future = mission(
  "future",
  "Service à venir",
  "open",
  "2030-06-15T10:00:00.000Z",
  "2030-06-15T18:00:00.000Z",
);
const running = mission(
  "running",
  "Service en cours",
  "open",
  "2030-06-12T10:00:00.000Z",
  "2030-06-12T18:00:00.000Z",
);
const past = mission(
  "past",
  "Service terminé",
  "completed",
  "2030-06-10T10:00:00.000Z",
  "2030-06-10T18:00:00.000Z",
);
const cancelled = mission(
  "cancelled",
  "Service annulé",
  "cancelled",
  "2030-06-16T10:00:00.000Z",
  "2030-06-16T18:00:00.000Z",
);

const asApplication = (
  item: ReturnType<typeof mission>,
  status: "pending" | "accepted" | "rejected",
) => ({
  id: `application-${item.id}-${status}`,
  mission_id: item.id,
  status,
  created_at: "2030-05-20T10:00:00.000Z",
  updated_at: "2030-05-20T10:00:00.000Z",
  mission: {
    title: item.title,
    job: item.job,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    city: item.city,
    postal_code: item.postal_code,
    status: item.status,
  },
  company: { establishment_name: "Le Central" },
});

let missionStore: Record<string, ReturnType<typeof mission>> = {};

function initMissions() {
  missionStore = {
    draft: mission(
      "draft",
      "Brouillon banquet",
      "draft",
      "2030-06-20T10:00:00.000Z",
      "2030-06-20T18:00:00.000Z",
    ),
    future: { ...future },
    filled: mission(
      "filled",
      "Service pourvu",
      "filled",
      "2030-06-18T10:00:00.000Z",
      "2030-06-18T18:00:00.000Z",
    ),
    running: { ...running },
    past: { ...past },
    cancelled: { ...cancelled },
  };
}

async function mockApi(page: Page, role: "worker" | "company") {
  initMissions();
  await page.clock.setFixedTime(now);
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: body,
      });

    if (path === "/auth/refresh") return json({ access_token: "test-token" });
    if (path === "/me") return json(user(role));
    if (path === "/reference")
      return json({
        sectors: [{ value: "restauration", label: "Hôtellerie-Restauration" }],
        jobs: [{ value: "serveur", label: "Serveur" }],
      });
    if (path === "/company/me/applications")
      return json({
        applications: [],
        counts: { pending: 0, accepted: 0, rejected: 0, total: 0 },
      });
    if (path === "/workers/me/applications")
      return json({
        applications: [
          asApplication(future, "pending"),
          asApplication(
            { ...future, id: "rejected", title: "Service refusé" },
            "rejected",
          ),
          asApplication(
            { ...future, id: "confirmed", title: "Service confirmé" },
            "accepted",
          ),
          asApplication(running, "accepted"),
          asApplication(past, "accepted"),
          asApplication(cancelled, "accepted"),
        ],
      });
    if (path.startsWith("/workers/me/applications/")) {
      const missionId = decodeURIComponent(
        path.replace("/workers/me/applications/", ""),
      );
      const app = [
        asApplication(future, "pending"),
        asApplication(
          { ...future, id: "confirmed", title: "Service confirmé" },
          "accepted",
        ),
        asApplication(running, "accepted"),
        asApplication(past, "accepted"),
        asApplication(cancelled, "accepted"),
      ].find((a) => a.mission_id === missionId);
      return json({ application: app ?? null });
    }
    if (path.startsWith("/workers/me/missions/")) {
      const missionId = path.replace("/workers/me/missions/", "");
      const item = missionStore[missionId] ?? future;
      return json({
        ...item,
        company: {
          establishment_name: "Le Central",
          sector: "restauration",
          description: "Brasserie traditionnelle en plein cœur de ville.",
        },
        match: {
          score: 95,
          compatible: true,
          summary: "Profil parfaitement compatible",
          dimensions: [
            { key: "job", ratio: 1 },
            { key: "desired_skills", ratio: 1 },
          ],
        },
      });
    }
    if (
      path.startsWith("/missions/") &&
      path.endsWith("/cancel") &&
      method === "POST"
    ) {
      const missionId = path.replace("/missions/", "").replace("/cancel", "");
      if (missionStore[missionId]) {
        missionStore[missionId] = {
          ...missionStore[missionId],
          status: "cancelled",
        };
        return json(missionStore[missionId]);
      }
    }
    if (path.startsWith("/missions/") && path.endsWith("/applications")) {
      return json({
        applications: [
          {
            id: "cand-1",
            mission_id: "future",
            status: "pending",
            conflict: false,
            created_at: "2030-05-20T10:00:00.000Z",
            worker: {
              id: "worker-1",
              first_name: "Camille",
              last_name: "Martin",
              city: "Lyon",
              postal_code: "69002",
              main_job: "serveur",
            },
          },
        ],
        counts: { total: 1, pending: 1, accepted: 0, rejected: 0 },
        capacity: {
          headcount: 1,
          filled: 0,
          remaining: 1,
          full: false,
        },
      });
    }
    if (path.startsWith("/missions/") && !path.includes("/publish")) {
      const missionId = path.replace("/missions/", "");
      const item = missionStore[missionId];
      if (item) return json(item);
    }
    if (path === "/missions") {
      const missions = Object.values(missionStore);
      return json({
        missions,
        counts: {
          draft: 1,
          open: 2,
          filled: 1,
          completed: 1,
          cancelled: 1,
        },
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      json: {
        error: { code: "NOT_FOUND", message: `Fixture absente pour ${path}.` },
      },
    });
  });
}

test("le worker distingue chaque état de son historique", async ({
  page,
}, testInfo) => {
  await mockApi(page, "worker");
  await page.goto("/worker/applications");

  for (const label of [
    "Candidature en attente",
    "Candidature non retenue",
    "Mission confirmée",
    "Mission en cours",
    "Mission terminée",
    "Mission annulée",
  ])
    await expect(page.getByText(label, { exact: true })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("worker-mission-lifecycle.png"),
    fullPage: true,
  });
});

test("le worker consulte le détail d'une mission terminée et d'une mission annulée", async ({
  page,
}, testInfo) => {
  await mockApi(page, "worker");

  // Mission terminée
  await page.goto("/worker/missions/past");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Service terminé",
  );
  await expect(
    page.getByRole("heading", { name: "Mission terminée" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Cette mission est terminée et reste accessible dans votre historique.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("worker-mission-detail-completed.png"),
    fullPage: true,
  });

  // Mission annulée
  await page.goto("/worker/missions/cancelled");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Service annulé",
  );
  await expect(
    page.getByRole("heading", { name: "Mission annulée" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Cette mission a été annulée. Votre candidature reste visible dans votre historique.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("worker-mission-detail-cancelled.png"),
    fullPage: true,
  });
});

test("l’entreprise distingue statut de recrutement et temporalité", async ({
  page,
}, testInfo) => {
  await mockApi(page, "company");
  await page.goto("/company/missions");

  const expected = [
    ["Brouillon banquet", "Brouillon"],
    ["Service à venir", "À pourvoir"],
    ["Service pourvu", "Pourvue"],
    ["Service en cours", "En cours"],
    ["Service terminé", "Terminée"],
    ["Service annulé", "Annulée"],
  ] as const;
  for (const [title, status] of expected) {
    const card = page.getByRole("link").filter({ hasText: title });
    await expect(card).toContainText(status);
  }
  await expect(
    page.getByRole("link").filter({ hasText: "Service à venir" }),
  ).toContainText("À venir");
  await expect(page.getByRole("button", { name: /Annulées/ })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("company-mission-lifecycle.png"),
    fullPage: true,
  });
});

test("l’entreprise peut annuler une mission publiée à venir et voit le cycle clos", async ({
  page,
}, testInfo) => {
  await mockApi(page, "company");
  await page.goto("/company/missions/future");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Service à venir",
  );
  const cancelBtn = page.getByRole("button", { name: "Annuler la mission" });
  await expect(cancelBtn).toBeVisible();

  await cancelBtn.click();
  await expect(
    page.getByRole("heading", { name: "Annuler cette mission ?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Confirmer l’annulation" }).click();

  await expect(
    page.getByText(
      "Mission annulée. Les intérimaires retenus ont été libérés de ce créneau.",
    ),
  ).toBeVisible();
  await expect(
    page
      .locator(".section-head .mission-status")
      .filter({ hasText: "Annulée" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mission annulée : aucune décision n’est encore possible."),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("company-mission-detail-cancelled.png"),
    fullPage: true,
  });
});
