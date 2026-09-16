import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Browser-test-password-42!";
/**
 * Adresse entreprise de la fixture navigateur, une par projet Playwright pour que
 * desktop et mobile ne se disputent pas le même compte. L'adresse de production,
 * neotravel257@gmail.com, est livrée par la migration 002 et vérifiée côté backend.
 */
const companyEmail = (project: string) => `company.${project}@example.test`;

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
}

const tour = (page: Page) => page.getByRole("dialog");

async function completeTour(page: Page) {
  await expect(tour(page)).toBeVisible();
  for (;;) {
    const next = tour(page).getByRole("button", { name: "Suivant" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await tour(page).getByRole("button", { name: "Terminer" }).click();
  await expect(tour(page)).toBeHidden();
}

// CAS 1 — accès anonyme à une route protégée.
test("anonymous access to a protected route redirects to sign-in", async ({
  page,
}) => {
  for (const path of ["/worker", "/company", "/worker/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(
    page.getByRole("heading", { name: "Me connecter" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("unknown@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});

// CAS 2, 3 et 4 — intérimaire par défaut, visite guidée, persistance, cloisonnement.
test("a new account becomes an intérimaire, is toured once, and cannot reach the company space", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `worker.${crypto.randomUUID()}@example.test`;

  await register(page, email);
  // CAS 2 : aucune sélection de rôle, arrivée directe dans l'espace intérimaire.
  await expect(page).toHaveURL(/\/worker$/);
  await expect(page.getByRole("heading", { name: "Bienvenue," })).toBeVisible();

  const dialog = tour(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Bienvenue sur InteriMatch");
  await expect(dialog).toContainText("Étape 1 sur");
  // Le spotlight suit une zone réelle de l'interface dès la deuxième étape.
  await dialog.getByRole("button", { name: "Suivant" }).click();
  await expect(dialog).toContainText("Étape 2 sur");
  await expect(page.locator(".tour-ring")).toBeVisible();
  await dialog.getByRole("button", { name: "Précédent" }).click();
  await expect(dialog).toContainText("Étape 1 sur");
  await page.screenshot({
    path: testInfo.outputPath("tour-worker.png"),
    fullPage: true,
  });
  await completeTour(page);

  // CAS 3 : la visite ne se relance pas après rechargement ni après reconnexion.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bienvenue," })).toBeVisible();
  await expect(tour(page)).toBeHidden();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/worker$/);
  await expect(tour(page)).toBeHidden();

  // La visite reste rejouable à la demande.
  await page.getByRole("button", { name: "Revoir la visite" }).click();
  await expect(tour(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour(page)).toBeHidden();

  // CAS 4 : l'URL de l'espace entreprise ne donne pas accès à l'espace entreprise.
  for (const path of ["/company", "/company/candidates", "/entreprise"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/worker$/);
  }
  await expect(
    page.getByRole("link", { name: "Candidats", exact: true }),
  ).toHaveCount(0);

  // Le profil se complète depuis l'espace, il n'en bloque jamais l'accès.
  await page.getByRole("link", { name: "Mon profil", exact: true }).click();
  await expect(page).toHaveURL(/\/worker\/profile$/);
  await page.getByLabel("Prénom", { exact: true }).fill("Jimmy");
  await page.getByLabel("Nom", { exact: true }).fill("Démonstration");
  await page.getByLabel("Métier principal").fill("Serveur");
  await page.getByLabel("Service en salle", { exact: true }).check();
  await page.getByLabel("Rayon de mobilité").fill("15");
  await page.getByLabel("Début de disponibilité").fill("2027-01-02T12:00");
  await page.getByLabel("Fin de disponibilité").fill("2027-01-02T20:00");
  await page.getByLabel("Ville", { exact: true }).fill("Lyon");
  await page.getByLabel("Code postal").fill("69002");
  await page.getByLabel("Latitude", { exact: true }).fill("45.75");
  await page.getByLabel("Longitude", { exact: true }).fill("4.85");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/worker$/);
  await expect(
    page.getByRole("heading", { name: "Bonjour Jimmy," }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

// CAS 5 et 6 — le compte autorisé reçoit l'espace et la visite entreprise.
test("the allowlisted address gets the company space and its own tour", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = companyEmail(testInfo.project.name);

  await register(page, email);
  // CAS 5 : rôle entreprise décidé par le serveur, sans aucun choix utilisateur.
  await expect(page).toHaveURL(/\/company$/);
  await expect(
    page.getByRole("link", { name: "Candidats", exact: true }),
  ).toBeVisible();

  const dialog = tour(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("espace entreprise");
  await page.screenshot({
    path: testInfo.outputPath("tour-company.png"),
    fullPage: true,
  });
  await completeTour(page);

  // CAS 6 : pas de relance après reconnexion.
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/company$/);
  await expect(tour(page)).toBeHidden();

  // L'espace entreprise est bien distinct, et l'espace intérimaire lui est fermé.
  await page.getByRole("link", { name: "Candidats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Candidats compatibles" }),
  ).toBeVisible();
  await page.goto("/worker");
  await expect(page).toHaveURL(/\/company$/);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

// CAS 7 — session invalide.
test("an invalidated session degrades cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `expired.${crypto.randomUUID()}@example.test`;
  await register(page, email);
  await expect(page).toHaveURL(/\/worker$/);
  await completeTour(page);

  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Me connecter" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Google callback errors and keyboard access", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied");
  await expect(page.getByRole("alert")).toContainText("annulée");
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Me connecter" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
});
