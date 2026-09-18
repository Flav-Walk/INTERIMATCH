import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listMissionCandidates,
  type CandidateSelection,
  type MissionCandidate,
} from "../../services/missions";
import { setAccess } from "../../services/session";
import { MatchedProfilesView, selectionSummary } from "./MatchedProfiles";

/**
 * Les paliers tels que le serveur les nomme.
 *
 * La fixture déduisait auparavant le palier du score (`score >= 70 ? 70 : …`).
 * C'était une seconde implémentation de `bandOf()`, dans un fichier de test,
 * avec le défaut exact que SL2c corrige : elle raisonnait sur le score arrondi
 * et n'aurait jamais pu produire le couple « affiché 70, palier 60 ».
 *
 * Chaque appelant fournit donc désormais le palier explicitement, comme le
 * serveur le ferait.
 */
export const BAND_LABELS = {
  70: "Très compatibles",
  60: "Compatibles",
  50: "Envisageables",
} as const;

const candidate = (
  id: string,
  firstName: string,
  score: number,
  band: 70 | 60 | 50 | null,
): MissionCandidate => ({
  id,
  first_name: firstName,
  last_initial: "N",
  main_job: "serveur",
  city: "Lyon",
  years_experience: 4,
  matched_skills: [{ id: "skill-1", name: "Service en salle", required: true }],
  match: {
    compatible: true,
    score,
    band,
    band_label: band === null ? null : BAND_LABELS[band],
    blockers: [],
    distance_km: 2.4,
    dimensions: [
      // `tone` et `lost` viennent du serveur : cette fixture reproduit ce que
      // le moteur renvoie, elle ne rejoue pas sa règle. Ratio 1 → point fort ;
      // ratio 0,5 → ni éloge ni reproche.
      {
        key: "job",
        label: "Métier",
        weight: 30,
        ratio: 1,
        points: 30,
        tone: "strength",
        lost: 0,
      },
      {
        key: "desired_skills",
        label: "Compétences souhaitées",
        weight: 30,
        ratio: 0.5,
        points: 15,
        tone: "neutral",
        lost: 15,
      },
    ],
  },
});

const selection = (
  candidates: MissionCandidate[],
  over: Partial<CandidateSelection> = {},
): CandidateSelection => ({
  band: 70,
  band_label: "Très compatibles",
  candidates,
  outside_zone: [],
  inactive: null,
  ...over,
});

type ViewProps = Parameters<typeof MatchedProfilesView>[0];
const render = (
  props: Pick<ViewProps, "selection" | "loading" | "error"> &
    Partial<ViewProps>,
) =>
  renderToStaticMarkup(
    createElement(MatchedProfilesView, {
      inaccessible: false,
      showOutsideZone: false,
      onRetry: vi.fn(),
      onToggleOutsideZone: vi.fn(),
      ...props,
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  setAccess(null);
});

describe("service des profils correspondants", () => {
  it("interroge uniquement la sélection calculée par le backend", async () => {
    const body = selection([candidate("worker-1", "Camille", 82, 70)]);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setAccess("company-token");

    await expect(listMissionCandidates("mission-1")).resolves.toEqual(body);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/missions/mission-1/candidates");
    expect(options?.method).toBeUndefined();
  });
});

describe("interface des profils correspondants", () => {
  it("conserve l’ordre serveur et explique le score sans exposer de nom complet", () => {
    const html = render({
      selection: selection([
        candidate("worker-1", "Camille", 82, 70),
        candidate("worker-2", "Sam", 74, 70),
      ]),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });

    expect(html.indexOf("Camille N.")).toBeLessThan(html.indexOf("Sam N."));
    expect(html).toContain("Compatible à 82");
    // L'explication est faite de phrases, plus d'un relévé de ratios.
    //
    // « Compétences souhaitées 50 % » obligeait le lecteur à refaire lui-même
    // le raisonnement du moteur pour savoir si c'était bon signe. Le libellé
    // technique et le pourcentage par dimension ont donc disparu de l'écran ;
    // ce qu'ils voulaient dire y est resté.
    expect(html).toContain("Le poste correspond à son métier principal.");
    expect(html).toContain(
      "Elle possède une partie des compétences appréciées pour ce poste.",
    );
    expect(html).toContain("Points positifs");
    expect(html).not.toContain("Compétences souhaitées");
    expect(html).not.toContain("Nguyen");
    expect(html).not.toContain("desired_skills");
  });

  it("peint la pastille avec le palier du serveur, pas avec le score arrondi", () => {
    // Le cas de la review, vu depuis la liste : 69,6 % s'affiche « 70 % » mais
    // le serveur a rangé ce profil au palier 60. La pastille doit suivre le
    // serveur, sinon la ligne contredit la section qui la contient.
    const html = render({
      selection: selection([candidate("worker-9", "Nour", 70, 60)], {
        band: 60,
        band_label: "Compatibles",
      }),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    expect(html).toContain("Compatible à 70");
    expect(html).toContain("is-mid");
    expect(html).not.toContain("is-high");
    // Et la phrase de section ne lui oppose plus de plafond : voir le test
    // dédié juste en dessous.
    expect(html).toContain("au moins 60 % de correspondance");
  });

  it("parle du candidat, jamais au candidat", () => {
    // Le même moteur sert deux lecteurs. Cet écran est celui de l'entreprise :
    // elle lit la situation de quelqu'un d'autre, pas la sienne. Un « vous »
    // égaré ici viendrait de la formulation destinée à l'intérimaire.
    const html = render({
      selection: selection([candidate("worker-1", "Camille", 82, 70)]),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    expect(html).not.toContain("Vous ");
    expect(html).not.toContain("chez vous");
    expect(html).not.toContain("votre profil");
  });

  it("n'annonce pas des critères obligatoires satisfaits quand ils ne le sont pas", () => {
    // L'écran affirmait cette phrase en toutes circonstances, y compris pour
    // un profil hors zone que le moteur avait précisément bloqué. Une
    // explication qui contredit le score qu'elle commente ne vaut rien.
    const loin = candidate("worker-3", "Nadia", 44, null);
    loin.match.compatible = false;
    loin.match.blockers = ["out_of_range"];
    const html = render({
      selection: selection([], { outside_zone: [loin] }),
      loading: false,
      error: "",
      showOutsideZone: true,
      onRetry: vi.fn(),
    });
    expect(html).not.toContain("Tous les critères que vous avez rendus");
    expect(html).toContain("rayon de déplacement");
  });

  it("rend les paliers décidés par le serveur compréhensibles", () => {
    expect(selectionSummary(selection([candidate("a", "A", 75, 70)]))).toBe(
      "1 profil au palier « très compatibles » (au moins 70 % de correspondance).",
    );
    const replies = selectionSummary(
      selection([candidate("b", "B", 64, 60)], {
        band: 60,
        band_label: "Compatibles",
      }),
    );
    expect(replies).toContain("Aucun profil n’atteint le palier supérieur.");
    expect(replies).toContain("au moins 60 % de correspondance");
    expect(
      selectionSummary(
        selection([candidate("c", "C", 54, 50)], {
          band: 50,
          band_label: "Envisageables",
        }),
      ),
    ).toContain("au moins 50 % de correspondance");
  });

  it("n’énonce jamais un plafond que l’arrondi peut démentir", () => {
    // LE CAS DE LA REVIEW, vu du texte. raw_score 69,6 → affiché « 70 % »,
    // palier serveur 60. La phrase disait « entre 60 % et 69 % » pendant que la
    // pastille juste à côté annonçait « Compatible à 70 % » : deux énoncés
    // exacts séparément, contradictoires ensemble.
    const contradictoire = selection([candidate("worker-9", "Nour", 70, 60)], {
      band: 60,
      band_label: "Compatibles",
    });
    const resume = selectionSummary(contradictoire);

    // Plus aucune borne haute, sous aucune forme.
    expect(resume).not.toMatch(/entre \d+\s*% et \d+/);
    expect(resume).not.toContain("69");
    // Et aucun énoncé du type « aucun profil n'atteint 70 % », que la pastille
    // démentirait mot pour mot.
    expect(resume).not.toContain("n’atteint 70");
    // Ce qui reste est vrai de TOUS les profils listés, arrondi compris : un
    // score réel au-dessus de 60 s’arrondit toujours à 60 ou plus.
    expect(resume).toContain("au moins 60 % de correspondance");

    const html = render({
      selection: contradictoire,
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    expect(html).toContain("Compatible à 70");
    expect(html).toContain("au moins 60 % de correspondance");
    expect(html).not.toContain("entre 60");
  });

  it("nomme le palier aux technologies d’assistance, pas seulement à l’œil", () => {
    // Deux profils affichés « 70 % », paliers différents : sans ce rappel, une
    // synthèse vocale les restituerait à l’identique, la distinction ne tenant
    // qu’à la classe CSS.
    const haut = render({
      selection: selection([candidate("w-h", "Haut", 70, 70)]),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    const bas = render({
      selection: selection([candidate("w-b", "Bas", 70, 60)], {
        band: 60,
        band_label: "Compatibles",
      }),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    expect(haut).toContain("Très compatibles");
    expect(bas).toContain("Compatibles");
    expect(bas).not.toContain("Très compatibles");
  });

  it("distingue chargement, erreur, vide et mission inactive", () => {
    const base = { selection: null, error: "", onRetry: vi.fn() };
    expect(render({ ...base, loading: true })).toContain(
      "Chargement des profils correspondants",
    );
    expect(
      render({ ...base, loading: false, error: "Réseau indisponible." }),
    ).toContain("Réessayer");
    expect(
      render({
        ...base,
        loading: false,
        selection: selection([], { band: null, band_label: null }),
      }),
    ).toContain("seuil de correspondance de 50 %");
    expect(
      render({
        ...base,
        loading: false,
        selection: selection([], {
          band: null,
          band_label: null,
          inactive: "draft",
        }),
      }),
    ).toContain("Publiez cette mission");
    // Régression : le backend renvoie « cancelled » depuis la mise en service
    // du cycle de vie, mais le motif manquait à la table des messages. Comme
    // elle est exhaustive, l'encart s'affichait vide — une mission annulée ne
    // disait plus rien du tout à l'entreprise.
    expect(
      render({
        ...base,
        loading: false,
        selection: selection([], {
          band: null,
          band_label: null,
          inactive: "cancelled",
        }),
      }),
    ).toContain("Cette mission est annulée");
    // Et surtout pas le message des postes pourvus : rien n'a été pourvu.
    expect(
      render({
        ...base,
        loading: false,
        selection: selection([], {
          band: null,
          band_label: null,
          inactive: "cancelled",
        }),
      }),
    ).not.toContain("postes sont pourvus");
  });

  it("reste lisible avec les données facultatives absentes", () => {
    const partial = candidate("worker-3", "Lou", 71, 70);
    partial.main_job = null;
    partial.city = null;
    partial.years_experience = null;
    partial.matched_skills = [];
    const html = render({
      selection: selection([partial]),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });
    expect(html).toContain("Lou N.");
    expect(html).toContain("Compatible à 71");
  });

  it("garde les profils hors zone séparés et masqués par défaut", () => {
    const distant = candidate("worker-4", "Noa", 45, null);
    distant.match.compatible = false;
    distant.match.blockers = ["out_of_range"];
    distant.match.outside_zone = true;
    const result = selection([], { outside_zone: [distant] });

    const hidden = render({ selection: result, loading: false, error: "" });
    expect(hidden).toContain("Voir également");
    expect(hidden).not.toContain("Noa N.");

    const visible = render({
      selection: result,
      loading: false,
      error: "",
      showOutsideZone: true,
    });
    expect(visible).toContain("Noa N.");
    expect(visible).toContain("Score 45");
    expect(visible).toContain("hors zone");
    expect(visible).not.toContain("Compatible à 45");
  });

  it("distingue une sélection inaccessible d’une erreur temporaire", () => {
    const html = render({
      selection: null,
      loading: false,
      error: "",
      inaccessible: true,
    });
    expect(html).toContain("pas accessible avec ce compte");
    expect(html).not.toContain("Réessayer");
  });
});
