import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { setAccess } from "./session";
import {
  applicationCandidateName,
  applyToMission,
  decideApplication,
  getMyApplication,
  listMissionApplications,
  listMyApplications,
  type Application,
  type MissionApplication,
  type WorkerApplication,
} from "./applications";
import { ApplicationAction } from "../components/applications/ApplyToMission";
import { MissionApplicationList } from "../components/applications/MissionApplications";
import { WorkerApplicationList } from "../pages/WorkerApplications";

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
      .mockResolvedValueOnce(response({ applications: [candidate] }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getMyApplication(missionId)).application?.status).toBe(
      "pending",
    );
    expect((await listMyApplications()).applications[0].status).toBe(
      "accepted",
    );
    expect(
      (await listMissionApplications(missionId)).applications[0].worker.id,
    ).toBe(candidate.worker.id);
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
        onDecision: vi.fn(),
      }),
    );
    expect(company).toContain("Camille Martin");
    expect(company).toContain("Accepter");
    expect(company).toContain("Refuser");
    expect(applicationCandidateName(candidate)).toBe("Camille Martin");
  });

  it("affiche les statuts worker et l’état vide", () => {
    const list = render(
      createElement(WorkerApplicationList, {
        applications: [workerApplication],
      }),
    );
    expect(list).toContain("Service du soir");
    expect(list).toContain("Acceptée");

    const empty = render(
      createElement(WorkerApplicationList, { applications: [] }),
    );
    expect(empty).toContain("Vous n’avez pas encore postulé");
  });
});
