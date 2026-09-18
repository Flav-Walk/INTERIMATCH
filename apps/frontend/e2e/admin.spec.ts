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

/**
 * Session simulée de l'espace administration.
 *
 * `hold` retient la réponse de `GET /admin/users` et rend la main sur une
 * fonction qui la libère.
 *
 * POURQUOI. Le test du chargement affirme qu'un indicateur transitoire est
 * visible. Cet indicateur n'existe qu'entre le montage de la page et l'arrivée
 * de la réponse : l'affirmer, c'est courir après une fenêtre. La fenêtre était
 * ouverte par un `setTimeout` de 150 ms dans la doublure — une marge, pas une
 * garantie. Sous la charge des deux navigateurs concurrents, ces 150 ms
 * pouvaient s'écouler avant la première interrogation de Playwright : la
 * réponse était déjà là, l'indicateur déjà remplacé, et le test échouait sans
 * qu'aucun défaut applicatif ne soit en cause.
 *
 * Le test décide désormais lui-même du moment où la réponse arrive. La fenêtre
 * ne peut plus se refermer trop tôt, puisque rien ne la referme avant lui.
 * L'assertion est conservée entière — elle est simplement devenue vérifiable :
 * elle passait auparavant par chance, elle passe maintenant par construction.
 */
async function mockSession(
  page: Page,
  role: "admin" | "worker",
  options: { hold?: boolean } = {},
) {
  let release = () => {};
  const held = options.hold
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
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
      await held;
      return route.fulfill({ json: [admin, worker] });
    }
    if (path.endsWith(`/admin/users/${worker.id}/role`))
      return route.fulfill({ json: { ...worker, role: "company" } });
    if (path === "/workers/me/missions")
      return route.fulfill({ json: { missions: [] } });
    return route.fulfill({ json: [] });
  });
  return release;
}

test("un admin consulte les utilisateurs et modifie un rôle", async ({
  page,
}) => {
  const servirLesUtilisateurs = await mockSession(page, "admin", {
    hold: true,
  });
  await page.goto("/admin");
  // La liste n'est pas encore servie : l'indicateur est donc nécessairement là.
  await expect(
    page.getByRole("status", { name: "Chargement des utilisateurs" }),
  ).toBeVisible();
  servirLesUtilisateurs();
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
