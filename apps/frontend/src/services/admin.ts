import { api, type Role } from "./session";

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
}

export const roleOptions: { value: Role; label: string }[] = [
  { value: "worker", label: "Intérimaire" },
  { value: "company", label: "Entreprise" },
  { value: "admin", label: "Administrateur" },
];

export const adminUserName = (user: AdminUser) =>
  `${user.first_name} ${user.last_name}`.trim() || "Identité non renseignée";

export const listAdminUsers = () => api<AdminUser[]>("/admin/users");

export const updateAdminUserRole = (userId: string, role: Role) =>
  api<AdminUser>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
