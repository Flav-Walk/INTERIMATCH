import { expect, test, type Page } from "@playwright/test";

/**
 * Rapprochement et score, vus par l'entreprise — contre le vrai backend.
 *
 * AUCUNE INTERCEPTION ICI, et c'est le point. Le serveur d'essai applique
 * toutes les migrations dans un vrai PostgreSQL (PGlite) et calcule réellement
 * les scores avec le moteur de `score.ts`. Les nombres affirmés plus bas ne
 * sont donc pas des valeurs choisies pour arranger le test : ce sont celles que
 * le moteur produit à partir de la fixture, et un changement de pondération les
 * ferait tomber — ce qui est exactement ce qu'on attend d'eux.
 *
 * (`lifecycle.spec.ts`, lui, mocke ses réponses : il valide des rendus d'écran.
 * Les deux approches coexistent, elles ne prouvent pas la même chose.)
 *
 * La fixture oppose trois profils à une mission de chef de rang exigeant
 * « Service en salle », appréciant « Prise de commande » et « Encaissement »,
 * et demandant 3 ans d'expérience, à Lyon :
 *
 * | Profil  | Ce qui le caractérise                          | Attendu |
 * | ------- | ---------------------------------------------- | ------- |
 * | Adèle   | métier, toutes compétences, sur place, 8 ans   | 100 %   |
 * | Basile  | mêmes compétences, métier secondaire, 1 an    | 85 %    |
 * | Céleste | qualifiée mais à 276 km, rayon de 30 km        | hors zone |
 */

const PASSWORD = "Browser-test-password-42!";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
}

const matches = (page: Page) =>
  page.getByRole("region", { name: "Profils correspondants" });

const profileOf = (page: Page, name: string) =>
  matches(page).locator(".matched-profile").filter({ hasText: name });

async function openScoringMission(page: Page, project: string) {
  await page.goto("/company/missions");
  const href = await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", {
        name: `Chef de rang événement ${project}`,
        exact: true,
      }),
    })
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
}

test("l’entreprise lit un classement et comprend chaque score", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const project = testInfo.project.name;
  // Une entreprise voit tous les intérimaires disponibles, pas seulement ceux
  // de sa fixture : les prénoms sont donc propres à chaque projet Playwright,
  // faute de quoi les deux suites se liraient mutuellement à l'écran.
  const fort = project === "desktop" ? "Adèle" : "Alizée";
  const limite = project === "desktop" ? "Basile" : "Bastien";
  const loin = project === "desktop" ? "Céleste" : "Clémence";

  await signIn(page, `scoring.${project}@example.test`);
  await openScoringMission(page, project);

  // ---- Le palier retenu ----
  //
  // Le décompte exact n'est volontairement pas affirmé : d'autres fixtures
  // ajoutent leurs propres intérimaires à la base partagée, et un nombre figé
  // ici casserait au premier scénario ajouté ailleurs. Ce qui doit tenir, c'est
  // le palier annoncé et la place de chaque profil dedans.
  // La phrase de section ne pose plus de plafond : « entre 70 et 79 » serait
  // démenti par tout profil dont l'arrondi dépasse la borne.
  await expect(matches(page)).toContainText(
    "au palier « très compatibles » (au moins 70 % de correspondance).",
  );

  // Le meilleur d'abord : l'ordre vient du serveur, pas du navigateur.
  const html = await matches(page).innerHTML();
  expect(html.indexOf(fort)).toBeLessThan(html.indexOf(limite));

  // Les scores sont ceux que le moteur calcule réellement à partir de la
  // fixture. Changer une pondération ferait tomber ces deux lignes.
  await expect(profileOf(page, fort)).toContainText("Compatible à 100 %");
  await expect(profileOf(page, limite)).toContainText("Compatible à 85 %");

  // Le palier est restitué en toutes lettres, pas seulement par la couleur :
  // c'est ce qu'une synthèse vocale lira après le pourcentage.
  await expect(profileOf(page, fort)).toContainText(
    "Compatible à 100 % — Très compatibles",
  );

  // Rien du nom complet ni du contact avant candidature.
  await expect(matches(page)).toContainText(`${fort} F.`);
  await expect(matches(page)).not.toContainText("Fontaine");

  await page.screenshot({
    path: testInfo.outputPath("01-classement-par-palier.png"),
    fullPage: true,
  });

  // ---- L'explication d'un profil parfait : que des points positifs ----
  const adele = profileOf(page, fort);
  await adele.getByRole("group").getByText("Comprendre ce score").click();
  await expect(adele).toContainText(
    "Tous les critères que vous avez rendus obligatoires sont satisfaits.",
  );
  await expect(adele).toContainText("Points positifs");
  await expect(adele).toContainText(
    "Le poste correspond à son métier principal.",
  );
  await expect(adele).toContainText(
    "Elle possède toutes les compétences appréciées pour ce poste.",
  );
  await expect(adele).toContainText(
    "Son expérience atteint ce que vous demandez.",
  );
  // Un profil à 100 % n'a aucun frein : en afficher un serait un mensonge.
  await expect(adele).not.toContainText("Point limitant");

  // ---- L'explication d'un profil moins bien classé : le frein est nommé ----
  const basile = profileOf(page, limite);
  await basile.getByRole("group").getByText("Comprendre ce score").click();
  await expect(basile).toContainText("Point limitant");
  await expect(basile).toContainText(
    "Son expérience reste en deçà de ce que vous demandez.",
  );
  // Son métier secondaire n'est ni un atout ni un reproche : il est dit, sans
  // être rangé dans l'une des deux colonnes.
  await expect(basile).toContainText(
    "Le poste fait partie de ses métiers secondaires.",
  );
  await expect(basile).toContainText("Points positifs");

  await page.screenshot({
    path: testInfo.outputPath("02-explication-du-score.png"),
    fullPage: true,
  });

  // ---- Les profils hors zone restent consultables, à part ----
  await expect(matches(page)).not.toContainText(loin);
  const toggle = matches(page).getByRole("button", {
    name: /profils hors zone/,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const celeste = profileOf(page, loin);
  await expect(celeste).toContainText("hors zone");
  // Le score reste affiché : hors zone ne veut pas dire mal noté.
  await expect(celeste).toContainText("75 %");

  await celeste.getByRole("group").getByText("Comprendre ce score").click();
  // Et surtout : on n'affirme pas que tous les critères sont satisfaits, car
  // la distance est précisément celle qui bloque.
  await expect(celeste).not.toContainText(
    "Tous les critères que vous avez rendus obligatoires sont satisfaits.",
  );
  await expect(celeste).toContainText(
    "Le lieu de la mission dépasse le rayon de déplacement qu’elle a déclaré.",
  );
  await expect(celeste).toContainText("276 km");

  await page.screenshot({
    path: testInfo.outputPath("03-profils-hors-zone.png"),
    fullPage: true,
  });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
