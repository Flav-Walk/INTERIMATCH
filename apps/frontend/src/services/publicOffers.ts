import { api } from "./session";

export interface PublicJobOfferSkill {
  name: string;
  required: boolean;
}

export interface PublicJobOfferQuality {
  label: string;
  description?: string;
}

export interface PublicJobOffer {
  id: string;
  source: string;
  external_id: string;
  title: string;
  description: string;
  rome_code: string;
  rome_label: string;
  company_name: string | null;
  contract_type: string;
  contract_label: string;
  experience_label: string | null;
  postal_code: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  salary_label: string | null;
  working_time: string | null;
  positions: number;
  skills: PublicJobOfferSkill[];
  professional_qualities: PublicJobOfferQuality[];
  source_url: string | null;
  created_at_source: string | null;
  updated_at_source: string | null;
  imported_at: string;
}

export interface PublicJobOfferFilters {
  search?: string;
  rome?: string;
  location?: string;
  contract_type?: string;
  page?: number;
  limit?: number;
}

export interface PublicJobOffersResponse {
  offers: PublicJobOffer[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export async function listPublicOffers(
  filters: PublicJobOfferFilters = {},
): Promise<PublicJobOffersResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.rome) params.set("rome", filters.rome);
  if (filters.location) params.set("location", filters.location);
  if (filters.contract_type) params.set("contract_type", filters.contract_type);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const qs = params.toString();
  return api<PublicJobOffersResponse>(
    `/public-job-offers${qs ? `?${qs}` : ""}`,
  );
}

export async function getPublicOffer(id: string): Promise<PublicJobOffer> {
  return api<PublicJobOffer>(`/public-job-offers/${encodeURIComponent(id)}`);
}

/** Défense en profondeur : un DTO altéré ne devient jamais un lien exécutable. */
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
