import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { setAccess } from "./session";
import {
  applicationCandidateName,
  applyToMission,
  awaitingReply,
  pendingByMission,
  upcomingEngagements,
  decideApplication,
  getMyApplication,
  listMissionApplications,
  listMyApplications,
  type Application,
  type MissionApplication,
  type WorkerApplication,
} from "./applications";
import {
  ApplicationAction,
  workerApplicationError,
} from "../components/applications/ApplyToMission";
import { ConfirmedMissions } from "../components/applications/ConfirmedMissions";
import {
  DecisionConfirmation,
  MissionApplicationList,
  decisionConflictMessage,
  missionCapacityLabel,
  replaceApplication,
} from "../components/applications/MissionApplications";
import {
  WorkerApplicationList,
  workerApplicationContext,
} from "../pages/WorkerApplications";

const missionId = "00000000-0000-4000-8000-000000000001";
const application: Application = {
  id: "00000000-0000-4000-8000-000000000002",
  mission_id: missionId,
  worker_id: "00000000-0000-4000-8000-000000000003",
  status: "pending",
  created_at: "2026-09-18T10:00:00.000Z",
  updated_at: "2026-09-18T10:00:00.000Z",
};
const candidate: MissionApplication = {
  ...application,
  conflict: false,
  worker: {
    id: application.worker_id,
    first_name: "Camille",
    last_name: "Martin",
    city: "Lyon",
    main_job: "serveur",
  },
};
const workerApplication: WorkerApplication = {
  id: application.id,
  mission_id: missionId,
  status: "accepted",
  created_at: application.created_at,
  updated_at: application.updated_at,
  mission: {
    title: "Service du soir",
    job: "serveur",
    starts_at: "2026-10-18T16:00:00.000Z",
    ends_at: "2026-10-18T22:00:00.000Z",
    city: "Lyon",
    postal_code: "69002",
    status: "open",
  },
  company: { establishment_name: "Le Central" },
};
const capacity = { headcount: 5, filled: 2, remaining: 3, full: false };

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));

afterEach(() => {
  vi.unstubAllGlobals();
  setAccess(null);
});

describe("service candidatures", () => {
  it("envoie uniquement l’identifiant de mission pour postuler", async () => {
    const fetchMock = vi.fn(async () => response(application, 201));
    vi.stubGlobal("fetch", fetchMock);
    setAccess("worker-token");
    expect(await applyToMission(missionId)).toEqual(application);
    const [, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      mission_id: missionId,
    });
  });

  it("charge l’état persistant et les deux listes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ application }))
      .mockResolvedValueOnce(response({ applications: [workerApplication] }))
      .mockResolvedValueOnce(response({ applications: [candidate], capacity }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getMyApplication(missionId)).application?.status).toBe(
      "pending",
    );
    expect((await listMyApplications()).applications[0].status).toBe(
      "accepted",
    );
    const missionApplications = await listMissionApplications(missionId);
    expect(missionApplications.applications[0].worker.id).toBe(
      candidate.worker.id,
    );
    expect(missionApplications.capacity).toEqual(capacity);
  });

  it("n’envoie que la décision de l’entreprise", async () => {
    const fetchMock = vi.fn(async () =>
      response({ ...candidate, status: "accepted" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await decideApplication(missionId, application.id, "accepted");
    const [, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ status: "accepted" });
  });

  it("envoie le refus avec le même contrat explicite", async () => {
    const fetchMock = vi.fn(async () =>
      response({ ...candidate, status: "rejected" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await decideApplication(missionId, application.id, "rejected");
    const [, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(options.body as string)).toEqual({ status: "rejected" });
  });

  it("propage une erreur lisible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          {
            error: {
              code: "APPLICATION_ALREADY_EXISTS",
              message: "Vous avez déjà postulé à cette mission.",
            },
          },
          409,
        ),
      ),
    );
    await expect(applyToMission(missionId)).rejects.toMatchObject<
      Partial<ApiError>
    >({ status: 409, code: "APPLICATION_ALREADY_EXISTS" });
  });
});

describe("interface candidatures", () => {
  it("affiche le bouton puis le succès renvoyé par le backend", () => {
    const initial = render(
      createElement(ApplicationAction, {
        application: null,
        loading: false,
        applying: false,
        error: "",
        onApply: vi.fn(),
      }),
    );
    expect(initial).toContain("Postuler");

    const success = render(
      createElement(ApplicationAction, {
        application,
        loading: false,
        applying: false,
        error: "",
        onApply: vi.fn(),
      }),
    );
    expect(success).toContain("Candidature envoyée");
    expect(success).not.toContain(">Postuler<");
  });

  it("affiche l’erreur et les candidatures entreprise", () => {
    const failed = render(
      createElement(ApplicationAction, {
        application: null,
        loading: false,
        applying: false,
        error: "Service indisponible.",
        onApply: vi.fn(),
      }),
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Service indisponible.");

    const company = render(
      createElement(MissionApplicationList, {
        applications: [candidate],
        busyId: null,
        missionFull: false,
        onDecision: vi.fn(),
      }),
    );
    expect(company).toContain("Camille Martin");
    expect(company).toContain("Accepter");
    expect(company).toContain("Refuser");
    expect(applicationCandidateName(candidate)).toBe("Camille Martin");
  });

  it("confirme acceptation et refus avec le candidat et la mission", () => {
    const accept = render(
      createElement(DecisionConfirmation, {
        decision: { application: candidate, status: "accepted" },
        missionTitle: "Service du soir",
        busy: false,
        error: "",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(accept).toContain("Accepter cette candidature ?");
    expect(accept).toContain("Camille Martin");
    expect(accept).toContain("Service du soir");
    expect(accept).toContain("Accepter la candidature");

    const reject = render(
      createElement(DecisionConfirmation, {
        decision: { application: candidate, status: "rejected" },
        missionTitle: "Service du soir",
        busy: false,
        error: "",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(reject).toContain("Refuser cette candidature ?");
    expect(reject).toContain("Refuser la candidature");
    expect(reject).toContain("is-danger");
  });

  it("verrouille les décisions pendant une mutation et montre son erreur", () => {
    const list = render(
      createElement(MissionApplicationList, {
        applications: [candidate],
        busyId: candidate.id,
        missionFull: false,
        onDecision: vi.fn(),
      }),
    );
    expect(list.match(/disabled=""/g) ?? []).toHaveLength(2);

    const dialog = render(
      createElement(DecisionConfirmation, {
        decision: { application: candidate, status: "accepted" },
        missionTitle: "Service du soir",
        busy: true,
        error: "Connexion au service impossible.",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(dialog).toContain('aria-busy="true"');
    expect(dialog).toContain("Acceptation en cours…");
    expect(dialog).toContain('role="alert"');
  });

  it("représente la capacité et retire l’acceptation quand la mission est pleine", () => {
    expect(missionCapacityLabel(0, 5)).toBe("0 poste pourvu sur 5.");
    expect(missionCapacityLabel(1, 5)).toBe("1 poste pourvu sur 5.");
    expect(missionCapacityLabel(5, 5)).toBe(
      "Tous les postes sont pourvus (5 sur 5).",
    );

    const full = render(
      createElement(MissionApplicationList, {
        applications: [candidate],
        busyId: null,
        missionFull: true,
        onDecision: vi.fn(),
      }),
    );
    expect(full).toContain("Tous les postes sont pourvus");
    expect(full).toContain(">Refuser<");
    expect(full).not.toContain(">Accepter<");
  });

  it("applique seulement la réponse serveur et explique les conflits", () => {
    const accepted = { ...candidate, status: "accepted" as const };
    const rejected = { ...candidate, status: "rejected" as const };
    expect(replaceApplication([candidate], accepted)[0].status).toBe(
      "accepted",
    );
    expect(replaceApplication([candidate], rejected)[0].status).toBe(
      "rejected",
    );
    expect(
      decisionConflictMessage(
        new ApiError("Brut", 409, "APPLICATION_ALREADY_DECIDED"),
      ),
    ).toContain("déjà été traitée");
    expect(
      decisionConflictMessage(new ApiError("Brut", 409, "MISSION_FULL")),
    ).toContain("Tous les postes");
    expect(
      decisionConflictMessage(new ApiError("Brut", 403, "FORBIDDEN")),
    ).toContain("plus accessible");
  });

  it("affiche les statuts worker et l’état vide", () => {
    const list = render(
      createElement(WorkerApplicationList, {
        applications: [
          workerApplication,
          { ...workerApplication, id: "rejected", status: "rejected" },
        ],
      }),
    );
    expect(list).toContain("Service du soir");
    expect(list).toContain("Acceptée");
    expect(list).toContain("Non retenue");

    const empty = render(
      createElement(WorkerApplicationList, { applications: [] }),
    );
    expect(empty).toContain("Vous n’avez pas encore postulé");
  });

  it("distingue une mission confirmée à venir d’une mission passée", () => {
    expect(workerApplicationContext(workerApplication)).toBe(
      "Mission confirmée",
    );
    expect(
      workerApplicationContext({
        ...workerApplication,
        mission: {
          ...workerApplication.mission,
          starts_at: "2020-10-18T16:00:00.000Z",
          ends_at: "2020-10-18T22:00:00.000Z",
        },
      }),
    ).toBe("Mission passée");
  });

  it("présente une ou plusieurs missions confirmées avec les données utiles", () => {
    const second = {
      ...workerApplication,
      id: "second",
      mission_id: "second-mission",
      mission: {
        ...workerApplication.mission,
        title: "Accueil petit-déjeuner",
        city: "",
        postal_code: "",
      },
      company: { establishment_name: null },
    };
    const confirmed = render(
      createElement(ConfirmedMissions, {
        applications: [workerApplication, second],
      }),
    );
    expect(confirmed).toContain("Service du soir");
    expect(confirmed).toContain("Accueil petit-déjeuner");
    expect(confirmed).toContain("Le Central");
    expect(confirmed).toContain("Établissement");
    expect(confirmed).toContain("Lieu à confirmer");
    expect(confirmed.match(/Acceptée/g) ?? []).toHaveLength(2);
    expect(render(createElement(ConfirmedMissions, { applications: [] }))).toBe(
      "",
    );
  });

  it("explique immédiatement la décision sur la fiche worker", () => {
    const accepted = render(
      createElement(ApplicationAction, {
        application: { ...application, status: "accepted" },
        loading: false,
        applying: false,
        error: "",
        onApply: vi.fn(),
        mission: {
          ...workerApplication.mission,
          establishment_name: "Le Central",
        },
      }),
    );
    expect(accepted).toContain("Mission confirmée");
    expect(accepted).toContain("Votre candidature a été acceptée");
    expect(accepted).toContain("Service du soir");
    expect(accepted).toContain("Le Central");
    expect(accepted).toContain("69002 Lyon");
    expect(accepted).not.toContain(">Postuler<");

    const rejected = render(
      createElement(ApplicationAction, {
        application: { ...application, status: "rejected" },
        loading: false,
        applying: false,
        error: "",
        onApply: vi.fn(),
      }),
    );
    expect(rejected).toContain("n’a pas retenu cette candidature");
    expect(rejected).not.toContain(">Postuler<");
  });

  it("traduit WORKER_ENGAGED sans calculer de conflit côté client", () => {
    expect(
      workerApplicationError(new ApiError("Brut", 409, "WORKER_ENGAGED")),
    ).toContain("déjà engagé sur une autre mission");
    expect(
      workerApplicationError(new ApiError("Brut", 409, "MISSION_FULL")),
    ).toContain("postes");
    expect(
      workerApplicationError(new ApiError("Brut", 409, "APPLICATION_CLOSED")),
    ).toContain("n’accepte plus");
  });
});

/**
 * Engagements et attentes, cotes interimaire et entreprise.
 *
 * Ces trois fonctions decident ce qui s'affiche : un engagement oublie, et une
 * mission disparait des propositions sans que personne puisse l'expliquer.
 */
describe("lecture des candidatures", () => {
  const withMission = (
    status: "pending" | "accepted" | "rejected",
    starts: string,
    ends: string,
    missionStatus = "open",
  ) => ({
    id: `${status}-${starts}`,
    mission_id: "m-" + starts,
    status,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    mission: {
      title: "Mission",
      job: "serveur",
      starts_at: starts,
      ends_at: ends,
      city: "Lyon",
      postal_code: "69002",
      status: missionStatus,
    },
    company: { establishment_name: null },
  });

  const future = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString();
  const past = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString();

  it("ne retient comme engagement que l acceptee, a venir, non annulee", () => {
    const list = [
      withMission("accepted", future(2), future(3)),
      withMission("pending", future(4), future(5)),
      withMission("rejected", future(6), future(7)),
      withMission("accepted", past(5), past(4)),
      withMission("accepted", future(8), future(9), "cancelled"),
    ];
    const kept = upcomingEngagements(list);
    expect(kept).toHaveLength(1);
    expect(kept[0].mission.starts_at).toBe(list[0].mission.starts_at);
  });

  it("classe les engagements du plus proche au plus lointain", () => {
    const loin = withMission("accepted", future(20), future(21));
    const proche = withMission("accepted", future(2), future(3));
    expect(upcomingEngagements([loin, proche])[0]).toBe(proche);
  });

  it("ne compte comme en attente que les candidatures sans reponse", () => {
    const list = [
      withMission("pending", future(2), future(3)),
      withMission("accepted", future(4), future(5)),
    ];
    expect(awaitingReply(list)).toHaveLength(1);
  });

  it("ne pastille une mission que sur de vraies candidatures en attente", () => {
    // Un profil suggere par le rapprochement n'apparait pas dans cette liste :
    // le compteur ne peut donc pas l'inclure par construction.
    const counts = pendingByMission([
      { ...application, id: "1", mission_id: "m1", status: "pending" },
      { ...application, id: "2", mission_id: "m1", status: "pending" },
      { ...application, id: "3", mission_id: "m1", status: "accepted" },
      { ...application, id: "4", mission_id: "m2", status: "pending" },
    ] as never);
    expect(counts.get("m1")).toBe(2);
    expect(counts.get("m2")).toBe(1);
    expect(counts.get("m3")).toBeUndefined();
  });
});
