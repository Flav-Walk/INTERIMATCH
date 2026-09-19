import { expect, test, type Page, type Route } from "@playwright/test";

const workerUser = {
  id: "worker-test-id",
  email: "worker.public@example.test",
  role: "worker" as const,
  first_name: "Camille",
  last_name: "Interim",
  onboarding_completed: true,
  tour_version: 99,
  demo: false,
  profile: {
    city: "Lyon",
    postal_code: "69002",
    mobility_radius_km: 30,
    main_job: "serveur",
  },
};

const publicOffers = [
  {
    id: "uuid-ft-1",
    source: "france_travail",
    external_id: "213HXKM",
    title: "Serveur / Serveuse (H/F)",
    description:
      "Mise en place de la salle, prise de commande, accueil et service.",
    rome_code: "G1803",
    rome_label: "Serveur / Serveuse en restauration",
    company_name: "RAS 420",
    contract_type: "MIS",
    contract_label: "Intérim - 6 Mois",
    experience_label: "3 Mois",
    postal_code: "69002",
    city: "69 - LYON",
    latitude: 45.753267,
    longitude: 4.826881,
    salary_label: "Horaire de 12.31 Euros sur 12 mois",
    working_time: "Temps plein",
    positions: 1,
    skills: [
      { name: "Accueillir le client et l'installer", required: false },
      { name: "Prendre une commande client", required: true },
    ],
    professional_qualities: [
      {
        label: "Avoir l'esprit d'équipe",
        description: "Capacité à collaborer",
      },
    ],
    source_url:
      "https://candidat.francetravail.fr/offres/recherche/detail/213HXKM",
    created_at_source: "2026-09-03T10:18:09.236Z",
    updated_at_source: "2026-09-03T10:24:24.192Z",
    imported_at: "2026-09-18T17:11:45.000Z",
  },
  {
    id: "uuid-ft-2",
    source: "france_travail",
    external_id: "6741918",
    title: "Chef de rang (H/F)",
    description: "Orchestre le service des tables au sein du restaurant.",
    rome_code: "G1810",
    rome_label: "Chef / Cheffe de rang",
    company_name: null, // Donnée partielle : entreprise absente
    contract_type: "MIS",
    contract_label: "Intérim - 5 Jour(s)",
    experience_label: "Débutant accepté",
    postal_code: "69005",
    city: "69 - Lyon 5e Arrondissement",
    latitude: null, // Coordonnées absentes
    longitude: null,
    salary_label: null, // Salaire absent
    working_time: null,
    positions: 1,
    skills: [], // Compétences absentes
    professional_qualities: [],
    source_url:
      "https://candidat.francetravail.fr/offres/recherche/detail/6741918",
    created_at_source: "2026-09-09T03:29:18.937Z",
    updated_at_source: "2026-09-09T03:29:18.937Z",
    imported_at: "2026-09-18T17:11:45.000Z",
  },
];

async function setupWorkerSession(
  page: Page,
  mode: "normal" | "empty" | "error" | "malicious" = "normal",
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: data,
      });

    if (path === "/auth/refresh") return json({ access_token: "test-token" });
    if (path === "/me") return json(workerUser);
    if (path === "/reference") {
      return json({
        sectors: [{ value: "restauration", label: "Restauration" }],
        jobs: [{ value: "serveur", label: "Serveur" }],
      });
    }
    if (path === "/workers/me/open-missions") {
      return json({ missions: [], excluded: {} });
    }
    if (path === "/workers/me/applications") {
      return json({ applications: [] });
    }
    if (path === "/public-job-offers") {
      if (mode === "error")
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          json: {
            error: { code: "INTERNAL_ERROR", message: "Service indisponible." },
          },
        });
      if (mode === "empty")
        return json({
          offers: [],
          total: 0,
          page: 1,
          limit: 12,
          total_pages: 0,
        });
      if (mode === "malicious")
        return json({
          offers: [
            {
              ...publicOffers[0],
              title: "<script>alert(1)</script>",
              description:
                "<img src=x onerror=alert(1)> &lt;b&gt;texte&lt;/b&gt;",
              source_url: "javascript:alert(1)",
            },
          ],
          total: 1,
          page: 1,
          limit: 12,
          total_pages: 1,
        });
      const q = url.searchParams.get("search")?.toLowerCase() || "";
      const filtered = q
        ? publicOffers.filter(
            (o) =>
              o.title.toLowerCase().includes(q) ||
              o.description.toLowerCase().includes(q) ||
              (o.company_name && o.company_name.toLowerCase().includes(q)),
          )
        : publicOffers;
      return json({
        offers: filtered,
        total: filtered.length,
        page: 1,
        limit: 12,
        total_pages: 1,
      });
    }
    if (path.startsWith("/public-job-offers/")) {
      const id = path.replace("/public-job-offers/", "");
      const source =
        mode === "malicious"
          ? [
              {
                ...publicOffers[0],
                title: "<script>alert(1)</script>",
                description:
                  "<img src=x onerror=alert(1)> &lt;b&gt;texte&lt;/b&gt;",
                source_url: "javascript:alert(1)",
              },
            ]
          : publicOffers;
      const found = source.find((o) => o.id === id || o.external_id === id);
      if (found) return json(found);
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        json: {
          error: { code: "NOT_FOUND", message: "Offre publique introuvable." },
        },
      });
    }

    return route.continue();
  });
}

test.describe("Exploitation des données publiques France Travail", () => {
  test("intérimaire accède aux offres France Travail, filtre, consulte le détail sans confusion avec InteriMatch", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await setupWorkerSession(page);

    // 1. Accès au tableau de bord intérimaire
    await page.goto("/worker");
    await expect(page).toHaveURL(/\/worker$/);

    // 2. Navigation vers la section "Offres France Travail"
    const navLink = page.getByRole("link", { name: "Offres France Travail" });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL(/\/worker\/public-offers$/);

    // 3. Vérification de l'en-tête et de la bannière de séparation sémantique
    await expect(
      page.getByRole("heading", { name: "Offres France Travail", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("note")).toContainText(
      "Source publique externe",
    );
    await expect(page.getByRole("note")).toContainText(
      "ne font pas l'objet d'un matching automatique",
    );

    // 4. Vérification de la liste et des badges d'origine
    const cards = page.locator(".public-offer-card");
    await expect(cards).toHaveCount(2);

    // Offre 1 : complète
    const card1 = cards.filter({ hasText: "Serveur / Serveuse (H/F)" });
    await expect(card1).toBeVisible();
    await expect(card1.locator(".badge--france-travail")).toContainText(
      "France Travail",
    );
    await expect(card1).toContainText("RAS 420");
    await expect(card1).toContainText("12.31 Euros");

    // Offre 2 : données partielles (entreprise non communiquée, salaire absent)
    const card2 = cards.filter({ hasText: "Chef de rang (H/F)" });
    await expect(card2).toBeVisible();
    await expect(card2).toContainText("Établissement non communiqué");

    // Invariant fondamental : aucune action d'attribution ou de candidature InteriMatch
    await expect(
      page.getByRole("button", { name: "Accepter la mission" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Refuser" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Postuler à la mission" }),
    ).toHaveCount(0);
    await expect(page.locator(".match-badge")).toHaveCount(0);

    // 5. Clic pour consulter le détail de l'offre
    await card1.getByRole("link", { name: "Consulter l’offre" }).click();
    await expect(page).toHaveURL(/\/worker\/public-offers\/uuid-ft-1$/);

    // 6. Vérification de la page de détail
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Serveur / Serveuse (H/F)",
    );
    await expect(page.locator(".public-offer-external-banner")).toContainText(
      "Offre externe France Travail",
    );
    await expect(page.getByText("Description du poste")).toBeVisible();
    await expect(
      page.getByText("Mise en place de la salle, prise de commande"),
    ).toBeVisible();

    // Compétences
    await expect(page.getByText("Compétences mentionnées")).toBeVisible();
    await expect(page.getByText("Prendre une commande client")).toBeVisible();

    // Rail latéral avec bouton source externe vers France Travail
    const externalCta = page.getByRole("link", {
      name: "Postuler sur France Travail",
    });
    await expect(externalCta).toBeVisible();
    await expect(externalCta).toHaveAttribute("target", "_blank");
    await expect(externalCta).toHaveAttribute("rel", "noopener noreferrer");
    await expect(externalCta).toHaveAttribute(
      "href",
      "https://candidat.francetravail.fr/offres/recherche/detail/213HXKM",
    );

    // Toujours aucune action InteriMatch sur le détail
    await expect(
      page.getByRole("button", { name: "Accepter la mission" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Candidater" })).toHaveCount(
      0,
    );

    // 7. Vérification de l'absence d'overflow horizontal
    const hasHorizontalOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 8. Aucune erreur JavaScript non gérée dans la console
    expect(pageErrors).toEqual([]);

    await page
      .getByRole("link", { name: "Offres France Travail", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/worker\/public-offers$/);
  });

  test("affiche honnêtement les états vide et erreur", async ({ page }) => {
    await setupWorkerSession(page, "empty");
    await page.goto("/worker/public-offers");
    await expect(
      page.getByRole("heading", {
        name: "Aucune offre France Travail ne correspond à vos critères",
      }),
    ).toBeVisible();

    await page.unroute("**/api/v1/**");
    await setupWorkerSession(page, "error");
    await page.reload();
    await expect(page.getByRole("alert")).toHaveText("Service indisponible.");
  });

  test("rend le HTML hostile comme texte et neutralise un lien dangereux", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await setupWorkerSession(page, "malicious");
    await page.goto("/worker/public-offers");
    const hostileCard = page.locator(".public-offer-card");
    await expect(hostileCard).toContainText("<script>alert(1)</script>");
    await expect(hostileCard.locator("script")).toHaveCount(0);
    await page.getByRole("link", { name: "Consulter l’offre" }).click();
    await expect(
      page.getByText(/<img src=x onerror=alert\(1\)>/),
    ).toBeVisible();
    await expect(page.locator(".detail-main img")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Postuler sur France Travail" }),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
