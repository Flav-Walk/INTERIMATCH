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

async function missionIdFromCompany(page: Page, title: string) {
  await page.goto("/company/missions");
  const href = await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    })
    .getAttribute("href");
  const missionId = href?.split("/").at(-1) ?? "";
  expect(missionId).toBeTruthy();
  return missionId;
}

test("un worker postule, l’entreprise accepte et l’état persiste", async ({
  page,
}, testInfo) => {
  test.slow();
  const workerEmail = `application.worker.${testInfo.project.name}@example.test`;
  const companyEmail = `application.company.${testInfo.project.name}@example.test`;

  // Chaque projet possède une mission réservée à ce parcours. Récupérer son
  // identifiant côté propriétaire garde le scénario indépendant des autres tests.
  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);
  const missionId = await missionIdFromCompany(page, "Serveur candidature");
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

  let applicationPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/workers/me/applications")
    ) {
      applicationPosts += 1;
    }
  });
  const applyButton = page.getByRole("button", { name: "Postuler" });
  await applyButton.click();
  const confirmation = page.getByRole("dialog", {
    name: "Confirmer votre candidature ?",
  });
  await expect(confirmation).toBeVisible();
  expect(applicationPosts).toBe(0);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(applyButton).toBeFocused();
  expect(applicationPosts).toBe(0);

  await applyButton.click();
  await confirmation.getByRole("button", { name: "Annuler" }).click();
  await expect(confirmation).toBeHidden();
  await expect(applyButton).toBeFocused();
  expect(applicationPosts).toBe(0);

  await applyButton.click();
  await confirmation
    .getByRole("button", { name: "Confirmer ma candidature" })
    .click();
  await expect.poll(() => applicationPosts).toBe(1);
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

  // --- Le coeur du probleme signale en recette ---
  // L'entreprise arrive sur son accueil. Elle doit y apprendre qu'une
  // candidature l'attend, sans ouvrir la mission et sans recharger la page.
  // Cet emplacement affichait un bloc fige annoncant « aucune candidature ».
  await expect(
    page.getByRole("heading", { name: "Candidatures récentes" }),
  ).toBeVisible();
  const recentes = page.locator(".application-rows");
  await expect(recentes).toContainText("Camille Recette");
  await expect(recentes).toContainText("Serveur candidature");
  await expect(
    page.getByText(/candidature attend votre réponse/),
  ).toBeVisible();

  // Le badge de navigation porte le meme chiffre, double d'un texte lisible
  // par un lecteur d'ecran : une pastille coloree seule n'informe personne.
  const badge = page.locator(".nav-badge");
  await expect(badge).toHaveText(/^1/);
  await expect(badge).toContainText("candidature en attente");

  // L'ecran Candidatures liste de vraies candidatures, pas des suggestions.
  await page.goto("/company/applications");
  await expect(
    page.getByRole("heading", { name: "Candidatures" }),
  ).toBeVisible();
  await expect(page.locator(".application-cards")).toContainText(
    "Camille Recette",
  );
  await page.screenshot({
    path: testInfo.outputPath("company-applications-screen.png"),
    fullPage: true,
  });

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
  // Une décision passe désormais par une confirmation : elle est irréversible,
  // et l'écran le dit avant de l'appliquer.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accepter la candidature" })
    .click();
  await expect(
    applications.getByText("Acceptée", { exact: true }),
  ).toBeVisible();
  await expect(
    applications.getByRole("button", { name: "Accepter" }),
  ).toHaveCount(0);
  // La decision se propage : plus rien n'attend, le badge disparait de la
  // navigation sans que personne ait recharge quoi que ce soit.
  await expect(page.locator(".nav-badge")).toHaveCount(0);

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

  // Le parcours poursuit le workflow documentaire réel, sans interception
  // réseau et avec une doublure locale pour le stockage et l'email uniquement.
  await page.goto("/worker/documents");
  await expect(
    page.getByRole("heading", { name: "Mes documents", exact: true }),
  ).toBeVisible();
  const workerDocument = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Serveur candidature" }),
  });
  await expect(workerDocument).toContainText("À valider");
  await workerDocument.getByRole("link", { name: "Voir" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Valider le document" }).click();
  await expect(page.getByText("En attente de l’entreprise")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("worker-document-signed.png"),
    fullPage: true,
  });
  await logout(page);

  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await page.goto("/company/documents");
  const companyDocument = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Serveur candidature" }),
  });
  await expect(companyDocument).toContainText("À valider");
  await companyDocument.getByRole("link", { name: "Voir" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Valider le document" }).click();
  await expect(page.getByText("Finalisé", { exact: true })).toBeVisible();
  const companyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PDF" }).click();
  expect((await companyDownload).suggestedFilename()).toMatch(/\.pdf$/);
  await page.screenshot({
    path: testInfo.outputPath("company-document-finalized.png"),
    fullPage: true,
  });
  await logout(page);

  await signIn(page, workerEmail);
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/documents");
  const finalizedDocument = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Serveur candidature" }),
  });
  await expect(finalizedDocument).toContainText("Finalisé");
  await finalizedDocument.getByRole("link", { name: "Voir" }).click();
  const workerDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PDF" }).click();
  expect((await workerDownload).suggestedFilename()).toMatch(/\.pdf$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  if (testInfo.project.name === "desktop") {
    const sizes = [1920, 1440, 1280, 1024, 768, 390];
    const workerRoutes = [
      ["/worker", "Tableau de bord"],
      ["/worker/profile", "Mon profil"],
      ["/worker/missions", "Missions"],
      ["/worker/applications", "Mes candidatures"],
      ["/worker/documents", "Mes documents"],
      ["/worker/public-offers", "Offres France Travail"],
    ] as const;
    const assertFits = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
    for (const width of sizes) {
      await page.setViewportSize({ width, height: width <= 768 ? 844 : 1000 });
      await expect(
        page.getByRole("heading", { name: "Serveur candidature", level: 1 }),
      ).toBeVisible();
      await expect(page.getByText("Finalisé", { exact: true })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(
          "responsive-" + width + "-worker-detail.png",
        ),
        fullPage: true,
      });
      expect(await assertFits()).toBe(true);
      await page.goto("/worker/documents");
      await expect(finalizedDocument).toContainText("Finalisé");
      await page.screenshot({
        path: testInfo.outputPath(
          "responsive-" + width + "-worker-list.png",
        ),
        fullPage: true,
      });
      expect(await assertFits()).toBe(true);
      const headerHeights: number[] = [];
      for (const [route, label] of workerRoutes) {
        await page.goto(route);
        await expect(
          page.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
        await expect(page.locator(".app-header__nav-link.is-active")).toHaveCount(
          1,
        );
        headerHeights.push(
          await page.locator(".app-header").evaluate((header) =>
            header.getBoundingClientRect().height,
          ),
        );
        expect(await assertFits()).toBe(true);
      }
      expect(new Set(headerHeights).size).toBe(1);
      await page.goto("/worker/documents");
      await finalizedDocument.getByRole("link", { name: "Voir" }).click();
    }

    await logout(page);
    await signIn(page, companyEmail);
    await expect(page).toHaveURL(/\/company$/);
    for (const width of sizes) {
      await page.setViewportSize({ width, height: width <= 768 ? 844 : 1000 });
      await page.goto("/company/documents");
      const responsiveCompanyDocument = page.getByRole("listitem").filter({
        has: page.getByRole("heading", { name: "Serveur candidature" }),
      });
      await expect(responsiveCompanyDocument).toContainText("Finalisé");
      await page.screenshot({
        path: testInfo.outputPath(
          "responsive-" + width + "-company-list.png",
        ),
        fullPage: true,
      });
      expect(await assertFits()).toBe(true);
      await responsiveCompanyDocument.getByRole("link", { name: "Voir" }).click();
      await expect(
        page.getByRole("heading", { name: "Serveur candidature", level: 1 }),
      ).toBeVisible();
      await expect(page.getByText("Finalisé", { exact: true })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(
          "responsive-" + width + "-company-detail.png",
        ),
        fullPage: true,
      });
      expect(await assertFits()).toBe(true);
    }
  }
});

test("une candidature refusée reste visible et ne redevient pas disponible", async ({
  page,
}, testInfo) => {
  const workerEmail = `application.worker.${testInfo.project.name}@example.test`;
  const companyEmail = `application.company.${testInfo.project.name}@example.test`;
  const title = "Serveur candidature non retenue";

  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);
  const missionId = await missionIdFromCompany(page, title);
  await logout(page);

  await signIn(page, workerEmail);
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/missions");
  await page.locator(`a[href="/worker/missions/${missionId}"]`).click();
  await page.getByRole("button", { name: "Postuler" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer ma candidature" })
    .click();
  await expect(
    page.getByText("Candidature envoyée", { exact: false }),
  ).toBeVisible();
  await logout(page);

  await signIn(page, companyEmail);
  await expect(page).toHaveURL(/\/company$/);
  await page.goto(`/company/missions/${missionId}`);
  await expect(
    page.getByRole("heading", { name: "Talents recommandés" }),
  ).toHaveCount(0);
  const applications = page.getByRole("region", {
    name: "Candidatures reçues",
  });
  await applications.getByRole("button", { name: "Refuser" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Refuser la candidature" })
    .click();
  await expect(
    applications.getByText("Non retenue", { exact: true }),
  ).toBeVisible();
  await logout(page);

  await signIn(page, workerEmail);
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/applications");
  const history = page.locator(".worker-application-list");
  await expect(history).toContainText(title);
  await expect(history.getByText("Non retenue", { exact: true })).toBeVisible();
  await page.reload();
  await expect(history.getByText("Non retenue", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("worker-rejected-application-history.png"),
    fullPage: true,
  });

  await page.goto("/worker/missions");
  await expect(
    page.getByRole("heading", { name: "Missions disponibles", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/worker/missions/${missionId}"]`),
  ).toHaveCount(0);
});
