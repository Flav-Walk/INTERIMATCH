import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  adminUserName,
  listAdminUsers,
  updateAdminUserRole,
  type AdminUser,
} from "./admin";
import { destination, setAccess } from "./session";
import { AdminLoading, AdminUsersTable } from "../pages/Admin";

const user: AdminUser = {
  id: "9f1c2f3e-0000-4000-8000-000000000001",
  email: "camille@example.test",
  role: "worker",
  first_name: "Camille",
  last_name: "Martin",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  setAccess(null);
});

describe("service d’administration", () => {
  it("charge et affiche les utilisateurs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response([user])),
    );
    expect(await listAdminUsers()).toEqual([user]);
    expect(adminUserName(user)).toBe("Camille Martin");

    const html = renderToStaticMarkup(
      createElement(AdminUsersTable, {
        users: [user],
        currentUserId: "another-user",
        drafts: { [user.id]: "worker" },
        savingId: null,
        savedId: null,
        onRoleChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(html).toContain("Camille Martin");
    expect(html).toContain("camille@example.test");
    expect(html).toContain("Intérimaire");
  });

  it("envoie uniquement le nouveau rôle", async () => {
    const fetchMock = vi.fn(async () => response({ ...user, role: "company" }));
    vi.stubGlobal("fetch", fetchMock);
    setAccess("synthetic-admin-token");
    const updated = await updateAdminUserRole(user.id, "company");
    expect(updated.role).toBe("company");
    const [, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ role: "company" });
  });

  it("propage une erreur API lisible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          { error: { code: "FORBIDDEN", message: "Accès refusé." } },
          403,
        ),
      ),
    );
    await expect(listAdminUsers()).rejects.toMatchObject<Partial<ApiError>>({
      status: 403,
      code: "FORBIDDEN",
      message: "Accès refusé.",
    });
  });

  it("rend un état de chargement explicite", () => {
    const html = renderToStaticMarkup(createElement(AdminLoading));
    expect(html).toContain('role="status"');
    expect(html).toContain("Chargement des utilisateurs");
  });

  it("utilise /admin comme destination du rôle administrateur", () => {
    expect(
      destination({ role: "admin" } as Parameters<typeof destination>[0]),
    ).toBe("/admin");
  });

  it("désactive la modification de son propre compte", () => {
    const html = renderToStaticMarkup(
      createElement(AdminUsersTable, {
        users: [{ ...user, role: "admin" }],
        currentUserId: user.id,
        drafts: { [user.id]: "admin" },
        savingId: null,
        savedId: null,
        onRoleChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(html).toContain("Votre compte");
    expect(html).toContain("auto-rétrogradation");
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });
});
