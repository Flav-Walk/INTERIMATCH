import { test, expect } from "@playwright/test";

test.describe("Conformité légale, SEO et accessibilité (Lot 8)", () => {
  test("les pages légales sont accessibles publiquement et navigables depuis le footer", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/InteriMatch/);

    const footer = page.locator("footer.shell-footer");
    await footer.getByRole("link", { name: "Mentions légales" }).click();
    await expect(page).toHaveURL(/\/mentions-legales$/);
    await expect(
      page.getByRole("heading", { name: "Mentions légales", level: 1 }),
    ).toBeVisible();

    await footer
      .getByRole("link", { name: "Politique de confidentialité" })
      .click();
    await expect(page).toHaveURL(/\/politique-confidentialite$/);
    await expect(
      page.getByRole("heading", {
        name: "Politique de confidentialité",
        level: 1,
      }),
    ).toBeVisible();

    await footer
      .getByRole("link", { name: "Accessibilité : non conforme" })
      .click();
    await expect(page).toHaveURL(/\/accessibilite$/);
    await expect(
      page.getByRole("heading", {
        name: "Déclaration d’accessibilité",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".legal-notice-box"),
    ).toContainText("Accessibilité : non conforme");
  });

  test("une route inconnue affiche la page 404 avec la directive noindex", async ({
    page,
  }) => {
    await page.goto("/page-inexistante-pour-test-404");
    await expect(
      page.getByRole("heading", { name: "Page introuvable", level: 1 }),
    ).toBeVisible();
    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute("content", "noindex,nofollow");
    await page.getByRole("link", { name: "Revenir à l’accueil" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("les fichiers robots.txt et sitemap.xml sont servis statiquement", async ({
    request,
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("User-agent: *");
    expect(robotsBody).toContain("Disallow: /worker");
    expect(robotsBody).toContain(
      "Sitemap: https://interimatch-five.vercel.app/sitemap.xml",
    );

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(sitemapBody).toContain(
      "https://interimatch-five.vercel.app/mentions-legales",
    );
  });
});
