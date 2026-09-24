import { test, expect, type Page } from "@playwright/test";

/**
 * Recette visuelle.
 *
 * Ce fichier n'affirme presque rien : il PARCOURT le produit et en rapporte des
 * captures, écran par écran, en bureau et en mobile. C'est l'outil qui manquait
 * pour juger une refonte autrement qu'en lisant du code.
 *
 * Il vérifie tout de même trois invariants sur chaque page traversée, parce que
 * ce sont exactement les défauts qu'une capture ne montre pas toujours et qu'un
 * relecteur ne pense pas à chercher :
 *   — aucun débordement horizontal du document ;
 *   — aucune erreur JavaScript non rattrapée ;
 *   — le repère `main` est présent et non vide.
 *
 * Les comptes viennent des fixtures `recette.*` de `src/scripts/test-server.ts`,
 * côté backend. Aucune donnée n'est inventée ici : les missions, les
 * candidatures et les profils traversés sont ceux que le serveur éphémère a
 * réellement créés.
 *
 * ELLE A SES PROPRES COMPTES, et c'est indispensable. Elle traverse tout le
 * produit — connexion, navigation, déconnexion, reconnexion ailleurs — pendant
 * que Playwright exécute un second ouvrier sur le même serveur. Partager un
 * compte avec un parcours fonctionnel revient à lui retirer sa session au
 * milieu d'une assertion : trois tests sont tombés ainsi avant que la fixture
 * `recette.*` n'existe, et aucun ne décrivait un vrai défaut.
 */

const PASSWORD = "Browser-test-password-42!";

/** Débordement horizontal — le défaut le plus fréquent, et le plus invisible. */
const fits = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );

/**
 * Connexion, et VÉRIFICATION DE L'ESPACE ATTEINT.
 *
 * Le rôle n'est pas déduit de l'adresse : il vient de la liste d'habilitation
 * `company_accounts`, côté serveur. Un compte de recette oublié dans cette
 * liste devient un intérimaire — et la recette photographie alors l'espace
 * intérimaire en croyant montrer l'espace entreprise, sans qu'aucune assertion
 * ne s'en aperçoive. C'est arrivé. D'où cette vérification.
 */
async function signIn(page: Page, email: string, space: "worker" | "company") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${space}$`), { timeout: 20_000 });
}

async function logout(page: Page) {
  await page.locator('summary[aria-label="Mon compte"]').click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/**
 * Capture la page COURANTE, sans y naviguer.
 *
 * Les écrans de détail s'atteignent par un clic réel — c'est ce qui garantit
 * que le lien existe et mène où il prétend. Ils ont pourtant besoin des mêmes
 * précautions que `shoot` : dérouler la page pour déclencher les apparitions,
 * et vérifier l'absence de débordement.
 */
async function settleAndShoot(
  page: Page,
  name: string,
  testInfo: { project: { name: string }; outputPath: (n: string) => string },
) {
  await expect(page.getByText("Chargement…", { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle");
  await scrollThrough(page);
  expect(await fits(page), `débordement horizontal sur ${name}`).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-${name}.png`),
    fullPage: true,
  });
}

/** Déroule la page pour déclencher les apparitions au défilement. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
}

/**
 * Traverse un écran et en garde une trace.
 *
 * `fullPage` est délibéré : une capture limitée au viewport cache justement ce
 * qu'on cherche — la section qui s'effondre en bas de page, l'état vide qui
 * laisse un blanc de 400 px, le pied qui remonte au milieu.
 */
async function shoot(
  page: Page,
  path: string,
  name: string,
  testInfo: { project: { name: string }; outputPath: (n: string) => string },
  settle?: (page: Page) => Promise<void>,
) {
  await page.goto(path);
  // Les espaces sont chargés à la demande : sans cette attente, la capture fige
  // le repli de `Suspense` et documente un écran qui n'existe pas.
  await expect(page.getByText("Chargement…", { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator("main#content")).not.toBeEmpty();
  await page.waitForLoadState("networkidle");
  if (settle) await settle(page);
  // Les apparitions au défilement sont déclenchées par l'entrée dans le champ :
  // sans ce passage, la capture pleine page fige des sections encore à zéro
  // d'opacité et laisse croire à un écran vide.
  await scrollThrough(page);
  expect(await fits(page), `débordement horizontal sur ${path}`).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-${name}.png`),
    fullPage: true,
  });
}

test("recette visuelle — écrans publics, intérimaire et entreprise", async ({
  page,
}, testInfo) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  /*
   * LES ERREURS DE CONSOLE COMPTENT AUSSI.
   *
   * React signale les balisages invalides — un `<li>` dans un `<li>`, un `<p>`
   * contenant un bloc — par `console.error`, jamais par une exception. La
   * recette les ignorait donc, et deux listes imbriquées ont traversé une suite
   * entièrement verte avant d'être vues à la main dans la sortie du serveur.
   *
   * Le filtre est volontairement étroit : seuls les messages de validité et
   * d'hydratation sont retenus. Les avertissements de Vite ou d'une
   * bibliothèque tierce ne sont pas de notre ressort et rendraient la recette
   * bruyante, donc ignorée.
   */
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      /cannot contain|cannot appear|validateDOMNesting|Hydration|in a <[a-z]+>/i.test(
        text,
      )
    )
      errors.push(text);
  });

  const project = testInfo.project.name;

  // ---- Public -------------------------------------------------------------
  await shoot(page, "/", "01-accueil", testInfo);
  await shoot(page, "/login", "02-connexion", testInfo);
  await shoot(page, "/register", "03-inscription", testInfo);
  await shoot(page, "/mentions-legales", "04-mentions-legales", testInfo);
  await shoot(page, "/accessibilite", "05-accessibilite", testInfo);

  // ---- Intérimaire --------------------------------------------------------
  // Profil complet avec photo, et trois candidatures aux trois issues.
  await signIn(page, `recette.worker.${project}@example.test`, "worker");
  await shoot(page, "/worker", "10-worker-tableau", testInfo);
  await shoot(page, "/worker/profile", "11-worker-profil", testInfo);
  await shoot(page, "/worker/missions", "12-worker-missions", testInfo);
  await shoot(page, "/worker/applications", "13-worker-candidatures", testInfo);
  await shoot(page, "/worker/documents", "14-worker-documents", testInfo);
  await shoot(
    page,
    "/worker/public-offers",
    "15-worker-france-travail",
    testInfo,
  );

  /*
   * Détail d'une mission, côté intérimaire.
   *
   * On passe par « Mes candidatures » et NON par la liste des missions : la
   * fixture a postulé aux trois missions publiées, et une mission déjà
   * candidatée ne réapparaît pas dans les propositions. Suivre la liste des
   * missions produisait donc zéro carte, la capture était silencieusement
   * sautée, et l'écran de détail n'a jamais été regardé.
   */
  await page.goto("/worker/applications");
  await page.getByRole("link", { name: "Voir la mission" }).first().click();
  await expect(page).toHaveURL(/\/worker\/missions\/[0-9a-f-]+$/);
  await settleAndShoot(page, "16-worker-mission-detail", testInfo);

  await logout(page);

  // ---- Entreprise ---------------------------------------------------------
  await signIn(page, `recette.company.${project}@example.test`, "company");
  await shoot(page, "/company", "20-company-tableau", testInfo);
  await shoot(page, "/company/missions", "21-company-missions", testInfo);
  await shoot(page, "/company/missions/new", "22-company-mission-creation", testInfo);
  await shoot(page, "/company/applications", "23-company-candidatures", testInfo);
  await shoot(page, "/company/documents", "24-company-documents", testInfo);
  await shoot(page, "/company/profile", "25-company-profil", testInfo);

  // Détail d'une mission, côté entreprise, puis son formulaire de modification.
  await page.goto("/company/missions");
  await page.locator("a.mission-card").first().click();
  await expect(page).toHaveURL(/\/company\/missions\/[0-9a-f-]+$/);
  const missionUrl = page.url();
  await settleAndShoot(page, "26-company-mission-detail", testInfo);

  await page.goto(`${missionUrl}/edit`);
  await settleAndShoot(page, "27-company-mission-edition", testInfo);

  expect(
    errors,
    "erreurs JavaScript ou balisage invalide pendant la recette",
  ).toEqual([]);
});
