import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Browser-test-password-42!";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
}

async function completeTour(page: Page) {
  const tour = page.getByRole("dialog");
  if (!(await tour.isVisible())) return;
  for (;;) {
    const next = tour.getByRole("button", { name: "Suivant" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await tour.getByRole("button", { name: "Terminer" }).click();
  await expect(tour).toBeHidden();
}

async function logout(page: Page) {
  await page.locator('summary[aria-label="Mon compte"]').click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("un worker postule, l’entreprise accepte et l’état persiste", async ({
  page,
}, testInfo) => {
  const workerEmail = `application.worker.${testInfo.project.name}@example.test`;
  const companyEmail = `application.company.${testInfo.project.name}@example.test`;

  // Chaque projet possède une mission réservée à ce parcours. Récupérer son
  // identifiant côté propriétaire garde le scénario indépendant des autres tests.
  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);
  await page.goto("/company/missions");
  const companyMission = page
    .getByRole("link")
    .filter({ hasText: "Serveur candidature" });
  const companyHref = await companyMission.getAttribute("href");
  const missionId = companyHref?.split("/").at(-1) ?? "";
  expect(missionId).toBeTruthy();
  await logout(page);

  await signIn(page, workerEmail);
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/missions");
  await page.locator(`a[href="/worker/missions/${missionId}"]`).click();
  await expect(
    page.getByRole("heading", {
      name: "Serveur candidature",
      level: 1,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Postuler" }).click();
  await expect(
    page.getByText("Candidature envoyée", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Postuler" })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("worker-application-sent.png"),
    fullPage: true,
  });

  await page.reload();
  await expect(
    page.getByText("Candidature envoyée", { exact: false }),
  ).toBeVisible();

  await logout(page);
  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);
  await page.goto(`/company/missions/${missionId}`);

  const applications = page.getByRole("region", {
    name: "Candidatures reçues",
  });
  await expect(applications).toBeVisible();
  await expect(applications.getByText("Camille Recette")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("company-application-received.png"),
    fullPage: true,
  });
  await applications.getByRole("button", { name: "Accepter" }).click();
  await expect(
    applications.getByText("Acceptée", { exact: true }),
  ).toBeVisible();
  await expect(
    applications.getByRole("button", { name: "Accepter" }),
  ).toHaveCount(0);

  await logout(page);
  await signIn(page, workerEmail);
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/applications");
  await expect(
    page.getByRole("heading", { name: "Mes candidatures" }),
  ).toBeVisible();
  await expect(page.getByText("Serveur candidature")).toBeVisible();
  await expect(page.getByText("Acceptée", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("worker-application-accepted.png"),
    fullPage: true,
  });
});
