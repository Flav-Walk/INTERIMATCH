import { createApiClient, ApiError } from "./api";
import { config } from "./env";
export interface Skill {
  id: string;
  name: string;
}
export interface User {
  id: string;
  email: string;
  role: "worker" | "company" | "admin" | null;
  first_name: string;
  last_name: string;
  onboarding_completed: boolean;
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
export function destination(user: User) {
  if (!user.role) return "/onboarding/role";
  if (user.role === "admin") return "/";
  return user.onboarding_completed
    ? "/" + user.role
    : "/onboarding/" + user.role;
}
export const errorMessage = (e: unknown) =>
  e instanceof ApiError
    ? e.message
    : e instanceof Error && e.name === "TypeError"
      ? "Connexion au service impossible. Vérifiez votre réseau puis réessayez."
      : e instanceof Error
        ? e.message
        : "Une erreur est survenue.";
