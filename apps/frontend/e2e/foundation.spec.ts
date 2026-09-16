import { test, expect } from "@playwright/test";
test("public login/register and anonymous guard", async ({ page }) => {
  await page.goto("/worker");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Me connecter" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Créer un compte", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Créer mon compte" }),
  ).toBeVisible();
  await page.goto("/company");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("unknown@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});
for (const role of ["worker", "company"] as const)
  test(`${role} full registration, onboarding, persistence and logout`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/register");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`${role}.${crypto.randomUUID()}@example.test`);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("Browser-test-password-42!");
    await page
      .getByLabel("Confirmer le mot de passe")
      .fill("Browser-test-password-42!");
    await page
      .getByRole("button", { name: "Créer mon compte", exact: true })
      .click();
    await expect(page).toHaveURL(/onboarding\/role$/);
    await page
      .getByRole("button", {
        name:
          role === "worker"
            ? /Je cherche des missions/
            : /Je cherche des talents/,
      })
      .click();
    await expect(page).toHaveURL(new RegExp("onboarding/" + role + "$"));
    // Incomplete profiles cannot bypass onboarding.
    await page.goto("/" + role);
    await expect(page).toHaveURL(new RegExp("onboarding/" + role + "$"));
    await page.getByLabel("Prénom", { exact: true }).fill("Jimmy");
    await page.getByLabel("Nom", { exact: true }).fill("Démonstration");
    if (role === "worker") {
      await page.getByLabel("Métier principal").fill("Serveur");
      await page.getByLabel("Service en salle", { exact: true }).check();
      await page.getByLabel("Rayon de mobilité").fill("15");
      await page.getByLabel("Début de disponibilité").fill("2027-01-02T12:00");
      await page.getByLabel("Fin de disponibilité").fill("2027-01-02T20:00");
    } else {
      await page.getByLabel("Raison sociale").fill("Société fictive");
      await page
        .getByLabel("Nom de l’établissement")
        .fill("Restaurant de démonstration");
      await page.getByLabel("Adresse", { exact: true }).fill("Adresse fictive");
      await page.getByLabel("Téléphone").fill("+33000000000");
    }
    await page.getByLabel("Ville", { exact: true }).fill("Lyon");
    await page.getByLabel("Code postal").fill("69002");
    await page.getByLabel("Latitude", { exact: true }).fill("45.75");
    await page.getByLabel("Longitude", { exact: true }).fill("4.85");
    await page
      .getByRole("button", { name: "Enregistrer et découvrir mon espace" })
      .click();
    await expect(page).toHaveURL(new RegExp("/" + role + "$"));
    await expect(
      page.getByRole("heading", { name: "Bonjour Jimmy," }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Bonjour Jimmy," }),
    ).toBeVisible();
    await page.goto(role === "worker" ? "/company" : "/worker");
    await expect(page).toHaveURL(new RegExp("/" + role + "$"));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(role + ".png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Voir mon profil" }).click();
    await expect(
      page.getByRole("heading", { name: "Votre profil professionnel" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/" + role);
    await expect(page).toHaveURL(/\/login$/);
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
