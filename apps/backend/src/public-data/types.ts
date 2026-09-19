export interface NormalizedSkill {
  name: string;
  required: boolean;
}

export interface NormalizedQuality {
  label: string;
  description?: string;
}

export interface NormalizedPublicJobOffer {
  source: "france_travail";
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
  skills: NormalizedSkill[];
  professional_qualities: NormalizedQuality[];
  source_url: string | null;
  created_at_source: string | null;
  updated_at_source: string | null;
  raw_checksum: string;
}

export interface PublicJobOfferDto {
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
  skills: NormalizedSkill[];
  professional_qualities: NormalizedQuality[];
  source_url: string | null;
  created_at_source: string | null;
  updated_at_source: string | null;
  imported_at: string;
}

export interface ImportSummary {
  received: number;
  accepted: number;
  rejected: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  errors?: Array<{ index: number; external_id?: string; reason: string }>;
}

export interface PublicJobOfferFilters {
  search?: string;
  rome?: string;
  location?: string;
  contract_type?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPublicJobOffers {
  offers: PublicJobOfferDto[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
