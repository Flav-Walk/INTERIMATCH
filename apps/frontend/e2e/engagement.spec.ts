import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
} from "@playwright/test";

/**
 * Recette navigateur des conflits d'engagement (migration 008).
 *
 * Le parcours est joué en entier contre le vrai backend et sa vraie base : le
 * serveur d'essai applique toutes les migrations, déclencheur compris. Aucun
 * appel n'est intercepté, aucune réponse n'est simulée — ce que l'écran affiche
 * vient réellement du serveur, et le refus vient réellement de PostgreSQL.
 *
 * Deux entreprises distinctes publient deux missions qui se chevauchent le même
 * jour. La seconde acceptation doit être refusée, et surtout : l'écran doit le
 * dire, et l'état affiché après rechargement doit rester celui du serveur.
 */

const PASSWORD = "Browser-test-password-42!";

async function signIn(page: Page, email: string, space: "company" | "worker") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  // La redirection post-connexion est asynchrone : naviguer sans l'attendre
  // ramène sur le tableau de bord au milieu de l'étape suivante.
  await expect(page).toHaveURL(new RegExp(`/${space}$`));
}

async function logout(page: Page) {
  await page.locator('summary[aria-label="Mon compte"]').click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function openMission(page: Page, title: string) {
  await page.goto("/company/missions");
  const href = await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  return href!;
}

/**
 * Le compteur de postes de la mission ouverte.
 *
 * Le libellé apparaît aussi dans le résumé de la mission ; c'est cet élément-ci
 * qui porte `role="status"` et fait autorité pour l'état du recrutement.
 */
const capacity = (page: Page) => page.locator(".mission-capacity");

/** La candidature de cette personne, dans la liste des candidatures reçues. */
const candidate = (page: Page) =>
  page
    .getByRole("region", { name: "Candidatures reçues" })
    .locator("li")
    .filter({ hasText: "Nadia Berger" });

test("un intérimaire ne peut pas être engagé deux fois sur le même créneau", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Toute réponse 5xx du serveur est une anomalie : la contrainte doit se
  // traduire en refus métier, jamais en erreur technique.
  const serverFailures: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) serverFailures.push(`${r.status()} ${r.url()}`);
  });

  const suffix = testInfo.project.name;
  // Les deux projets Playwright partagent le serveur : chaque mission porte
  // donc le nom du projet qui la joue.
  const MISSION_A = `Engagement A ${suffix}`;
  const MISSION_B = `Engagement B ${suffix}`;
  const shot = (name: string) =>
    page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });

  // ---- A. L'intérimaire candidate aux deux missions ----
  await signIn(page, `engage.worker.${suffix}@example.test`, "worker");

  for (const title of [MISSION_A, MISSION_B]) {
    await page.goto("/worker/missions");
    await page.getByRole("heading", { name: title, exact: true }).click();
    await expect(page).toHaveURL(/\/worker\/missions\/[0-9a-f-]{36}$/);
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
  }

  // Les deux coexistent en attente : postuler n'engage à rien.
  await page.goto("/worker/applications");
  await expect(page.getByText(MISSION_A)).toBeVisible();
  await expect(page.getByText(MISSION_B)).toBeVisible();
  await expect(page.getByText("En attente", { exact: true })).toHaveCount(2);
  await shot("01-worker-deux-candidatures-en-attente");

  await logout(page);

  // ---- B. L'entreprise A accepte ----
  await signIn(page, `engage.a.${suffix}@example.test`, "company");
  await openMission(page, MISSION_A);

  await expect(candidate(page)).toContainText("En attente");
  await expect(capacity(page)).toHaveText("0 poste pourvu sur 1.");
  await shot("02-mission-A-candidature-avant-decision");

  await candidate(page).getByRole("button", { name: "Accepter" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accepter" })
    .click();

  await expect(candidate(page)).toContainText("Acceptée");
  await expect(capacity(page)).toHaveText(
    "Tous les postes sont pourvus (1 sur 1).",
  );
  await shot("03-mission-A-candidature-acceptee");

  await logout(page);

  // ---- C. L'entreprise B se heurte au conflit ----
  await signIn(page, `engage.b.${suffix}@example.test`, "company");
  const missionBHref = await openMission(page, MISSION_B);

  await expect(candidate(page)).toContainText("En attente");
  await shot("04-mission-B-candidature-avant-tentative");

  // Premiere barriere : l'interface refuse l'acceptation avant meme de la
  // tenter. Le serveur a signale le conflit dans la liste, et l'ecran retire la
  // seule action devenue impossible plutot que de la proposer pour rien.
  await expect(candidate(page)).toContainText(
    "Cette personne a accepté une autre mission sur ce créneau.",
  );
  await expect(
    candidate(page).getByRole("button", { name: "Accepter" }),
  ).toHaveCount(0);
  // Refuser reste possible : l'entreprise doit pouvoir clore le dossier.
  await expect(
    candidate(page).getByRole("button", { name: "Refuser" }),
  ).toBeVisible();
  await shot("05-mission-B-conflit-affiche");

  // Seconde barriere, la seule qui compte : le serveur.
  //
  // L'interface n'est pas une frontiere de securite. On contourne donc sa
  // protection en appelant directement l'API — meme serveur, meme base, meme
  // declencheur 008 — pour verifier qu'un client hostile, un script ou un
  // second onglet ne pourrait pas creer le double engagement.
  const missionBId = missionBHref.split("/").at(-1)!;
  // Chemins absolus : un `baseURL` porteur d'un chemin est ecrase par toute
  // ressource commencant par « / ».
  const API = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api/v1";
  // L'API n'accepte que l'origine du frontend : un appel hors navigateur doit
  // s'annoncer comme tel, sans quoi CORS le refuse avant toute regle metier.
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: "http://127.0.0.1:5174" },
  });
  const session = await api.post(`${API}/auth/login`, {
    data: { email: `engage.b.${suffix}@example.test`, password: PASSWORD },
  });
  expect(session.status()).toBe(200);
  const token = (await session.json()).access_token as string;
  const bearer = { Authorization: `Bearer ${token}` };

  const list = await api.get(`${API}/missions/${missionBId}/applications`, {
    headers: bearer,
  });
  expect(list.status()).toBe(200);
  const body = await list.json();
  const target = body.applications.find(
    (a: { worker: { first_name: string } }) => a.worker.first_name === "Nadia",
  );
  expect(target.status).toBe("pending");
  expect(target.conflict).toBe(true);

  const forced = await api.patch(
    `${API}/missions/${missionBId}/applications/${target.id}`,
    { headers: bearer, data: { status: "accepted" } },
  );
  expect(forced.status()).toBe(409);
  expect((await forced.json()).error.code).toBe("WORKER_ENGAGED");

  // Rien n'a bouge cote serveur.
  const after = await api.get(`${API}/missions/${missionBId}/applications`, {
    headers: bearer,
  });
  const reread = (await after.json()).applications.find(
    (a: { id: string }) => a.id === target.id,
  );
  expect(reread.status).toBe("pending");
  const capacityAfter = (await after.json()).capacity;
  expect(capacityAfter).toMatchObject({ filled: 0, full: false });
  await api.dispose();

  // ---- Apres rechargement, l'ecran dit toujours la verite du serveur ----
  await page.reload();
  await expect(candidate(page)).toContainText("En attente");
  await expect(capacity(page)).toHaveText("0 poste pourvu sur 1.");
  await shot("06-mission-B-etat-final-apres-rechargement");

  // ---- État final des deux missions, vu de chaque entreprise ----
  await logout(page);
  await signIn(page, `engage.a.${suffix}@example.test`, "company");
  await openMission(page, MISSION_A);
  await expect(candidate(page)).toContainText("Acceptée");
  await expect(capacity(page)).toHaveText(
    "Tous les postes sont pourvus (1 sur 1).",
  );
  await shot("07-mission-A-etat-final");

  // ---- Vue intérimaire après le conflit ----
  await logout(page);
  await signIn(page, `engage.worker.${suffix}@example.test`, "worker");
  await page.goto("/worker/applications");
  await expect(page.getByText("Acceptée", { exact: true })).toHaveCount(1);
  await expect(page.getByText("En attente", { exact: true })).toHaveCount(1);
  await shot("08-worker-vue-apres-conflit");

  expect(serverFailures).toEqual([]);
  expect(errors).toEqual([]);
});
