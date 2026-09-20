import { expect, test, type Page } from "@playwright/test";

/**
 * SL2d — candidature → acceptation → attribution → mission pourvue.
 *
 * Joué contre le vrai backend, sans aucune interception : le serveur d'essai
 * applique les huit migrations dans un PostgreSQL réel (PGlite), déclencheurs
 * de capacité et d'engagement compris. Ce qui est vérifié ici l'est donc par le
 * moteur, pas par une doublure.
 *
 * LE POINT DU SCÉNARIO. Une mission à un poste, deux candidats. Quand la place
 * part, la seconde candidature garde son statut — le serveur ne la refuse pas
 * d'office, l'entreprise n'ayant rien décidé à son sujet — mais elle n'a plus
 * d'issue. Les deux espaces doivent le dire, et se le dire de la même façon :
 * c'est précisément ce qui manquait avant ce lot, où l'intérimaire lisait
 * « en attente » indéfiniment pendant que l'entreprise voyait déjà qu'elle ne
 * pouvait plus le retenir.
 */

const PASSWORD = "Browser-test-password-42!";

async function signIn(page: Page, email: string, space: "company" | "worker") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${space}$`));
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
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getAttribute("href");
  expect(href).toBeTruthy();
  return href!.split("/").at(-1)!;
}

const applications = (page: Page) =>
  page.getByRole("region", { name: "Candidatures reçues" });

const candidate = (page: Page, name: string) =>
  applications(page).locator("li").filter({ hasText: name });

test("la dernière place attribuée ferme le recrutement, des deux côtés", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const project = testInfo.project.name;
  const retenu = project === "desktop" ? "Irène" : "Ilona";
  const attente = project === "desktop" ? "Jonas" : "Jules";
  const titre = `Attribution ${project}`;
  const compte = (role: string) =>
    `attribution.${role}.${project}@example.test`;

  // ---- L'entreprise relève l'identifiant de sa mission ----
  await signIn(page, `attribution.${project}@example.test`, "company");
  const missionId = await missionIdFromCompany(page, titre);
  await logout(page);

  // ---- Les deux intérimaires postulent ----
  for (const role of ["retenu", "attente"]) {
    await signIn(page, compte(role), "worker");
    await page.goto(`/worker/missions/${missionId}`);
    await page.getByRole("button", { name: "Postuler" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmer ma candidature" })
      .click();
    await expect(
      page.getByText(
        "Candidature envoyée. L’entreprise doit maintenant l’examiner.",
      ),
    ).toBeVisible();
    await logout(page);
  }

  // ---- L'entreprise voit deux candidatures et une place ----
  await signIn(page, `attribution.${project}@example.test`, "company");
  await page.goto(`/company/missions/${missionId}`);
  await expect(page.locator(".mission-capacity")).toHaveText(
    "0 poste pourvu sur 1.",
  );
  await expect(candidate(page, retenu)).toContainText("En attente");
  await expect(candidate(page, attente)).toContainText("En attente");
  await page.screenshot({
    path: testInfo.outputPath("01-deux-candidatures-une-place.png"),
    fullPage: true,
  });

  // ---- Elle attribue la place ----
  await candidate(page, retenu)
    .getByRole("button", { name: "Accepter" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accepter la candidature" })
    .click();

  await expect(candidate(page, retenu)).toContainText("Acceptée");
  await expect(page.locator(".mission-capacity")).toHaveText(
    "Tous les postes sont pourvus (1 sur 1).",
  );
  // La mission reste publiée : être pourvue décrit son recrutement, pas son
  // cycle de vie. C'est le badge qui bascule, pas le statut.
  await expect(page.locator(".mission-status")).toHaveText("Pourvue");

  // L'autre candidature n'est ni supprimée ni refusée d'office : elle reste en
  // attente, et l'écran dit seulement qu'elle n'est plus retenable.
  await expect(candidate(page, attente)).toContainText("En attente");
  await expect(
    candidate(page, attente).getByRole("button", { name: "Accepter" }),
  ).toHaveCount(0);
  await expect(candidate(page, attente)).toContainText(
    "ne peut plus être acceptée",
  );
  // Refuser reste possible : c'est la seule action qui reste à l'entreprise.
  await expect(
    candidate(page, attente).getByRole("button", { name: "Refuser" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("02-mission-pourvue-cote-entreprise.png"),
    fullPage: true,
  });

  // ---- Les onglets de la liste retrouvent réellement la mission ----
  //
  // Le statut écrit reste `open` : filtrer dessus laissait « Pourvues » vide
  // alors que la fiche affichait « Pourvue ». Le regroupement vient du serveur.
  await page.goto("/company/missions");
  const onglet = (nom: string) =>
    page.getByRole("button", { name: new RegExp(`^${nom}`) });

  await onglet("Pourvues").click();
  await expect(
    page.getByRole("heading", { name: titre, exact: true }),
  ).toBeVisible();
  await expect(onglet("Pourvues")).toContainText("1");

  // Et elle n'est plus annoncée comme encore à pourvoir.
  await onglet("Publiées").click();
  await expect(
    page.getByRole("heading", { name: titre, exact: true }),
  ).toHaveCount(0);

  // ---- Une mission passée se retrouve dans « Terminées » ----
  await onglet("Terminées").click();
  await expect(
    page.getByRole("heading", {
      name: `Attribution passée ${project}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("03-onglets-pourvues-et-terminees.png"),
    fullPage: true,
  });

  await logout(page);

  // ---- L'intérimaire retenu voit sa mission confirmée ----
  await signIn(page, compte("retenu"), "worker");
  const confirmees = page.getByRole("region", {
    name: "Vos prochaines missions",
  });
  await expect(confirmees).toContainText(titre);
  // Le raccourci global reste dans la navigation ; le répéter dans ce bloc
  // détournait l'attention de son action utile, l'accès à la mission confirmée.
  await expect(
    page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Mes candidatures" }),
  ).toBeVisible();
  await expect(
    confirmees.getByRole("link", { name: "Mes candidatures" }),
  ).toHaveCount(0);
  await expect(
    confirmees.getByRole("link", { name: "Voir la mission" }),
  ).toBeVisible();
  await expect(
    confirmees.locator(".mission-context-status.is-confirmed"),
  ).toHaveCount(1);

  // Régression CSS : une nouvelle page n'a encore chargé ni la fiche mission,
  // ni ApplicationStatus. ConfirmedMissions doit donc posséder sa feuille au
  // premier dashboard, puis garder exactement le même rendu après reload et
  // après un aller-retour vers la mission.
  const directContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize() ?? { width: 1280, height: 800 },
  });
  const direct = await directContext.newPage();
  await signIn(direct, compte("retenu"), "worker");
  const directConfirmed = direct.getByRole("region", {
    name: "Vos prochaines missions",
  });
  await expect(directConfirmed).toContainText(titre);
  await expect(
    directConfirmed.getByRole("link", { name: "Mes candidatures" }),
  ).toHaveCount(0);
  const cssSignature = () =>
    directConfirmed.evaluate((region) => {
      const card = getComputedStyle(region);
      const item = getComputedStyle(region.querySelector("li")!);
      const badge = getComputedStyle(
        region.querySelector(".mission-context-status")!,
      );
      return {
        borderStyle: card.borderStyle,
        borderRadius: card.borderRadius,
        itemDisplay: item.display,
        badgeDisplay: badge.display,
        badgeRadius: badge.borderRadius,
      };
    });
  const directStyle = await cssSignature();
  expect(directStyle.borderStyle).toBe("solid");
  expect(directStyle.badgeDisplay).toBe("flex");
  await direct.screenshot({
    path: testInfo.outputPath("06-dashboard-direct.png"),
    fullPage: true,
  });

  await direct.reload();
  await expect(directConfirmed).toContainText(titre);
  expect(await cssSignature()).toEqual(directStyle);

  await directConfirmed.getByRole("link", { name: "Voir la mission" }).click();
  await expect(direct).toHaveURL(new RegExp(`/worker/missions/${missionId}$`));
  await direct.goBack();
  await expect(direct).toHaveURL(/\/worker$/);
  await expect(directConfirmed).toContainText(titre);
  expect(await cssSignature()).toEqual(directStyle);
  expect(
    await direct.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await directContext.close();

  await page.goto("/worker/applications");
  const sienne = page.getByRole("listitem").filter({ hasText: titre });
  await expect(sienne).toContainText("Mission confirmée");
  await page.screenshot({
    path: testInfo.outputPath("04-mission-confirmee.png"),
    fullPage: true,
  });
  await logout(page);

  // ---- Celui qui n'a pas eu la place comprend pourquoi ----
  await signIn(page, compte("attente"), "worker");
  await page.goto("/worker/applications");
  const manquee = page.getByRole("listitem").filter({ hasText: titre });
  // Avant ce lot, cette ligne disait « Candidature en attente » : rien ne
  // distinguait une attente encore jouable d'une attente sans issue.
  await expect(manquee).toContainText("Tous les postes sont pourvus");
  await expect(manquee).not.toContainText("Candidature en attente");

  // Et sur la fiche de mission, atteinte depuis l'historique.
  await page.goto(`/worker/missions/${missionId}`);
  // REGRESSION. Le badge d'en-tête annonçait « À pourvoir » juste au-dessus de
  // l'encart disant que tous les postes étaient pris : il s'appuyait sur un
  // statut que le serveur n'écrit jamais. Les deux doivent s'accorder.
  await expect(page.locator(".mission-status")).toHaveText("Pourvue");
  await expect(page.locator(".mission-status")).not.toHaveText("À pourvoir");
  await expect(
    page.getByText("Tous les postes de cette mission sont pourvus."),
  ).toBeVisible();
  await expect(page.getByText("reste enregistrée")).toBeVisible();
  // Aucun bouton pour repostuler : l'action n'a plus de sens.
  await expect(page.getByRole("button", { name: "Postuler" })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("05-postes-pourvus-cote-worker.png"),
    fullPage: true,
  });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
