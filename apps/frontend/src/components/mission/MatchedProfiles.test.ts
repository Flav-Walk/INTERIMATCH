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

const candidate = (
  id: string,
  firstName: string,
  score: number,
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
    blockers: [],
    distance_km: 2.4,
    dimensions: [
      {
        key: "job",
        label: "Métier",
        weight: 30,
        ratio: 1,
        points: 30,
      },
      {
        key: "desired_skills",
        label: "Compétences souhaitées",
        weight: 30,
        ratio: 0.5,
        points: 15,
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
    const body = selection([candidate("worker-1", "Camille", 82)]);
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
        candidate("worker-1", "Camille", 82),
        candidate("worker-2", "Sam", 74),
      ]),
      loading: false,
      error: "",
      onRetry: vi.fn(),
    });

    expect(html.indexOf("Camille N.")).toBeLessThan(html.indexOf("Sam N."));
    expect(html).toContain("Compatible à 82");
    expect(html).toContain("Compétences souhaitées");
    expect(html).toContain("50 %");
    expect(html).not.toContain("Nguyen");
    expect(html).not.toContain("desired_skills");
  });

  it("rend les paliers décidés par le serveur compréhensibles", () => {
    expect(selectionSummary(selection([candidate("a", "A", 75)]))).toBe(
      "1 profil correspond à au moins 70 % à cette mission.",
    );
    expect(
      selectionSummary(
        selection([candidate("b", "B", 64)], {
          band: 60,
          band_label: "Compatibles",
        }),
      ),
    ).toContain("entre 60 % et 69 %");
    expect(
      selectionSummary(
        selection([candidate("c", "C", 54)], {
          band: 50,
          band_label: "Envisageables",
        }),
      ),
    ).toContain("entre 50 % et 59 %");
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
  });

  it("reste lisible avec les données facultatives absentes", () => {
    const partial = candidate("worker-3", "Lou", 71);
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
    const distant = candidate("worker-4", "Noa", 45);
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
