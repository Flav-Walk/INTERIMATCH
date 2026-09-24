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
/** Règles de complétion calculées par le serveur ; jamais décidées ici. */
export type CompletionRule =
  | "identity"
  | "location"
  | "mobility_radius"
  | "main_job"
  | "skills"
  | "availability";

export interface Availability {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "available" | "unavailable";
}
export interface Experience {
  id?: string;
  job_title: string;
  employer: string;
  years: number;
}
export interface Certification {
  id?: string;
  name: string;
  issuer: string;
  obtained_on: string | null;
}

export interface WorkerProfileData {
  city?: string | null;
  postal_code?: string | null;
  // Dérivées du géocodage serveur : jamais saisies, jamais envoyées.
  latitude?: number | null;
  longitude?: number | null;
  geocoded_at?: string | null;
  main_job?: string | null;
  secondary_jobs?: string[];
  years_experience?: number | null;
  phone?: string | null;
  mobility_radius_km?: number | null;
  has_driving_licence?: boolean;
  has_vehicle?: boolean;
  open_to_missions?: boolean;
  skills?: Skill[];
  experiences?: Experience[];
  availabilities?: Availability[];
  certifications?: Certification[];
}

export interface CompanyProfileData {
  establishment_name?: string;
  legal_name?: string;
  sector?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  description?: string;
}

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
  /** Renseigné par les routes intérimaire : ce qu'il reste à compléter. */
  missing_requirements?: CompletionRule[];
  profile: WorkerProfileData & CompanyProfileData;
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

/** Téléchargement authentifié d'un binaire, avec le même renouvellement de
 * session que le client JSON. */
export async function apiBlob(path: string): Promise<Blob> {
  if (
    !config?.VITE_API_URL ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://")
  )
    throw new ApiError("Chemin API invalide.", 0, "INVALID_PATH");
  const baseUrl = config.VITE_API_URL.replace(/\/$/, "");
  const request = () =>
    fetch(`${baseUrl}${path}`, {
      credentials: "include",
      headers: {
        Accept: "application/pdf",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let response = await request();
  if (response.status === 401) {
    await refreshSession();
    response = await request();
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload.error as Record<string, unknown>)
        : {};
    throw new ApiError(
      typeof detail.message === "string"
        ? detail.message
        : "Le document est indisponible.",
      response.status,
      typeof detail.code === "string" ? detail.code : "HTTP_ERROR",
      response.headers.get("X-Request-Id") ?? undefined,
    );
  }
  return response.blob();
}
// Un compte connecté a toujours un espace : le profil se complète depuis l'espace,
// il ne conditionne plus l'accès.
export function destination(user: User) {
  return "/" + user.role;
}
export const errorMessage = (e: unknown) =>
  e instanceof ApiError
    ? e.message
    : e instanceof Error && e.name === "TypeError"
      ? "Connexion au service impossible. Vérifiez votre réseau puis réessayez."
      : e instanceof Error
        ? e.message
        : "Une erreur est survenue.";
