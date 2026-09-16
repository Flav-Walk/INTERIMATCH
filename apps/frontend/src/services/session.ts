import { createApiClient, ApiError } from "./api";
import { config } from "./env";
export interface Skill {
  id: string;
  name: string;
}
/** Vocabulaire métier servi par le backend : jamais redéclaré dans les écrans. */
export interface ReferenceValue {
  value: string;
  label: string;
}
export type Role = "worker" | "company" | "admin";
export interface User {
  id: string;
  email: string;
  // Toujours défini : le serveur attribue le rôle à la création du compte.
  role: Role;
  first_name: string;
  last_name: string;
  onboarding_completed: boolean;
  tour_version: number;
  demo: boolean;
  profile: {
    city?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    main_job?: string;
    mobility_radius_km?: number;
    skills?: Skill[];
    experiences?: { job_title: string; employer: string; years: number }[];
    availabilities?: { id: string; starts_at: string; ends_at: string }[];
    establishment_name?: string;
    legal_name?: string;
    sector?: string;
    address?: string;
    phone?: string;
    description?: string;
  };
}
let token: string | null = null;
const raw = createApiClient(config?.VITE_API_URL, () => token);
let refreshPromise: Promise<void> | null = null;
export function setAccess(value: string | null) {
  token = value;
}
export function refreshSession() {
  if (!refreshPromise)
    refreshPromise = raw<{ access_token: string }>("/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => {
        token = r.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await raw<T>(path, { credentials: "include", ...options });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !path.startsWith("/auth/")
    ) {
      try {
        await refreshSession();
      } catch (refreshError) {
        token = null;
        window.dispatchEvent(new Event("session-expired"));
        throw refreshError;
      }
      return raw<T>(path, { credentials: "include", ...options });
    }
    throw error;
  }
}
// Un compte connecté a toujours un espace : le profil se complète depuis l'espace,
// il ne conditionne plus l'accès.
export function destination(user: User) {
  return user.role === "admin" ? "/" : "/" + user.role;
}
export const errorMessage = (e: unknown) =>
  e instanceof ApiError
    ? e.message
    : e instanceof Error && e.name === "TypeError"
      ? "Connexion au service impossible. Vérifiez votre réseau puis réessayez."
      : e instanceof Error
        ? e.message
        : "Une erreur est survenue.";
