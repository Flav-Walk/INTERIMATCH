import { expect, test, type Page } from "@playwright/test";

const admin = {
  id: "00000000-0000-4000-8000-000000000010",
  email: "admin@example.test",
  role: "admin",
  first_name: "Alex",
  last_name: "Admin",
  onboarding_completed: true,
  tour_version: 1,
  demo: false,
  profile: {},
};
const worker = {
  id: "00000000-0000-4000-8000-000000000020",
  email: "camille@example.test",
  role: "worker",
  first_name: "Camille",
  last_name: "Martin",
};

async function mockSession(page: Page, role: "admin" | "worker") {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (path === "/auth/refresh")
      return route.fulfill({ json: { access_token: "synthetic-token" } });
    if (path === "/me")
      return route.fulfill({
        json:
          role === "admin"
            ? admin
            : {
                ...worker,
                onboarding_completed: true,
                tour_version: 1,
                demo: false,
                profile: {},
              },
      });
    if (path === "/admin/users" && request.method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return route.fulfill({ json: [admin, worker] });
    }
    if (path.endsWith(`/admin/users/${worker.id}/role`))
      return route.fulfill({ json: { ...worker, role: "company" } });
    if (path === "/workers/me/missions")
      return route.fulfill({ json: { missions: [] } });
    return route.fulfill({ json: [] });
  });
}

test("un admin consulte les utilisateurs et modifie un rôle", async ({
  page,
}) => {
  await mockSession(page, "admin");
  await page.goto("/admin");
  await expect(
    page.getByRole("status", { name: "Chargement des utilisateurs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
  await expect(page.getByText("Camille Martin")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: worker.email });
  await row.getByRole("combobox").selectOption("company");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.getByRole("status")).toHaveText("Enregistré");
  await expect(row.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  const ownRow = page.getByRole("row").filter({ hasText: admin.email });
  await expect(ownRow.getByRole("combobox")).toBeDisabled();
});

test("une erreur API est affichée", async ({ page }) => {
  await mockSession(page, "admin");
  await page.route("**/api/v1/admin/users", (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: { code: "INTERNAL_ERROR", message: "Service indisponible." },
      },
    }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toHaveText("Service indisponible.");
});

test("un non-admin ne peut pas ouvrir /admin", async ({ page }) => {
  await mockSession(page, "worker");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/worker$/);
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(
    0,
  );
});
