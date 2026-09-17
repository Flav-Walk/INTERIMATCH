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

/** Le bloc compte de la maquette est un menu dépliant. */
async function openAccount(page: Page) {
  await page.locator('summary[aria-label="Mon compte"]').click();
}

/**
 * Rend un intérimaire rapprochable : métier, zone, et une disponibilité qui
 * couvre le créneau visé. Depuis le SL3a une mission n'est plus visible parce
 * qu'elle est publiée, mais parce qu'elle correspond — un compte sans profil
 * ne reçoit donc rien, et c'est le comportement attendu.
 */
async function makeEmployable(
  page: Page,
  {
    job,
    from,
    to,
    skills = [],
  }: { job: string; from: string; to: string; skills?: string[] },
) {
  await page.goto("/worker/profile");
  const metier = section(page, "Votre métier");
  await metier.getByLabel("Métier principal").selectOption(job);
  await save(page, "Votre métier");

  if (skills.length) {
    const competences = section(page, "Vos compétences");
    for (const name of skills)
      await competences.getByRole("checkbox", { name }).check();
    await save(page, "Vos compétences");
  }

  const mobilite = section(page, "Votre mobilité");
  await mobilite.getByLabel("Ville").fill("Lyon");
  await mobilite.getByLabel("Code postal").fill("69002");
  await mobilite.getByLabel(/Rayon de mobilité/).fill("50");
  await save(page, "Votre mobilité");

  const dispos = section(page, "Vos disponibilités");
  await dispos.getByLabel("Début").fill(from);
  await dispos.getByLabel("Fin").fill(to);
  await dispos.getByRole("button", { name: /Ajouter ce créneau/ }).click();
  await dispos.getByText("Créneau ajouté.").waitFor();
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
  await openAccount(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/worker$/);
  await expect(tour(page)).toBeHidden();

  // La visite reste rejouable à la demande.
  await openAccount(page);
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
  await openAccount(page);
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
  await openAccount(page);
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

// SL1 — espace entreprise : composition de la maquette sur des données réelles.
test("the company workspace lists real missions with the maquette layout", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, `missions.${testInfo.project.name}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  // En-tête de la maquette : navigation, recherche et bloc compte.
  const header = page.getByRole("banner");
  for (const label of ["Accueil", "Missions", "Candidats", "Entreprise"])
    await expect(
      header.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  await expect(header.getByRole("searchbox")).toBeVisible();
  await expect(header.locator(".avatar")).toBeVisible();

  // Carte héros et son appel à l'action.
  await expect(
    page.getByRole("heading", { name: /Prêt à renforcer votre équipe/ }),
  ).toBeVisible();

  // Les missions publiées par la fixture sont réellement affichées.
  const openTab = page.getByRole("button", { name: /^À pourvoir/ });
  await expect(openTab).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".mission-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Serveur en restauration" }),
  ).toBeVisible();

  // Le filtre Brouillons change réellement la liste.
  await page.getByRole("button", { name: /^Brouillons/ }).click();
  await expect(page.locator(".mission-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Commis de cuisine brunch" }),
  ).toBeVisible();

  // Planning : le rail droit affiche l'agenda réel.
  await expect(
    page.getByRole("heading", { name: "Votre planning" }),
  ).toBeVisible();
  await expect(page.locator(".agenda-item").first()).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("company-dashboard.png"),
    fullPage: true,
  });

  // Liste complète et recherche depuis l'en-tête.
  await header.getByRole("link", { name: "Missions", exact: true }).click();
  await expect(page).toHaveURL(/\/company\/missions$/);
  await expect(page.locator(".mission-card")).toHaveCount(3);
  await header.getByRole("searchbox").fill("villeurbanne");
  await header.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/q=villeurbanne/);
  await expect(page.locator(".mission-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await expect(page.locator(".mission-card")).toHaveCount(3);

  // Détail d'une mission, en lecture seule à ce stade.
  await page.locator(".mission-card").first().click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Le détail reprend les informations de la mission, pas seulement son titre.
  await expect(page.locator(".detail-grid")).toContainText("poste");
  await expect(page.getByRole("link", { name: "Vos missions" })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

// Régression signalée en recette : « Please select an item in the list ».
test("secondary jobs and licence save without the main job blocking the form", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page, `jobs.${crypto.randomUUID()}@example.test`);
  await expect(page).toHaveURL(/\/worker$/);
  await completeTour(page);
  await page.goto("/worker/profile");

  // Profil neuf : aucun métier principal choisi. Cocher un métier secondaire
  // seul doit s'enregistrer, sans blocage de la validation native du navigateur.
  const job = section(page, "Votre métier");
  await job.getByLabel("Barman / Barmaid", { exact: true }).check();
  await save(page, "Votre métier");
  expect(
    await page.evaluate(() => {
      const s = document.querySelector<HTMLSelectElement>(
        'select[name="main_job"]',
      );
      return { valid: s?.checkValidity(), required: s?.required };
    }),
  ).toEqual({ valid: true, required: false });

  // La règle métier ne bouge pas : sans métier principal le profil est incomplet.
  await expect(
    page.getByText("Votre métier principal", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    section(page, "Votre métier").getByLabel("Barman / Barmaid", {
      exact: true,
    }),
  ).toBeChecked();

  // Métier principal enregistré, puis modification des seuls secondaires :
  // la valeur déjà enregistrée doit rester intacte.
  await section(page, "Votre métier")
    .getByLabel("Métier principal")
    .selectOption("serveur");
  await save(page, "Votre métier");
  await page.reload();
  await section(page, "Votre métier")
    .getByLabel("Chef de rang", { exact: true })
    .check();
  await save(page, "Votre métier");
  await page.reload();
  await expect(
    section(page, "Votre métier").getByLabel("Métier principal"),
  ).toHaveValue("serveur");
  await expect(
    section(page, "Votre métier").getByLabel("Chef de rang", { exact: true }),
  ).toBeChecked();

  // Mobilité : les choix permis/véhicule sont exclusifs et cohérents.
  const mobility = section(page, "Votre mobilité");
  const vehicle = mobility.getByLabel("J’ai un véhicule");
  await expect(vehicle).toBeDisabled();
  await mobility.getByLabel("J’ai le permis").check();
  await expect(vehicle).toBeEnabled();
  await vehicle.check();
  // Repasser sans permis retire le véhicule au lieu de laisser deux réponses
  // contradictoires que le serveur refuserait.
  await mobility.getByLabel("Je n’ai pas le permis").check();
  await expect(vehicle).not.toBeChecked();
  await expect(vehicle).toBeDisabled();

  // Enregistrer le seul permis, sans ville ni code postal, doit fonctionner.
  await mobility.getByLabel("J’ai le permis").check();
  await vehicle.check();
  await save(page, "Votre mobilité");
  await page.reload();
  const mobility2 = section(page, "Votre mobilité");
  await expect(mobility2.getByLabel("J’ai le permis")).toBeChecked();
  await expect(mobility2.getByLabel("J’ai un véhicule")).toBeChecked();
  await expect(
    page.getByText("Votre ville et votre code postal", { exact: true }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

// SL2b — parcours complet : créer un brouillon, le modifier, puis le publier.
test("a company drafts, edits and publishes a mission", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page, `crud.${testInfo.project.name}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  await page.goto("/company/missions");
  await expect(page.locator(".mission-card")).toHaveCount(0);

  // ---- Création -----------------------------------------------------------
  await page.getByRole("link", { name: "Créer une mission" }).first().click();
  await expect(page).toHaveURL(/\/company\/missions\/new$/);
  await expect(
    page.getByRole("heading", { name: "Créer une mission" }),
  ).toBeVisible();

  // Les sections de la maquette structurent la saisie.
  for (const legend of [
    "Informations générales",
    "Date et horaires",
    "Lieu",
    "Profil recherché",
    "Compétences",
    "Rémunération",
  ])
    await expect(page.getByRole("group", { name: legend })).toBeVisible();

  // Aucun champ décidé par le serveur n'est proposé à la saisie.
  for (const forbidden of [
    "company_id",
    "status",
    "latitude",
    "longitude",
    "geocoded_at",
    "published_at",
  ])
    await expect(page.locator(`[name="${forbidden}"]`)).toHaveCount(0);

  // Un envoi incomplet est retenu côté navigateur, avec un message par champ.
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(
    page.getByText("Donnez un intitulé à la mission."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/company\/missions\/new$/);

  // Dates fixes : le parcours ne dépend pas de l'heure d'exécution.
  await page.getByLabel("Intitulé de la mission").fill("Chef de rang — gala");
  await page.getByLabel("Métier recherché").selectOption("serveur");
  await page.getByLabel("Début").fill("2027-06-12T18:00");
  await page.getByLabel("Fin").fill("2027-06-13T02:00");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel("Code postal").fill("69002");
  await page.getByLabel("Nombre de personnes").fill("3");

  // Un montant sans unité est refusé, et le message le dit.
  await page.getByLabel("Montant en euros").fill("15");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(
    page.getByText(/Précisez si ce montant est horaire/),
  ).toBeVisible();
  await page.getByLabel("Unité").selectOption("hour");
  // Le reproche portait sur deux champs : corriger l'unité doit l'effacer,
  // sans attendre un nouvel envoi qui contredirait ce qu'on vient de choisir.
  await expect(
    page.getByText(/Précisez si ce montant est horaire/),
  ).toHaveCount(0);

  // Une compétence ne peut porter qu'un seul niveau : choisir « souhaitée »
  // après « obligatoire » remplace le choix au lieu de s'y ajouter.
  const serviceRequired = page.getByRole("radio", {
    name: "Service en salle : obligatoire",
  });
  await serviceRequired.check();
  await page
    .getByRole("radio", { name: "Relation client : souhaitée" })
    .check();
  await expect(serviceRequired).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "Service en salle : souhaitée" }),
  ).not.toBeChecked();

  await page.screenshot({
    path: testInfo.outputPath("mission-form.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();

  // ---- Le brouillon existe, sans avoir été publié -------------------------
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/enregistrée en brouillon/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chef de rang — gala" }),
  ).toBeVisible();
  await expect(page.locator(".mission-status")).toHaveText("Brouillon");
  const missionUrl = page.url();

  // Il apparaît immédiatement dans le filtre Brouillons.
  await page.goto("/company/missions");
  await page.getByRole("button", { name: /^Brouillons/ }).click();
  await expect(page.locator(".mission-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Chef de rang — gala" }),
  ).toBeVisible();

  // ---- Modification -------------------------------------------------------
  await page.goto(missionUrl);
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  // Le formulaire est prérempli avec ce qui a été enregistré.
  await expect(page.getByLabel("Intitulé de la mission")).toHaveValue(
    "Chef de rang — gala",
  );
  await expect(page.getByLabel("Ville")).toHaveValue("Lyon");
  await expect(page.getByLabel("Début")).toHaveValue("2027-06-12T18:00");
  await expect(
    page.getByRole("radio", { name: "Service en salle : obligatoire" }),
  ).toBeChecked();

  await page.getByLabel("Nombre de personnes").fill("5");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  await expect(page.locator(".detail-grid")).toContainText("5 postes");
  // Enregistrer ne publie pas.
  await expect(page.locator(".mission-status")).toHaveText("Brouillon");

  // ---- Publication, distincte de l'enregistrement --------------------------
  await page.getByRole("button", { name: "Publier la mission" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Publier cette mission ?");

  // On peut renoncer : la mission reste un brouillon.
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".mission-status")).toHaveText("Brouillon");

  await page.getByRole("button", { name: "Publier la mission" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publier" })
    .click();

  // L'interface reflète immédiatement l'état établi par le serveur.
  await expect(page.locator(".mission-status")).toHaveText("À pourvoir");
  // Ciblé sur la bannière : la boîte de confirmation emploie les mêmes mots.
  await expect(page.locator(".form-success")).toContainText("Mission publiée.");
  // L'action qui n'a plus lieu d'être disparaît.
  await expect(
    page.getByRole("button", { name: "Publier la mission" }),
  ).toHaveCount(0);

  // Les compteurs de la liste suivent.
  await page.goto("/company/missions");
  await expect(page.getByRole("button", { name: /^Brouillons/ })).toContainText(
    "0",
  );
  await expect(page.getByRole("button", { name: /^À pourvoir/ })).toContainText(
    "1",
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

// Recette — mot de passe : affichage, masquage, force.
test("password visibility and strength guide the sign-up", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");

  const field = page.getByLabel("Mot de passe", { exact: true });
  const confirmField = page.getByLabel("Confirmer le mot de passe");
  const reveal = page.getByRole("button", { name: "Afficher le mot de passe" });

  // Masqué par défaut, des deux côtés.
  await expect(field).toHaveAttribute("type", "password");
  await expect(confirmField).toHaveAttribute("type", "password");
  await expect(reveal).toHaveAttribute("aria-pressed", "false");

  // L'exigence du serveur est annoncée avant toute saisie.
  await expect(page.getByText("12 caractères au minimum.")).toBeVisible();

  // Un mot de passe trop court reste bas, même varié : l'indicateur ne doit
  // pas laisser croire qu'il passera.
  await field.fill("Aa1!Aa1!");
  await expect(page.getByText(/Encore 4 caractères/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Force du mot de passe/ }),
  ).toHaveAttribute("aria-label", /Très faible|Faible/);

  // La barre progresse pendant la saisie, une fois l'exigence remplie.
  await field.fill("Mercredi-Bleu-92!x");
  await expect(page.getByText("Longueur suffisante.")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Force du mot de passe : Solide" }),
  ).toBeVisible();

  // La bascule révèle la valeur sans la modifier ni soumettre le formulaire.
  await reveal.click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue("Mercredi-Bleu-92!x");
  await expect(page).toHaveURL(/\/register$/);
  const hide = page.getByRole("button", { name: "Masquer le mot de passe" });
  await expect(hide).toHaveAttribute("aria-pressed", "true");

  // Utilisable au clavier.
  await hide.press("Enter");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveValue("Mercredi-Bleu-92!x");

  // La confirmation a sa propre bascule, indépendante.
  await confirmField.fill("Mercredi-Bleu-92!x");
  await page
    .getByRole("button", { name: "Afficher la confirmation du mot de passe" })
    .click();
  await expect(confirmField).toHaveAttribute("type", "text");
  await expect(field).toHaveAttribute("type", "password");

  // L'inscription fonctionne toujours.
  const email = `pw.${testInfo.project.name}.${Date.now()}@example.test`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect(page).toHaveURL(/\/worker$/);
  await completeTour(page);

  // Et la connexion aussi, avec la même bascule.
  await openAccount(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Mercredi-Bleu-92!x");
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue(
    "Mercredi-Bleu-92!x",
  );
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/worker$/);
  expect(errors).toEqual([]);
});

// Recette — établissement : une adresse, jamais des coordonnées.
test("the establishment is located from its address alone", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page, `place.${testInfo.project.name}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  await page.getByRole("link", { name: "Entreprise", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Présentons votre établissement/ }),
  ).toBeVisible();

  // Aucune donnée technique n'est demandée à l'utilisateur.
  for (const technique of ["Latitude", "Longitude"])
    await expect(page.getByLabel(technique, { exact: true })).toHaveCount(0);
  for (const champ of ["latitude", "longitude", "geocoded_at"])
    await expect(page.locator(`[name="${champ}"]`)).toHaveCount(0);

  await page.getByLabel("Prénom", { exact: true }).fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Durand");
  await page.getByLabel("Raison sociale").fill("Brasserie du Quai SARL");
  await page.getByLabel("Nom de l’établissement").fill("Brasserie du Quai");
  await page.getByLabel("Adresse", { exact: true }).fill("12 quai Rambaud");
  await page.getByLabel("Téléphone", { exact: true }).fill("+33400000000");
  await page.getByLabel("Ville", { exact: true }).fill("Lyon");
  await page.getByLabel("Code postal", { exact: true }).fill("69002");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // L'onboarding terminé renvoie vers l'espace entreprise.
  await expect(page).toHaveURL(/\/company$/);
  // L'établissement est persisté : la maquette le reprend dans son bandeau.
  await expect(page.locator(".hero-badge")).toHaveText("Brasserie du Quai");
  await expect(
    page.getByRole("link", { name: "Créer une mission" }).first(),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

// Recette — le tableau de bord suit les écritures sans rechargement.
test("the company dashboard reflects mission changes without reloading", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page, `fresh.${testInfo.project.name}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  const draftsTab = page.getByRole("button", { name: /^Brouillons/ });
  const openTab = page.getByRole("button", { name: /^À pourvoir/ });
  await expect(draftsTab).toContainText("0");

  // Le CTA du tableau de bord mène directement au formulaire : passer par
  // l'onglet Missions ne doit pas être obligatoire.
  await page.getByRole("link", { name: "Créer une mission" }).first().click();
  await expect(page).toHaveURL(/\/company\/missions\/new$/);

  await page.getByLabel("Intitulé de la mission").fill("Service du réveillon");
  await page.getByLabel("Métier recherché").selectOption("serveur");
  await page.getByLabel("Début").fill("2027-12-31T18:00");
  await page.getByLabel("Fin").fill("2028-01-01T02:00");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel("Code postal").fill("69002");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  const missionUrl = page.url();

  // Retour au tableau de bord par NAVIGATION, sans rechargement de page.
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect(draftsTab).toContainText("1");
  await draftsTab.click();
  await expect(
    page.getByRole("heading", { name: "Service du réveillon" }),
  ).toBeVisible();
  // Le planning suit aussi.
  await expect(page.locator(".agenda-item")).toHaveCount(1);

  // Modification, puis navigation ailleurs et retour.
  await page.goto(missionUrl);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page
    .getByLabel("Intitulé de la mission")
    .fill("Service du réveillon — 20 h");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
  await draftsTab.click();
  await expect(
    page.getByRole("heading", { name: "Service du réveillon — 20 h" }),
  ).toBeVisible();

  // Publication, puis retour : la mission bascule d'onglet et les compteurs suivent.
  await page.goto(missionUrl);
  await page.getByRole("button", { name: "Publier la mission" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publier" })
    .click();
  await expect(page.locator(".mission-status")).toHaveText("À pourvoir");
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect(openTab).toContainText("1");
  await expect(draftsTab).toContainText("0");
  await expect(
    page.getByRole("heading", { name: "Service du réveillon — 20 h" }),
  ).toBeVisible();

  // Rien de tout cela ne doit dépendre d'un rechargement : l'état affiché est
  // déjà celui qu'un F5 montrerait.
  const avant = await page.locator(".mission-card").count();
  await page.reload();
  await expect(openTab).toContainText("1");
  expect(await page.locator(".mission-card").count()).toBe(avant);
  expect(errors).toEqual([]);
});

// SL2c — le premier parcours de bout en bout : une entreprise publie, un
// intérimaire voit. Les deux rôles dans un seul test, parce que c'est le
// passage de l'un à l'autre qui est la fonctionnalité.
test("a published mission becomes visible to an intérimaire", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const suffix = testInfo.project.name;
  const offert = `Extra plonge — service du soir ${suffix}`;
  const brouillon = `Jamais publiée ${suffix}`;

  // ---- L'entreprise prépare deux missions, n'en publie qu'une ----
  await register(page, `open.${suffix}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  const create = async (titre: string, jour: string) => {
    await page.goto("/company/missions/new");
    await page.getByLabel("Intitulé de la mission").fill(titre);
    await page.getByLabel("Métier recherché").selectOption("plongeur");
    await page
      .getByLabel("Description (facultatif)")
      .fill("Plonge batterie et vaisselle, 150 couverts.");
    await page.getByLabel("Début").fill(`2027-09-${jour}T18:00`);
    await page.getByLabel("Fin").fill(`2027-09-${jour}T23:30`);
    await page.getByLabel("Adresse (facultatif)").fill("12 quai Rambaud");
    await page.getByLabel("Ville").fill("Lyon");
    await page.getByLabel("Code postal").fill("69002");
    await page.getByLabel("Nombre de personnes").fill("2");
    await page
      .getByLabel("Expérience minimale en années (facultatif)")
      .fill("1");
    await page.getByLabel("Montant en euros").fill("14");
    await page.getByLabel("Unité").selectOption("hour");
    await page.getByRole("radio", { name: "Cuisine : obligatoire" }).check();
    await page
      .getByRole("radio", { name: "Mise en place : souhaitée" })
      .check();
    await page
      .getByRole("button", { name: "Enregistrer le brouillon" })
      .click();
    await page.waitForURL(/\/company\/missions\/[0-9a-f-]{36}$/);
    return page.url();
  };

  const urlOfferte = await create(offert, "18");
  await page.getByRole("button", { name: "Publier la mission" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publier" })
    .click();
  await expect(page.locator(".mission-status")).toHaveText("À pourvoir");
  const idOffert = urlOfferte.split("/").pop();

  const urlBrouillon = await create(brouillon, "19");
  const idBrouillon = urlBrouillon.split("/").pop();
  await expect(page.locator(".mission-status")).toHaveText("Brouillon");

  await openAccount(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // ---- L'intérimaire la voit, une fois son profil rapprochable ----
  await register(page, `seeker.${suffix}.${Date.now()}@example.test`);
  await expect(page).toHaveURL(/\/worker$/);
  await completeTour(page);
  await makeEmployable(page, {
    job: "plongeur",
    from: "2027-09-18T16:00",
    to: "2027-09-19T02:00",
    // La mission exige cette compétence : sans elle, le rapprochement l'écarte.
    skills: ["Cuisine"],
  });
  await page.goto("/worker");

  // Dès le tableau de bord, sans rechargement manuel.
  await expect(
    page.getByRole("heading", { name: "Missions disponibles" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Missions", exact: true }).click();
  await expect(page).toHaveURL(/\/worker\/missions$/);
  await expect(page.getByRole("heading", { name: offert })).toBeVisible();
  // Le brouillon n'existe pas pour l'intérimaire.
  await expect(page.getByRole("heading", { name: brouillon })).toHaveCount(0);

  // ---- Liste → détail → retour ----
  await page.getByRole("heading", { name: offert }).click();
  await expect(page).toHaveURL(new RegExp(`/worker/missions/${idOffert}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(offert);

  const detail = page.locator(".detail-grid");
  await expect(detail).toContainText("2 postes à pourvoir");
  await expect(detail).toContainText("69002 Lyon");
  await expect(detail).toContainText("14,00 €");
  await expect(detail).toContainText("1 an d’expérience");
  await expect(page.locator(".detail-description")).toContainText(
    "Plonge batterie",
  );
  // Compétences, distinguées comme à la saisie.
  await expect(page.getByText("Obligatoires —")).toBeVisible();
  await expect(page.getByText("Souhaitées —")).toBeVisible();
  await expect(page.locator(".badge").first()).toHaveText("Cuisine");

  // L'assertion « aucune candidature proposée » a été retirée ici : elle datait
  // du SL2c, où le backend ne savait pas enregistrer de candidature. Ce domaine
  // existe désormais et a ses propres tests ; le vérifier depuis ce parcours
  // reviendrait à affirmer le contraire de ce qui est livré.

  await page.getByRole("link", { name: "Missions disponibles" }).click();
  await expect(page).toHaveURL(/\/worker\/missions$/);

  // ---- Un brouillon reste introuvable, même par son adresse directe ----
  await page.goto(`/worker/missions/${idBrouillon}`);
  await expect(page.getByRole("alert")).toContainText("introuvable");

  // L'espace entreprise reste fermé à l'intérimaire.
  await page.goto("/company/missions");
  await expect(page).toHaveURL(/\/worker$/);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

// SL3a — le rapprochement de bout en bout : une entreprise publie, un
// intérimaire compatible la voit avec son score, et l'entreprise le retrouve
// parmi les profils rapprochés.
test("matching connects a published mission to a compatible intérimaire", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const suffix = testInfo.project.name;
  const titre = `Renfort brasserie ${suffix}`;

  // ---- L'entreprise publie une mission exigeante ----
  await register(page, `match.${suffix}@example.test`);
  await expect(page).toHaveURL(/\/company$/);
  await completeTour(page);

  await page.goto("/company/missions/new");
  await page.getByLabel("Intitulé de la mission").fill(titre);
  await page.getByLabel("Métier recherché").selectOption("serveur");
  // Dates fixes : le rapprochement ne doit dépendre d'aucune horloge.
  await page.getByLabel("Début").fill("2027-10-15T10:00");
  await page.getByLabel("Fin").fill("2027-10-15T18:00");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel("Code postal").fill("69002");
  await page
    .getByRole("radio", { name: "Service en salle : obligatoire" })
    .check();
  await page
    .getByRole("radio", { name: "Relation client : souhaitée" })
    .check();
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await page.waitForURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  const missionUrl = page.url();
  await page.getByRole("button", { name: "Publier la mission" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publier" })
    .click();
  await expect(page.locator(".mission-status")).toHaveText("À pourvoir");

  await openAccount(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // ---- Un intérimaire encore incomplet ne reçoit rien ----
  const email = `match.worker.${suffix}.${Date.now()}@example.test`;
  await register(page, email);
  await expect(page).toHaveURL(/\/worker$/);
  await completeTour(page);
  await page.goto("/worker/missions");
  await expect(page.getByRole("heading", { name: titre })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Aucune mission disponible/ }),
  ).toBeVisible();

  // ---- Il complète ce que le rapprochement exige ----
  await page.goto("/worker/profile");
  const identite = section(page, "Votre identité");
  await identite.getByLabel("Prénom", { exact: true }).fill("Camille");
  await identite.getByLabel("Nom", { exact: true }).fill("Nguyen");
  await save(page, "Votre identité");

  const metier = section(page, "Votre métier");
  await metier.getByLabel("Métier principal").selectOption("serveur");
  await save(page, "Votre métier");

  const competences = section(page, "Vos compétences");
  await competences.getByRole("checkbox", { name: "Service en salle" }).check();
  await competences.getByRole("checkbox", { name: "Relation client" }).check();
  await save(page, "Vos compétences");

  const mobilite = section(page, "Votre mobilité");
  await mobilite.getByLabel("Ville").fill("Lyon");
  await mobilite.getByLabel("Code postal").fill("69002");
  await mobilite.getByLabel(/Rayon de mobilité/).fill("30");
  await save(page, "Votre mobilité");

  const dispos = section(page, "Vos disponibilités");
  await dispos.getByLabel("Début").fill("2027-10-15T08:00");
  await dispos.getByLabel("Fin").fill("2027-10-15T20:00");
  await dispos.getByRole("button", { name: /Ajouter ce créneau/ }).click();
  await dispos.getByText("Créneau ajouté.").waitFor();

  // ---- La mission lui est désormais proposée, avec son score ----
  await page.goto("/worker/missions");
  await expect(page.getByRole("heading", { name: titre })).toBeVisible();
  // Métier principal, compétences souhaitées acquises, même ville : tout est
  // rempli, donc le rapprochement est total.
  await expect(page.locator(".match-badge").first()).toHaveText(
    "Compatible à 100 %",
  );

  // ---- Le détail explique le rapprochement, sans jargon ----
  await page.getByRole("heading", { name: titre }).click();
  await expect(page).toHaveURL(/\/worker\/missions\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Pourquoi cette mission" }),
  ).toBeVisible();
  const explication = page.locator(".match-card");
  await expect(explication).toContainText("C’est votre métier principal.");
  await expect(explication).toContainText(
    "Vous avez toutes les compétences appréciées",
  );
  await expect(explication).toContainText("kilomètre");
  // Aucun code technique ne doit remonter à l'écran.
  await expect(explication).not.toContainText("desired_skills");
  await expect(explication).not.toContainText("ratio");

  await page.screenshot({
    path: testInfo.outputPath("worker-match.png"),
    fullPage: true,
  });

  await openAccount(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  // ---- L'entreprise retrouve ce profil parmi les candidats rapprochés ----
  await signIn(page, `match.${suffix}@example.test`);
  // Attendre l'arrivée : naviguer avant que la session soit posée renverrait
  // vers la page de connexion.
  await expect(page).toHaveURL(/\/company$/);
  await page.goto(missionUrl);
  await expect(
    page.getByRole("heading", { name: "Profils compatibles" }),
  ).toBeVisible();
  const candidats = page.locator(".candidate-list");
  await expect(candidats).toContainText("Camille N.");
  // Nom complet et adresse électronique n'ont pas à figurer avant candidature.
  await expect(candidats).not.toContainText("Nguyen");
  await expect(candidats).not.toContainText("@example.test");
  await expect(candidats.locator(".match-badge").first()).toHaveText(
    "Compatible à 100 %",
  );
  await expect(candidats).toContainText("Service en salle");

  await page.screenshot({
    path: testInfo.outputPath("company-candidates.png"),
    fullPage: true,
  });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
