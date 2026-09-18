import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { MissionCard } from "../components/mission/MissionCard";
import {
  canCancel,
  canEdit,
  cancelMission,
  describeSpan,
  canPublish,
  emptyMission,
  explainEmpty,
  formToMission,
  missionDaysOfMonth,
  missionDiff,
  missionStatePresentation,
  missionTabs,
  missionTabOf,
  missionTemporalState,
  missionToForm,
  searchMissions,
  upcomingMissions,
  validateMission,
  type Mission,
  type MissionFormValues,
  type MissionStatus,
} from "./missions";

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: over.id ?? "m1",
  title: "Serveur en restauration",
  description: "",
  job: "serveur",
  starts_at: new Date(Date.now() + 86_400_000).toISOString(),
  ends_at: new Date(Date.now() + 86_400_000 + 6 * 3600_000).toISOString(),
  address: "",
  city: "Lyon",
  postal_code: "69002",
  latitude: 45.75,
  longitude: 4.85,
  pay_amount: null,
  pay_unit: null,
  headcount: 1,
  min_years_experience: null,
  status: "open",
  published_at: null,
  demo: false,
  skills: [],
  ...over,
});

describe("recherche de missions", () => {
  const data = [
    mission({ id: "a", title: "Serveur en restauration", city: "Lyon" }),
    mission({
      id: "b",
      title: "Commis de cuisine",
      city: "Villeurbanne",
      postal_code: "69100",
      job: "commis_cuisine",
    }),
  ];

  it("rend la liste inchangée sans requête", () => {
    expect(searchMissions(data, "")).toHaveLength(2);
    expect(searchMissions(data, "   ")).toHaveLength(2);
  });

  it("cherche dans l'intitulé, la ville, le code postal et le métier", () => {
    expect(searchMissions(data, "commis").map((m) => m.id)).toEqual(["b"]);
    expect(searchMissions(data, "villeurbanne").map((m) => m.id)).toEqual([
      "b",
    ]);
    expect(searchMissions(data, "69002").map((m) => m.id)).toEqual(["a"]);
    expect(searchMissions(data, "serveur").map((m) => m.id)).toEqual(["a"]);
  });

  it("ignore la casse et les espaces autour", () => {
    expect(searchMissions(data, "  LYON ").map((m) => m.id)).toEqual(["a"]);
  });

  it("renvoie une liste vide quand rien ne correspond", () => {
    expect(searchMissions(data, "plongeur")).toEqual([]);
  });
});

describe("prochaines missions", () => {
  it("écarte le passé et les missions annulées", () => {
    const past = mission({
      id: "passee",
      starts_at: new Date(Date.now() - 172_800_000).toISOString(),
      ends_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const cancelled = mission({ id: "annulee", status: "cancelled" });
    expect(
      upcomingMissions([past, cancelled, mission({ id: "a" })]).map(
        (m) => m.id,
      ),
    ).toEqual(["a"]);
  });

  it("classe de la plus proche à la plus lointaine et limite le nombre", () => {
    const far = mission({
      id: "loin",
      starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 30 * 86_400_000 + 3600_000).toISOString(),
    });
    const soon = mission({ id: "proche" });
    expect(upcomingMissions([far, soon]).map((m) => m.id)).toEqual([
      "proche",
      "loin",
    ]);
    expect(upcomingMissions([far, soon], 1).map((m) => m.id)).toEqual([
      "proche",
    ]);
  });

  it("supporte une liste vide", () => {
    expect(upcomingMissions([])).toEqual([]);
  });

  it("écarte les brouillons et les missions déjà terminées", () => {
    // Les statuts `completed` et `filled` ne sont jamais écrits : une mission
    // terminée est une mission `open` dont les dates sont passées, et une
    // mission pourvue reste `open` avec sa capacité pleine. Le test décrit
    // désormais ces réponses-là, et non deux statuts que le serveur ne produit
    // pas.
    const passe = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(
      upcomingMissions([
        mission({ id: "draft", status: "draft" }),
        mission({
          id: "done",
          status: "open",
          starts_at: passe,
          ends_at: passe,
        }),
        mission({ id: "open", status: "open" }),
        // Pourvue, mais bel et bien planifiée : elle doit rester au planning.
        mission({
          id: "filled",
          status: "open",
          capacity: { headcount: 1, filled: 1, remaining: 0, full: true },
        }),
      ]).map((item) => item.id),
    ).toEqual(["open", "filled"]);
  });
});

describe("cycle de vie affiché", () => {
  const now = Date.parse("2027-06-12T12:00:00.000Z");
  const at = (status: MissionStatus, starts_at: string, ends_at: string) =>
    mission({ status, starts_at, ends_at });

  /**
   * Une mission dont tous les postes sont pris, telle que le serveur la sert.
   *
   * Le statut reste `open` : être pourvue décrit le recrutement, pas le cycle
   * de vie. Les tests construisaient auparavant `status: "filled"` — une
   * réponse que le backend ne produit jamais — et vérifiaient donc que
   * l'interface savait lire une fiction.
   */
  const pourvue = (starts_at: string, ends_at: string) =>
    mission({
      status: "open",
      starts_at,
      ends_at,
      capacity: { headcount: 1, filled: 1, remaining: 0, full: true },
    });

  it("distingue à venir, en cours, terminée et annulée", () => {
    expect(
      missionTemporalState(
        at("open", "2027-06-13T10:00:00Z", "2027-06-13T18:00:00Z"),
        now,
      ),
    ).toBe("upcoming");
    expect(
      missionTemporalState(
        at("open", "2027-06-12T10:00:00Z", "2027-06-12T18:00:00Z"),
        now,
      ),
    ).toBe("running");
    expect(
      missionTemporalState(
        at("open", "2027-06-11T10:00:00Z", "2027-06-11T18:00:00Z"),
        now,
      ),
    ).toBe("completed");
    expect(
      missionTemporalState(
        at("cancelled", "2027-06-13T10:00:00Z", "2027-06-13T18:00:00Z"),
        now,
      ),
    ).toBe("cancelled");
  });

  it("présente recrutement et temporalité sans remplacer le statut serveur", () => {
    expect(
      missionStatePresentation(
        at("open", "2027-06-13T10:00:00Z", "2027-06-13T18:00:00Z"),
        now,
      ).label,
    ).toBe("À pourvoir");
    // REGRESSION. Statut écrit `open`, capacité pleine : c'est exactement ce que
    // le serveur renvoie, et l'écran doit dire « Pourvue ». Il disait
    // « À pourvoir », au-dessus d'un encart annonçant que tout était pris.
    const complete = missionStatePresentation(
      pourvue("2027-06-13T10:00:00Z", "2027-06-13T18:00:00Z"),
      now,
    );
    expect(complete.label).toBe("Pourvue");
    expect(complete.label).not.toBe("À pourvoir");
    // Le statut écrit n'a pas bougé pour autant.
    expect(pourvue("2027-06-13T10:00:00Z", "2027-06-13T18:00:00Z").status).toBe(
      "open",
    );
    expect(
      missionStatePresentation(
        at("open", "2027-06-12T10:00:00Z", "2027-06-12T18:00:00Z"),
        now,
      ).label,
    ).toBe("En cours");
    expect(
      missionStatePresentation(
        at("draft", "2027-06-11T10:00:00Z", "2027-06-11T18:00:00Z"),
        now,
      ).label,
    ).toBe("Brouillon expiré");
  });

  /**
   * La capacite pleine ne prend jamais le pas sur la fin du cycle.
   *
   * La cascade repond, dans l ordre : annulee, brouillon, terminee, en cours,
   * pourvue, a pourvoir. « Pourvue » arrive donc APRES « annulee » et
   * « terminee », et ce test existe pour que cet ordre reste un choix plutot
   * qu un accident — la fiche entreprise l avait contourne en forcant le
   * libelle chez elle.
   */
  it("ne laisse pas la capacite pleine ecraser annulee ni terminee", () => {
    const full = { headcount: 1, filled: 1, remaining: 0, full: true };

    // CAS A : publiee, a venir, pleine => « Pourvue ».
    expect(
      missionStatePresentation(
        mission({
          status: "open",
          starts_at: "2027-06-13T10:00:00Z",
          ends_at: "2027-06-13T18:00:00Z",
          capacity: full,
        }),
        now,
      ).label,
    ).toBe("Pourvue");

    // CAS B : publiee, creneau passe, pleine => « Terminee ».
    expect(
      missionStatePresentation(
        mission({
          status: "open",
          starts_at: "2027-06-11T10:00:00Z",
          ends_at: "2027-06-11T18:00:00Z",
          capacity: full,
        }),
        now,
      ).label,
    ).toBe("Terminée");

    // CAS C : annulee, pleine => « Annulee ».
    expect(
      missionStatePresentation(
        mission({
          status: "cancelled",
          starts_at: "2027-06-13T10:00:00Z",
          ends_at: "2027-06-13T18:00:00Z",
          capacity: full,
        }),
        now,
      ).label,
    ).toBe("Annulée");

    // CAS D : publiee, a venir, de la place => presentation normale.
    expect(
      missionStatePresentation(
        mission({
          status: "open",
          starts_at: "2027-06-13T10:00:00Z",
          ends_at: "2027-06-13T18:00:00Z",
          capacity: { headcount: 2, filled: 1, remaining: 1, full: false },
        }),
        now,
      ).label,
    ).toBe("À pourvoir");
  });

  it("rend les états en toutes lettres sur les cartes", () => {
    const render = (item: Mission) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(MissionCard, { mission: item }),
        ),
      );
    expect(
      render(pourvue("2097-06-13T10:00:00Z", "2097-06-13T18:00:00Z")),
    ).toContain("Pourvue");
    expect(
      render(pourvue("2097-06-13T10:00:00Z", "2097-06-13T18:00:00Z")),
    ).toContain("À venir");
    expect(
      render(at("cancelled", "2097-06-13T10:00:00Z", "2097-06-13T18:00:00Z")),
    ).toContain("Annulée");
    expect(
      render(at("open", "2020-06-11T10:00:00Z", "2020-06-11T18:00:00Z")),
    ).toContain("Terminée");
  });
});

describe("jours marqués du calendrier", () => {
  it("ne retient que les missions du mois affiché", () => {
    const start = new Date(2027, 2, 14, 16, 0, 0);
    const other = new Date(2027, 3, 2, 16, 0, 0);
    const days = missionDaysOfMonth(
      [
        mission({ id: "a", starts_at: start.toISOString() }),
        mission({ id: "b", starts_at: other.toISOString() }),
      ],
      2027,
      2,
    );
    expect([...days]).toEqual([14]);
  });

  it("ne renvoie rien pour un mois sans mission", () => {
    expect(missionDaysOfMonth([], 2027, 0).size).toBe(0);
  });
});

describe("onglets de la maquette", () => {
  it("couvre les groupes affichables", () => {
    const keys = missionTabs.map((t) => t.key);
    expect(keys).toEqual(["open", "filled", "completed", "draft", "cancelled"]);
    for (const tab of missionTabs) expect(tab.label.length).toBeGreaterThan(0);
  });

  /**
   * Les onglets filtraient sur `mission.status`. Comme `filled` et `completed`
   * ne sont jamais écrits, une mission réellement pourvue restait `open` :
   * « Pourvues » et « Terminées » étaient vides par construction, alors que la
   * fiche de la même mission affichait bien « Pourvue ».
   */
  it("range une mission pourvue dans « Pourvues », statut écrit inchangé", () => {
    const pleine = mission({
      status: "open",
      group: "filled",
      capacity: { headcount: 1, filled: 1, remaining: 0, full: true },
    });
    expect(pleine.status).toBe("open");
    expect(missionTabOf(pleine)).toBe("filled");
  });

  it("range une mission passée dans « Terminées »", () => {
    const passee = mission({ status: "open", group: "completed" });
    expect(missionTabOf(passee)).toBe("completed");
  });

  it("suit le groupe décidé par le serveur, jamais le statut écrit", () => {
    // Si l'interface recalculait, elle rangerait celle-ci dans « Publiées ».
    expect(missionTabOf(mission({ status: "open", group: "filled" }))).toBe(
      "filled",
    );
    expect(missionTabOf(mission({ status: "open", group: "open" }))).toBe(
      "open",
    );
  });

  it("garde brouillon et annulation à leur place", () => {
    expect(missionTabOf(mission({ status: "draft", group: "draft" }))).toBe(
      "draft",
    );
    expect(
      missionTabOf(mission({ status: "cancelled", group: "cancelled" })),
    ).toBe("cancelled");
  });

  it("n'attribue qu'un seul onglet par mission", () => {
    // L'exclusivité est ce qui permet aux compteurs d'être la taille réelle des
    // listes : une mission comptée deux fois ferait mentir le total.
    const cas = [
      mission({ id: "a", group: "open" }),
      mission({ id: "b", group: "filled" }),
      mission({ id: "c", group: "completed" }),
      mission({ id: "d", group: "draft", status: "draft" }),
      mission({ id: "e", group: "cancelled", status: "cancelled" }),
    ];
    const onglets = cas.map(missionTabOf);
    expect(new Set(onglets).size).toBe(cas.length);
    for (const onglet of onglets)
      expect(missionTabs.map((t) => t.key)).toContain(onglet);
  });

  it("ne présente jamais une mission pourvue comme encore recrutante", () => {
    // La contradiction exacte signalée : rangée dans « Pourvues » d'un côté,
    // annoncée « À pourvoir » de l'autre.
    const pleine = mission({
      status: "open",
      group: "filled",
      recruiting: false,
      capacity: { headcount: 2, filled: 2, remaining: 0, full: true },
    });
    expect(missionTabOf(pleine)).toBe("filled");
    expect(missionStatePresentation(pleine).label).toBe("Pourvue");
    expect(pleine.recruiting).toBe(false);
  });

  it("se rabat sur le statut écrit si le serveur n'envoie pas de groupe", () => {
    // Compatibilité ascendante, sans recalcul : seuls les deux cas où statut et
    // groupe coïncident par construction sont déduits.
    expect(missionTabOf(mission({ status: "draft", group: undefined }))).toBe(
      "draft",
    );
    expect(
      missionTabOf(mission({ status: "cancelled", group: undefined })),
    ).toBe("cancelled");
    expect(missionTabOf(mission({ status: "open", group: undefined }))).toBe(
      "open",
    );
  });
});

describe("actions de cycle de vie de l'entreprise", () => {
  const now = Date.parse("2027-06-12T12:00:00.000Z");
  const future = "2027-06-15T10:00:00.000Z";
  const past = "2027-06-10T10:00:00.000Z";

  it("canPublish autorise uniquement les brouillons non commencés", () => {
    expect(
      canPublish(mission({ status: "draft", starts_at: future }), now),
    ).toBe(true);
    expect(canPublish(mission({ status: "draft", starts_at: past }), now)).toBe(
      false,
    );
    expect(
      canPublish(mission({ status: "open", starts_at: future }), now),
    ).toBe(false);
  });

  it("canEdit autorise les brouillons et missions publiées non terminées", () => {
    expect(canEdit(mission({ status: "draft", ends_at: future }), now)).toBe(
      true,
    );
    expect(canEdit(mission({ status: "open", ends_at: future }), now)).toBe(
      true,
    );
    expect(canEdit(mission({ status: "open", ends_at: past }), now)).toBe(
      false,
    );
    expect(
      canEdit(mission({ status: "cancelled", ends_at: future }), now),
    ).toBe(false);
    expect(
      canEdit(mission({ status: "completed", ends_at: future }), now),
    ).toBe(false);
  });

  it("canCancel autorise uniquement les missions publiées non commencées", () => {
    expect(canCancel(mission({ status: "open", starts_at: future }), now)).toBe(
      true,
    );
    expect(canCancel(mission({ status: "open", starts_at: past }), now)).toBe(
      false,
    );
    expect(
      canCancel(mission({ status: "draft", starts_at: future }), now),
    ).toBe(false);
    expect(
      canCancel(mission({ status: "cancelled", starts_at: future }), now),
    ).toBe(false);
    expect(
      canCancel(mission({ status: "completed", starts_at: future }), now),
    ).toBe(false);
  });

  it("cancelMission déclenche un appel POST sans corps sur /missions/:id/cancel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "m123", status: "cancelled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await cancelMission("m123");
      expect(result.status).toBe("cancelled");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/missions/m123/cancel");
      expect(init?.method).toBe("POST");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// SL2b — saisie d'une mission : conversion, écarts, validations.
// ---------------------------------------------------------------------------

/**
 * Dates fixes, données en heure locale : le rendu et les conversions ne
 * dépendent alors ni de l'heure d'exécution ni du fuseau de la machine.
 */
const localIso = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

const stored = (over: Partial<Mission> = {}): Mission =>
  mission({
    title: "Serveur en salle",
    description: "Service du soir",
    job: "serveur",
    starts_at: localIso(2027, 2, 14, 18),
    ends_at: localIso(2027, 2, 15, 2),
    address: "12 rue de la Ré",
    city: "Lyon",
    postal_code: "69002",
    pay_amount: "13.50",
    pay_unit: "hour",
    headcount: 3,
    min_years_experience: "2",
    skills: [
      { id: "s1", name: "Service en salle", required: true },
      { id: "s2", name: "Relation client", required: false },
    ],
    ...over,
  });

describe("préremplissage du formulaire", () => {
  it("reprend chaque champ de la mission enregistrée", () => {
    const form = missionToForm(stored());
    expect(form.title).toBe("Serveur en salle");
    expect(form.job).toBe("serveur");
    expect(form.city).toBe("Lyon");
    expect(form.postal_code).toBe("69002");
    expect(form.headcount).toBe("3");
    // Les numériques arrivent en chaîne depuis PostgreSQL : « 13.50 » saisi
    // tel quel afficherait un zéro parasite dans le champ.
    expect(form.pay_amount).toBe("13.5");
    expect(form.pay_unit).toBe("hour");
    expect(form.min_years_experience).toBe("2");
  });

  it("restitue l'horaire en heure locale, minuit franchi compris", () => {
    const form = missionToForm(stored());
    expect(form.starts_at).toBe("2027-03-14T18:00");
    expect(form.ends_at).toBe("2027-03-15T02:00");
  });

  it("classe chaque compétence à un seul niveau", () => {
    expect(missionToForm(stored()).skills).toEqual({
      s1: "required",
      s2: "desired",
    });
  });

  it("supporte une mission sans rémunération ni expérience", () => {
    const form = missionToForm(
      stored({ pay_amount: null, pay_unit: null, min_years_experience: null }),
    );
    expect(form.pay_amount).toBe("");
    expect(form.pay_unit).toBe("");
    expect(form.min_years_experience).toBe("");
  });
});

describe("corps envoyé à l'API", () => {
  it("n'envoie aucun champ décidé par le serveur", () => {
    const keys = Object.keys(formToMission(missionToForm(stored()))).sort();
    for (const forbidden of [
      "company_id",
      "status",
      "latitude",
      "longitude",
      "geocoded_at",
      "published_at",
      "demo",
      "id",
    ])
      expect(keys).not.toContain(forbidden);
    expect(keys).toEqual([
      "address",
      "city",
      "description",
      "desired_skill_ids",
      "ends_at",
      "headcount",
      "job",
      "min_years_experience",
      "pay_amount",
      "pay_unit",
      "postal_code",
      "required_skill_ids",
      "starts_at",
      "title",
    ]);
  });

  it("sépare les compétences obligatoires des souhaitées", () => {
    const sent = formToMission({
      ...emptyMission,
      skills: { s1: "required", s2: "desired", s3: "required" },
    });
    expect(sent.required_skill_ids).toEqual(["s1", "s3"]);
    expect(sent.desired_skill_ids).toEqual(["s2"]);
  });

  it("ne peut pas placer une compétence dans les deux listes", () => {
    // Le niveau écrase le précédent : la forme même du choix l'interdit.
    const sent = formToMission({
      ...emptyMission,
      skills: { s1: "desired" },
    });
    expect(sent.required_skill_ids).toEqual([]);
    expect(sent.desired_skill_ids).toEqual(["s1"]);
    expect(
      sent.required_skill_ids.filter((id) =>
        sent.desired_skill_ids.includes(id),
      ),
    ).toEqual([]);
  });

  it("convertit les champs vides en null plutôt qu'en zéro", () => {
    const sent = formToMission({ ...emptyMission, city: "Lyon" });
    expect(sent.pay_amount).toBeNull();
    expect(sent.pay_unit).toBeNull();
    expect(sent.min_years_experience).toBeNull();
    expect(sent.headcount).toBe(1);
  });

  it("fait l'aller-retour sans altérer la mission", () => {
    const before = stored();
    const sent = formToMission(missionToForm(before));
    expect(sent.starts_at).toBe(before.starts_at);
    expect(sent.ends_at).toBe(before.ends_at);
    expect(sent.pay_amount).toBe(13.5);
    expect(sent.headcount).toBe(3);
    expect(sent.required_skill_ids).toEqual(["s1"]);
  });
});

describe("écart envoyé en modification", () => {
  const base = () => formToMission(missionToForm(stored()));

  it("ne renvoie rien quand rien n'a changé", () => {
    expect(missionDiff(base(), base())).toEqual({});
  });

  it("ne renvoie que les champs réellement modifiés", () => {
    const after = { ...base(), title: "Chef de rang" };
    expect(missionDiff(base(), after)).toEqual({ title: "Chef de rang" });
  });

  it("n'annonce pas un déménagement quand la ville est retapée à l'identique", () => {
    // Un géocodage serveur serait déclenché pour rien.
    const after = { ...base(), city: "Lyon", postal_code: "69002" };
    expect(missionDiff(base(), after)).toEqual({});
  });

  it("détecte un changement de compétences", () => {
    const after = { ...base(), required_skill_ids: ["s1", "s4"] };
    expect(missionDiff(base(), after)).toEqual({
      required_skill_ids: ["s1", "s4"],
    });
  });

  it("transmet un effacement volontaire de la rémunération", () => {
    const after = { ...base(), pay_amount: null, pay_unit: null };
    expect(missionDiff(base(), after)).toEqual({
      pay_amount: null,
      pay_unit: null,
    });
  });
});

describe("validations de saisie", () => {
  const filled = (): MissionFormValues => ({
    ...emptyMission,
    title: "Serveur en salle",
    job: "serveur",
    starts_at: "2027-03-14T18:00",
    ends_at: "2027-03-15T02:00",
    city: "Lyon",
    postal_code: "69002",
  });

  it("accepte un formulaire complet", () => {
    expect(validateMission(filled())).toEqual({});
  });

  it("réclame les champs nécessaires", () => {
    const errors = validateMission(emptyMission);
    expect(Object.keys(errors).sort()).toEqual([
      "city",
      "ends_at",
      "job",
      "postal_code",
      "starts_at",
      "title",
    ]);
  });

  it("refuse une fin antérieure au début", () => {
    const errors = validateMission({
      ...filled(),
      ends_at: "2027-03-14T17:00",
    });
    expect(errors.ends_at).toBe("La fin doit suivre le début.");
  });

  it("accepte un créneau qui franchit minuit", () => {
    // Le service du soir est le cas courant : il ne doit jamais être refusé.
    expect(validateMission(filled()).ends_at).toBeUndefined();
  });

  it("refuse un code postal mal formé", () => {
    expect(
      validateMission({ ...filled(), postal_code: "690" }).postal_code,
    ).toBeTruthy();
  });

  it("exige le montant et son unité ensemble", () => {
    expect(
      validateMission({ ...filled(), pay_amount: "13.5" }).pay_amount,
    ).toBeTruthy();
    expect(
      validateMission({ ...filled(), pay_unit: "hour" }).pay_amount,
    ).toBeTruthy();
    expect(
      validateMission({ ...filled(), pay_amount: "13.5", pay_unit: "hour" })
        .pay_amount,
    ).toBeUndefined();
  });

  it("borne l'effectif", () => {
    expect(
      validateMission({ ...filled(), headcount: "0" }).headcount,
    ).toBeTruthy();
    expect(
      validateMission({ ...filled(), headcount: "80" }).headcount,
    ).toBeTruthy();
    expect(
      validateMission({ ...filled(), headcount: "12" }).headcount,
    ).toBeUndefined();
  });
});

describe("actions proposées selon le statut", () => {
  it("ne propose la publication que sur un brouillon", () => {
    expect(canPublish(mission({ status: "draft" }))).toBe(true);
    for (const status of ["open", "filled", "completed", "cancelled"] as const)
      expect(canPublish(mission({ status }))).toBe(false);
  });

  it("ne propose plus la modification d'une mission close", () => {
    expect(canEdit(mission({ status: "draft" }))).toBe(true);
    expect(canEdit(mission({ status: "open" }))).toBe(true);
    expect(canEdit(mission({ status: "completed" }))).toBe(false);
    expect(canEdit(mission({ status: "cancelled" }))).toBe(false);
  });
});

describe("explication d'un écran vide", () => {
  it("ne dit rien quand aucune mission n'a été écartée", () => {
    // Il n'y a alors rien à expliquer : aucune mission n'est publiée, et
    // inventer un motif tromperait.
    expect(explainEmpty({ total: 0, reasons: {} })).toBeNull();
    expect(explainEmpty(undefined)).toBeNull();
  });

  it("nomme la disponibilité quand c'est elle qui bloque", () => {
    // Le cas vécu en production : profil complet, compatible, mais dont le
    // créneau commence après la mission.
    const reason = explainEmpty({ total: 1, reasons: { unavailable: 1 } });
    expect(reason?.code).toBe("unavailable");
    expect(reason?.title).toContain("disponibilités");
    expect(reason?.action.to).toBe("/worker/profile#disponibilites");
  });

  it("accorde le texte au nombre de missions concernées", () => {
    expect(
      explainEmpty({ total: 1, reasons: { out_of_range: 1 } })?.detail,
    ).toContain("1 mission ouverte se situe");
    expect(
      explainEmpty({ total: 3, reasons: { out_of_range: 3 } })?.detail,
    ).toContain("3 missions ouvertes se situent");
  });

  it("retient le motif qui explique le plus de missions", () => {
    expect(
      explainEmpty({
        total: 5,
        reasons: { unavailable: 1, missing_required_skills: 4 },
      })?.code,
    ).toBe("missing_required_skills");
  });

  it("fait passer la pause avant tout le reste", () => {
    // Elle coupe l'ensemble des propositions : corriger un autre motif ne
    // changerait rien tant qu'elle dure.
    expect(
      explainEmpty({
        total: 9,
        reasons: { paused: 9, unavailable: 8, out_of_range: 7 },
      })?.code,
    ).toBe("paused");
  });

  it("ne promet jamais de mission", () => {
    // Un état vide explique ce qui bloque ; il ne garantit pas ce qui suivra.
    for (const reasons of [
      { paused: 1 },
      { unavailable: 2 },
      { out_of_range: 2 },
      { missing_required_skills: 2 },
    ]) {
      const reason = explainEmpty({ total: 2, reasons });
      expect(reason).not.toBeNull();
      expect(reason!.detail).not.toMatch(
        /garanti|assur|vous recevrez|obtiendrez/i,
      );
    }
  });
});

/**
 * Rappel du créneau saisi.
 *
 * C'est le garde-fou contre la faute la plus coûteuse du formulaire : publier
 * une mission sur le mauvais jour parce que « 18:00 → 02:00 » ne dit pas de
 * lui-même qu'il s'agit du lendemain.
 */
describe("description d un creneau", () => {
  it("dit la duree d un service dans la journee", () => {
    expect(describeSpan("2027-10-15T10:00", "2027-10-15T18:00")).toBe(
      "8 h de service.",
    );
  });

  it("signale le passage de minuit", () => {
    expect(describeSpan("2027-10-15T18:00", "2027-10-16T02:00")).toBe(
      "8 h de service, en passant minuit.",
    );
  });

  it("garde les minutes quand il y en a", () => {
    expect(describeSpan("2027-10-15T10:00", "2027-10-15T18:30")).toBe(
      "8 h 30 de service.",
    );
  });

  it("gere un service de moins d une heure", () => {
    expect(describeSpan("2027-10-15T10:00", "2027-10-15T10:45")).toBe(
      "45 min de service.",
    );
  });

  it("ne dit rien tant que la saisie est incomplete ou incoherente", () => {
    // Mieux vaut se taire que d affirmer une duree negative : l erreur de
    // validation, elle, dira quoi corriger.
    expect(describeSpan("", "2027-10-15T18:00")).toBeNull();
    expect(describeSpan("2027-10-15T18:00", "")).toBeNull();
    expect(describeSpan("pas-une-date", "2027-10-15T18:00")).toBeNull();
    expect(describeSpan("2027-10-15T18:00", "2027-10-15T10:00")).toBeNull();
    expect(describeSpan("2027-10-15T18:00", "2027-10-15T18:00")).toBeNull();
  });
});
