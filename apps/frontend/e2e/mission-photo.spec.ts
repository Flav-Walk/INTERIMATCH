import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Browser-test-password-42!";

/**
 * Photo d'une mission, de bout en bout.
 *
 * LA BIBLIOTHÈQUE EST SIMULÉE, ET C'EST DÉLIBÉRÉ. Le serveur éphémère n'a pas
 * de clé Unsplash — il n'en aura jamais, un secret n'a rien à faire dans un
 * harnais de test — et appeler leur API depuis la recette brûlerait un quota
 * partagé pour un résultat qui changerait à chaque exécution. Les réponses
 * d'Unsplash sont donc interceptées au niveau de l'API InteriMatch, qui est
 * exactement la frontière que le navigateur connaît : tout ce qui est vérifié
 * ici — recherche, sélection, aperçu, crédit, panne — est le comportement réel
 * de l'interface face à cette frontière.
 *
 * L'import depuis l'ordinateur, lui, traverse toute la chaîne réelle : champ
 * fichier, envoi, validation des octets par le serveur, stockage, affichage.
 */

/**
 * Compte entreprise neuf. Chaque scénario a le sien : ils partagent le serveur
 * éphémère, et un compte commun rendrait leur résultat dépendant de leur ordre.
 */
async function nouvelleEntreprise(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect(page).toHaveURL(/\/company$/);
}

async function completeTour(page: Page) {
  const tour = page.getByRole("dialog");
  if (!(await tour.isVisible().catch(() => false))) return;
  for (;;) {
    const next = tour.getByRole("button", { name: "Suivant" });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await tour.getByRole("button", { name: "Terminer" }).click();
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

async function remplirMission(page: Page, titre: string) {
  const starts = new Date();
  starts.setDate(starts.getDate() + 14);
  starts.setHours(18, 0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(23, 0, 0, 0);
  const localInput = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  await page.goto("/company/missions/new");
  await page.getByLabel("Intitulé de la mission").fill(titre);
  await page.getByLabel("Métier recherché").selectOption("serveur");
  await page.getByLabel("Début").fill(localInput(starts));
  await page.getByLabel("Fin").fill(localInput(ends));
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel("Code postal").fill("69002");
}

const fileInput = (page: Page) =>
  page.locator('.photo-field input[type="file"]');

/** Bibliothèque simulée à la frontière de l'API InteriMatch. */
async function simulerUnsplash(
  page: Page,
  reponse: { status?: number; body?: unknown },
) {
  await page.route("**/api/v1/company/media/unsplash*", (route) =>
    route.fulfill({
      status: reponse.status ?? 200,
      json: reponse.body ?? {},
    }),
  );
}

const PHOTO = {
  id: "salle-1",
  thumb_url: "/images/fixtures/mission.jpg",
  preview_url: "/images/fixtures/mission.jpg",
  alt: "Salle de restaurant dressée",
  author_name: "Camille Photographe",
  author_url:
    "https://unsplash.com/@camille?utm_source=interimatch&utm_medium=referral",
};

test("une mission ne se publie pas sans photo, et l'entreprise en choisit une", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await nouvelleEntreprise(
    page,
    `photo.form.${testInfo.project.name}@example.test`,
  );
  await completeTour(page);
  // La photo résolue par la doublure backend conserve une URL Unsplash. Le
  // navigateur sert ici l'octet local : aucune requête ne quitte la recette.
  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: JPEG }),
  );

  // ---- Sans photo : refus annoncé, et annoncé avec le bon mot -------------
  await remplirMission(page, `Photo obligatoire ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.locator(".form-summary")).toContainText(
    "Ajoutez une photo pour publier cette mission.",
  );
  // Rien n'a été créé : l'URL n'a pas bougé.
  await expect(page).toHaveURL(/\/company\/missions\/new$/);

  // ---- Deux voies, et deux seulement -------------------------------------
  await expect(
    page.getByRole("button", { name: "Choisir dans la bibliothèque" }),
  ).toBeVisible();
  await expect(page.getByText("Importer une photo")).toBeVisible();
  await expect(page.locator(".photo-field__preview")).toHaveCount(0);

  // ---- Import depuis l'ordinateur : chaîne réelle -------------------------
  await fileInput(page).setInputFiles({
    name: "salle.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG,
  });
  const apercu = page.locator(".photo-field__preview img");
  await expect(apercu).toBeVisible();
  const importee = await apercu.getAttribute("src");
  expect(importee).toBeTruthy();
  // Une photo importée par l'établissement n'est créditée à personne.
  await expect(page.locator(".photo-field .photo-credit")).toHaveCount(0);

  // ---- Remplacement par une photo de la bibliothèque ----------------------
  await simulerUnsplash(page, {
    body: { total: 1, total_pages: 1, results: [PHOTO] },
  });
  await page.getByRole("button", { name: "Choisir une autre photo" }).click();
  const bibliotheque = page.getByRole("dialog", {
    name: "Bibliothèque de photos",
  });
  await expect(bibliotheque).toBeVisible();
  await expect(
    bibliotheque.getByRole("button", { name: /Choisir la photo/ }),
  ).toHaveCount(1);
  // Échap referme sans rien choisir : le choix précédent est intact.
  await page.keyboard.press("Escape");
  await expect(bibliotheque).toBeHidden();
  await expect(apercu).toHaveAttribute("src", importee!);

  await page.getByRole("button", { name: "Choisir une autre photo" }).click();
  await bibliotheque.getByRole("button", { name: /Choisir la photo/ }).click();
  await expect(bibliotheque).toBeHidden();
  // Le crédit apparaît dès la sélection : c'est une obligation d'usage, pas un
  // détail d'affichage.
  const credit = page.locator(".photo-field .photo-credit");
  await expect(credit).toContainText("Camille Photographe");
  await expect(
    credit.getByRole("link", { name: "Camille Photographe" }),
  ).toHaveAttribute("href", /utm_source=interimatch&utm_medium=referral/);
  await expect(credit.getByRole("link", { name: "Unsplash" })).toHaveAttribute(
    "href",
    /utm_source=interimatch/,
  );

  // ---- Enregistrement du choix Unsplash -----------------------------------
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
  const missionUrl = page.url();

  // ---- La photo suit la mission ------------------------------------------
  await expect(page.locator(".mission-photo img")).toBeVisible();
  await expect(page.locator(".mission-photo .photo-credit")).toContainText(
    "Camille Photographe",
  );
  await page.screenshot({
    path: testInfo.outputPath("mission-photo.png"),
    fullPage: true,
  });

  // ---- L'édition ne réclame pas de rechoisir une photo valide -------------
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.locator(".photo-field__preview img")).toBeVisible();
  await page
    .getByLabel("Intitulé de la mission")
    .fill(`Photo conservée ${testInfo.project.name}`);
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page).toHaveURL(new RegExp(missionUrl.split("/").pop()!));
  await expect(page.locator(".mission-photo img")).toBeVisible();
  await expect(page.locator(".mission-photo .photo-credit")).toContainText(
    "Camille Photographe",
  );

  // ---- Publication, maintenant possible -----------------------------------
  await page.getByRole("button", { name: "Publier la mission" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publier" })
    .click();
  // Mission ouverte = état normal : le badge « Brouillon » disparaît.
  await expect(page.locator(".mission-status")).toHaveCount(0);

  // ---- Même photo côté intérimaire ---------------------------------------
  await page.locator('summary[aria-label="Mon compte"]').click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`scoring.fort.${testInfo.project.name}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/worker$/);
  await page.goto("/worker/missions");
  const card = page.locator(".mission-card", {
    has: page.getByRole("heading", {
      name: `Photo conservée ${testInfo.project.name}`,
    }),
  });
  await expect(card.locator(".job-visual")).toBeVisible();
  await card.click();
  await expect(page.locator(".detail-hero__photo img")).toBeVisible();
  await expect(page.locator(".detail-hero__photo .photo-credit")).toContainText(
    "Camille Photographe",
  );

  expect(errors).toEqual([]);
});

test("une panne de la bibliothèque ne ferme pas l'import depuis l'ordinateur", async ({
  page,
}, testInfo) => {
  await nouvelleEntreprise(
    page,
    `photo.panne.${testInfo.project.name}@example.test`,
  );
  await completeTour(page);
  await remplirMission(page, `Bibliothèque en panne ${testInfo.project.name}`);

  await simulerUnsplash(page, {
    status: 503,
    body: {
      error: {
        code: "UNSPLASH_UNAVAILABLE",
        message:
          "La bibliothèque de photos est momentanément indisponible. Vous pouvez importer une photo depuis votre ordinateur.",
      },
    },
  });
  await page
    .getByRole("button", { name: "Choisir dans la bibliothèque" })
    .click();
  const bibliotheque = page.getByRole("dialog", {
    name: "Bibliothèque de photos",
  });
  await expect(bibliotheque.getByRole("alert")).toContainText(
    "momentanément indisponible",
  );
  // Le message dit où aller, il ne se contente pas de constater la panne.
  await expect(bibliotheque).toContainText("Importer une photo");
  await bibliotheque.getByRole("button", { name: "Fermer" }).click();
  await expect(bibliotheque).toBeHidden();

  // L'autre voie fonctionne, et la mission part.
  await fileInput(page).setInputFiles({
    name: "salle.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG,
  });
  await expect(page.locator(".photo-field__preview img")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]{36}$/);
});

test("une recherche sans résultat le dit sans faire croire à une panne", async ({
  page,
}, testInfo) => {
  await nouvelleEntreprise(
    page,
    `photo.vide.${testInfo.project.name}@example.test`,
  );
  await completeTour(page);
  await remplirMission(page, `Recherche vide ${testInfo.project.name}`);

  await simulerUnsplash(page, {
    body: { total: 0, total_pages: 0, results: [] },
  });
  await page
    .getByRole("button", { name: "Choisir dans la bibliothèque" })
    .click();
  const bibliotheque = page.getByRole("dialog", {
    name: "Bibliothèque de photos",
  });
  await expect(bibliotheque.getByRole("status")).toContainText("Aucune photo");
  await expect(bibliotheque.getByRole("alert")).toHaveCount(0);
});

test("un fichier au mauvais format est refusé sans quitter le formulaire", async ({
  page,
}, testInfo) => {
  await nouvelleEntreprise(
    page,
    `photo.format.${testInfo.project.name}@example.test`,
  );
  await completeTour(page);
  await remplirMission(page, `Mauvais format ${testInfo.project.name}`);

  // Le type déclaré est une image, le contenu non : c'est le serveur qui
  // tranche, sur les octets.
  await fileInput(page).setInputFiles({
    name: "faux.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("%PDF-1.7 ceci n'est pas une image"),
  });
  await expect(page.locator(".photo-field [role='alert']")).toContainText(
    "JPEG, PNG ou WebP",
  );
  await expect(page.locator(".photo-field__preview")).toHaveCount(0);

  // Le formulaire reste utilisable, et la bonne image passe ensuite.
  await fileInput(page).setInputFiles({
    name: "vraie.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG,
  });
  await expect(page.locator(".photo-field__preview img")).toBeVisible();
  await expect(page.locator(".photo-field [role='alert']")).toHaveCount(0);
});

test("les offres France Travail n'affichent aucune image", async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`scoring.fort.${testInfo.project.name}@example.test`);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/worker$/);

  await page.route("**/api/v1/public-job-offers*", (route) =>
    route.fulfill({
      json: {
        offers: [
          {
            id: "00000000-0000-4000-8000-0000000000aa",
            source: "france_travail",
            external_id: "FT-1",
            title: "Serveur de restaurant",
            description: "Service du soir en brasserie.",
            rome_code: "G1803",
            rome_label: "Service en restauration",
            company_name: "Brasserie du Parc",
            contract_type: "CDD",
            contract_label: "CDD",
            experience_label: null,
            postal_code: "69002",
            city: "Lyon",
            latitude: null,
            longitude: null,
            salary_label: "12,50 € / heure",
            working_time: null,
            positions: 1,
            skills: [],
            professional_qualities: [],
            source_url: "https://candidat.francetravail.fr/offres/FT-1",
            created_at_source: null,
            updated_at_source: null,
            imported_at: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 12,
        total_pages: 1,
      },
    }),
  );
  await page.goto("/worker/public-offers");

  const carte = page.locator(".public-offer-card");
  await expect(carte).toHaveCount(1);
  // Aucune image, d'aucune origine.
  await expect(carte.locator("img")).toHaveCount(0);
  // Tout ce qui identifie l'offre reste là.
  await expect(carte).toContainText("France Travail");
  await expect(carte).toContainText("Serveur de restaurant");
  await expect(carte).toContainText("Brasserie du Parc");
  await expect(carte).toContainText("Lyon");
  await expect(carte).toContainText("12,50 € / heure");
  // Et aucun score InteriMatch ne s'y est glissé.
  await expect(carte).not.toContainText("Compatible à");

  // Aucune requête vers Unsplash, ni directement ni par notre proxy.
  expect(requests.filter((url) => /unsplash/i.test(url))).toEqual([]);
});
