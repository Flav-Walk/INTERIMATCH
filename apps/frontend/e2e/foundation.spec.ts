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

/** Un fieldset est exposé comme un groupe nommé par sa légende. */
const section = (page: Page, name: string) => page.getByRole("group", { name });

async function save(page: Page, name: string) {
  await section(page, name)
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(section(page, name).getByText("Enregistré.")).toBeVisible();
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

  // L'utilisateur ne saisit jamais de coordonnées : elles sont dérivées côté serveur.
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveCount(0);

  // Section par section : chaque bloc s'enregistre seul.
  await section(page, "Votre identité")
    .getByLabel("Prénom", { exact: true })
    .fill("Jimmy");
  await section(page, "Votre identité")
    .getByLabel("Nom", { exact: true })
    .fill("Démonstration");
  await save(page, "Votre identité");

  // Sauvegarde partielle : on quitte, on revient, la donnée est toujours là.
  await page.reload();
  await expect(
    section(page, "Votre identité").getByLabel("Prénom", { exact: true }),
  ).toHaveValue("Jimmy");
  await expect(page.getByText("Votre métier principal")).toBeVisible();

  await section(page, "Votre métier")
    .getByLabel("Métier principal")
    .selectOption("serveur");
  await save(page, "Votre métier");

  await section(page, "Vos compétences")
    .getByLabel("Service en salle", { exact: true })
    .check();
  await save(page, "Vos compétences");

  await section(page, "Votre mobilité")
    .getByLabel("Ville", { exact: true })
    .fill("Lyon");
  await section(page, "Votre mobilité").getByLabel("Code postal").fill("69002");
  await section(page, "Votre mobilité")
    .getByLabel("Rayon de mobilité (km)")
    .fill("15");
  await save(page, "Votre mobilité");

  const slots = section(page, "Vos disponibilités");
  await slots.getByLabel("Début").fill("2027-01-02T12:00");
  await slots.getByLabel("Fin").fill("2027-01-02T20:00");
  await slots.getByRole("button", { name: "Ajouter ce créneau" }).click();
  await expect(slots.getByRole("listitem")).toHaveCount(1);

  // Le serveur a constaté que tout le nécessaire est présent.
  await expect(page.getByText("Votre profil est complet.")).toBeVisible();

  // Le tableau de bord reflète les vraies données.
  await page.getByRole("link", { name: "Tableau de bord" }).click();
  await expect(
    page.getByRole("heading", { name: "Bonjour Jimmy," }),
  ).toBeVisible();
  await expect(page.getByText("Profil complété")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lyon" })).toBeVisible();
  await expect(page.getByText(/jusqu’à 15 km/)).toBeVisible();
  await expect(page.getByText(/1 créneau à venir/)).toBeVisible();

  // Déconnexion puis reconnexion : les données sont toujours là.
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/worker$/);
  await expect(
    page.getByRole("heading", { name: "Bonjour Jimmy," }),
  ).toBeVisible();
  await expect(page.getByText(/jusqu’à 15 km/)).toBeVisible();

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

test("profile lists persist, reject incomplete rows, and allow slot editing", async ({
  page,
}, testInfo) => {
  await register(page, `acceptance.${crypto.randomUUID()}@example.test`);
  await completeTour(page);
  await page.getByRole("link", { name: "Mon profil", exact: true }).click();
  const jobs = section(page, "Votre métier");
  await jobs.getByLabel("Métier principal").selectOption("barman");
  await jobs
    .getByRole("checkbox", { name: "Chef de rang", exact: true })
    .check();
  await jobs
    .getByLabel("Années d’expérience du métier (facultatif)")
    .fill("3.5");
  await save(page, "Votre métier");
  // Reproduction live : distinguer la valeur persistée de celle du select.
  const restoredProfile = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/me" &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await page.reload();
  const restored = await (await restoredProfile).json();
  expect(restored.profile.main_job).toBe("barman");
  expect(restored.missing_requirements).not.toContain("main_job");
  expect(restored.onboarding_completed).toBe(false);
  await expect(jobs.getByLabel("Métier principal")).toHaveValue("barman");
  const identity = section(page, "Votre identité");
  await identity.getByLabel("Prénom", { exact: true }).fill("Camille");
  await identity.getByLabel("Nom", { exact: true }).fill("Recette");
  await identity.getByLabel("Téléphone (facultatif)").fill("+33600000000");
  await save(page, "Votre identité");
  const mobility = section(page, "Votre mobilité");
  await mobility.getByLabel("Ville", { exact: true }).fill("Lyon");
  await mobility.getByLabel("Code postal").fill("69002");
  await mobility.getByLabel("Rayon de mobilité (km)").fill("25");
  await mobility.getByLabel("J’ai le permis").check();
  await mobility.getByLabel("J’ai un véhicule").check();
  await save(page, "Votre mobilité");
  const skills = section(page, "Vos compétences").getByRole("checkbox");
  await skills.nth(0).check();
  await skills.nth(1).check();
  await save(page, "Vos compétences");
  await section(page, "Votre recherche").getByRole("checkbox").uncheck();
  await save(page, "Votre recherche");
  await page.reload();
  await expect(jobs.getByLabel("Métier principal")).toHaveValue("barman");
  await expect(
    jobs.getByRole("checkbox", { name: "Chef de rang", exact: true }),
  ).toBeChecked();
  await expect(
    jobs.getByLabel("Années d’expérience du métier (facultatif)"),
  ).toHaveValue("3.5");
  await expect(identity.getByLabel("Téléphone (facultatif)")).toHaveValue(
    "+33600000000",
  );
  await expect(mobility.getByLabel("J’ai le permis")).toBeChecked();
  await expect(mobility.getByLabel("J’ai un véhicule")).toBeChecked();
  await expect(mobility.getByLabel("Rayon de mobilité (km)")).toHaveValue("25");
  await expect(skills.nth(0)).toBeChecked();
  await expect(skills.nth(1)).toBeChecked();
  await expect(
    section(page, "Votre recherche").getByRole("checkbox"),
  ).not.toBeChecked();

  const experiences = section(page, "Vos expériences");
  for (const [title, employer] of [
    ["Service", "Brasserie"],
    ["Bar", "Hôtel"],
  ]) {
    await experiences
      .getByRole("button", { name: "Ajouter une expérience" })
      .click();
    await experiences.getByLabel("Poste", { exact: true }).last().fill(title);
    await experiences
      .getByLabel("Établissement", { exact: true })
      .last()
      .fill(employer);
  }
  await save(page, "Vos expériences");
  const certs = section(page, "Vos diplômes et certifications");
  for (const name of ["HACCP", "Secourisme"]) {
    await certs
      .getByRole("button", { name: "Ajouter une certification" })
      .click();
    await certs.getByLabel("Intitulé").last().fill(name);
    await certs.getByLabel("Obtenu le").last().fill("2025-06-01");
  }
  await save(page, "Vos diplômes et certifications");
  await page.reload();
  await expect(experiences.getByLabel("Poste", { exact: true })).toHaveCount(2);
  await expect(certs.getByLabel("Intitulé")).toHaveCount(2);
  await expect(certs.getByLabel("Obtenu le").first()).toHaveValue("2025-06-01");
  await experiences
    .getByLabel("Établissement", { exact: true })
    .first()
    .fill("");
  await experiences.getByRole("button", { name: "Enregistrer" }).click();
  await expect(experiences.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(experiences.getByLabel("Poste", { exact: true })).toHaveCount(2);
  await certs.getByLabel("Intitulé").first().fill("");
  await certs.getByRole("button", { name: "Enregistrer" }).click();
  await expect(certs.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(certs.getByLabel("Intitulé")).toHaveCount(2);

  const availability = section(page, "Vos disponibilités");
  await availability
    .getByLabel("Début", { exact: true })
    .fill("2027-08-10T10:00");
  await availability
    .getByLabel("Fin", { exact: true })
    .fill("2027-08-10T18:00");
  await availability
    .getByLabel("Statut", { exact: true })
    .selectOption("unavailable");
  await availability
    .getByRole("button", { name: "Ajouter ce créneau" })
    .click();
  await expect(availability.locator("li")).toHaveCount(1);
  await page.reload();
  await expect(availability.locator("li")).toContainText("Indisponible");
  await availability
    .getByRole("button", { name: /Modifier le créneau/ })
    .click();
  await expect(availability.getByLabel("Début", { exact: true })).toHaveValue(
    "2027-08-10T10:00",
  );
  await availability
    .getByLabel("Fin", { exact: true })
    .fill("2027-08-11T01:00");
  await availability
    .getByLabel("Statut", { exact: true })
    .selectOption("available");
  await availability
    .getByRole("button", { name: "Enregistrer le créneau" })
    .click();
  await page.reload();
  await expect(availability.locator("li")).toContainText("Disponible");
  await expect(availability.locator("li")).toContainText("11");
  await expect(page.getByText("Votre profil est complet.")).toBeVisible();
  await availability
    .getByLabel("Début", { exact: true })
    .fill("2027-08-10T12:00");
  await availability
    .getByLabel("Fin", { exact: true })
    .fill("2027-08-10T14:00");
  await availability
    .getByRole("button", { name: "Ajouter ce créneau" })
    .click();
  await expect(availability.getByRole("alert")).toContainText("chevauche");
  await expect(availability.locator("li")).toHaveCount(1);
  await availability.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("profile-availability.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await availability
    .getByRole("button", { name: /Retirer le créneau/ })
    .click();
  await expect(availability.locator("li")).toHaveCount(0);
  await page.reload();
  await expect(availability.locator("li")).toHaveCount(0);
  await expect(
    page.getByText("Au moins une disponibilité à venir", { exact: true }),
  ).toBeVisible();
  await experiences
    .getByRole("button", { name: "Retirer l’expérience 1", exact: true })
    .click();
  await save(page, "Vos expériences");
  await certs
    .getByRole("button", { name: "Retirer la certification 1", exact: true })
    .click();
  await save(page, "Vos diplômes et certifications");
  await page.reload();
  await expect(experiences.getByLabel("Poste", { exact: true })).toHaveCount(1);
  await expect(certs.getByLabel("Intitulé")).toHaveCount(1);
});
