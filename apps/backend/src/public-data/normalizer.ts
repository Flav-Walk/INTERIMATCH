import { createHash } from "node:crypto";
import type {
  NormalizedPublicJobOffer,
  NormalizedSkill,
  NormalizedQuality,
} from "./types.js";

/**
 * Extrait toutes les offres brutes d'une structure France Travail, qu'il
 * s'agisse :
 * - d'un export multi-recherches avec `recherches[].offres[]` (comme les fixtures) ;
 * - d'un retour direct d'API avec `resultats[]` ;
 * - d'un tableau direct d'offres `[...]` ;
 * - d'un objet avec `offres[]` ;
 * - ou d'une offre isolée `{ id, intitule, ... }`.
 */
export function extractRawOffers(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object")
    throw new TypeError("Structure de fichier France Travail invalide.");

  if (Array.isArray(payload)) return payload;

  const root = payload as Record<string, unknown>;

  if (Object.hasOwn(root, "recherches")) {
    if (!Array.isArray(root.recherches))
      throw new TypeError("Le champ recherches doit être un tableau.");
    const list: unknown[] = [];
    for (const r of root.recherches) {
      if (!r || typeof r !== "object" || Array.isArray(r))
        throw new TypeError("Chaque recherche doit être un objet.");
      const offers = (r as Record<string, unknown>).offres;
      if (!Array.isArray(offers))
        throw new TypeError(
          "Le champ offres d'une recherche doit être un tableau.",
        );
      list.push(...offers);
    }
    return list;
  }

  if (Object.hasOwn(root, "resultats")) {
    if (!Array.isArray(root.resultats))
      throw new TypeError("Le champ resultats doit être un tableau.");
    return root.resultats;
  }

  if (Object.hasOwn(root, "offres")) {
    if (!Array.isArray(root.offres))
      throw new TypeError("Le champ offres doit être un tableau.");
    return root.offres;
  }

  if (typeof root.id === "string" || typeof root.id === "number") {
    return [root];
  }

  throw new TypeError("Structure de fichier France Travail invalide.");
}

function safeIsoDate(val: unknown): string | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const candidate = typeof val === "string" ? val.trim() : val;

  if (typeof candidate === "string") {
    const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(candidate);
    if (calendar) {
      const year = Number(calendar[1]);
      const month = Number(calendar[2]);
      const day = Number(calendar[3]);
      const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const daysInMonth = [
        31,
        leapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ];
      if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1])
        return null;
    }
  }

  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function safeUrl(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function safeCoordinates(
  lat: unknown,
  lon: unknown,
): { latitude: number | null; longitude: number | null } {
  const latitude =
    typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
      ? lat
      : null;
  const longitude =
    typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180
      ? lon
      : null;
  // Une demi-position n'est pas exploitable : conserver une longitude sans
  // latitude (ou l'inverse) produirait un DTO impossible à cartographier.
  return latitude === null || longitude === null
    ? { latitude: null, longitude: null }
    : { latitude, longitude };
}

const canonicalSkills = (skills: NormalizedSkill[]) => {
  const byName = new Map<string, NormalizedSkill>();
  for (const skill of skills) {
    const previous = byName.get(skill.name);
    byName.set(skill.name, {
      name: skill.name,
      // Deux occurrences contradictoires ne doivent jamais faire perdre le
      // caractère obligatoire porté par l'une d'elles.
      required: skill.required || previous?.required === true,
    });
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
};

const canonicalQualities = (qualities: NormalizedQuality[]) => {
  const byValue = new Map<string, NormalizedQuality>();
  for (const quality of qualities)
    byValue.set(`${quality.label}\u0000${quality.description ?? ""}`, quality);
  return [...byValue.values()].sort(
    (a, b) =>
      a.label.localeCompare(b.label, "fr") ||
      (a.description ?? "").localeCompare(b.description ?? "", "fr"),
  );
};

/**
 * Normalise une offre brute issue de France Travail en une structure unifiée et
 * sécurisée. Valide la présence des identifiants et données requises, et nettoie
 * les chaînes, tableaux et objets vides.
 */
export function normalizeFranceTravailOffer(
  raw: unknown,
):
  | { success: true; data: NormalizedPublicJobOffer }
  | { success: false; error: string; external_id?: string } {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Offre invalide (non-objet)" };
  }

  const o = raw as Record<string, unknown>;

  const rawId = o.id !== undefined && o.id !== null ? String(o.id).trim() : "";
  if (!rawId) {
    return { success: false, error: "Identifiant externe manquant ou vide" };
  }
  if (rawId.length > 200) {
    return {
      success: false,
      external_id: rawId,
      error: "Identifiant externe trop long",
    };
  }

  const rawTitle = typeof o.intitule === "string" ? o.intitule.trim() : "";
  if (!rawTitle) {
    return {
      success: false,
      external_id: rawId,
      error: "Intitulé manquant ou vide",
    };
  }

  const description =
    typeof o.description === "string" ? o.description.trim() : "";
  const romeCode = typeof o.romeCode === "string" ? o.romeCode.trim() : "";
  const romeLabel =
    typeof o.romeLibelle === "string" && o.romeLibelle.trim()
      ? o.romeLibelle.trim()
      : typeof o.appellationlibelle === "string" && o.appellationlibelle.trim()
        ? o.appellationlibelle.trim()
        : romeCode;

  // Entreprise : supporter objet vide ou nom absent
  let companyName: string | null = null;
  if (o.entreprise && typeof o.entreprise === "object") {
    const ent = o.entreprise as Record<string, unknown>;
    if (typeof ent.nom === "string" && ent.nom.trim()) {
      companyName = ent.nom.trim();
    }
  }

  const contractType =
    typeof o.typeContrat === "string" && o.typeContrat.trim()
      ? o.typeContrat.trim()
      : "AUTRE";
  const contractLabel =
    typeof o.typeContratLibelle === "string" && o.typeContratLibelle.trim()
      ? o.typeContratLibelle.trim()
      : contractType;

  const experienceLabel =
    typeof o.experienceLibelle === "string" && o.experienceLibelle.trim()
      ? o.experienceLibelle.trim()
      : null;

  // Lieu de travail
  let postalCode: string | null = null;
  let city = "France";
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (o.lieuTravail && typeof o.lieuTravail === "object") {
    const loc = o.lieuTravail as Record<string, unknown>;
    if (typeof loc.codePostal === "string" && loc.codePostal.trim()) {
      postalCode = loc.codePostal.trim();
    }
    if (typeof loc.libelle === "string" && loc.libelle.trim()) {
      city = loc.libelle.trim();
    } else if (typeof loc.commune === "string" && loc.commune.trim()) {
      city = loc.commune.trim();
    }
    const coords = safeCoordinates(loc.latitude, loc.longitude);
    latitude = coords.latitude;
    longitude = coords.longitude;
  }

  // Salaire : supporter objet vide
  let salaryLabel: string | null = null;
  if (o.salaire && typeof o.salaire === "object") {
    const sal = o.salaire as Record<string, unknown>;
    if (typeof sal.libelle === "string" && sal.libelle.trim()) {
      salaryLabel = sal.libelle.trim();
    }
  }

  // Durée du travail
  let workingTime: string | null = null;
  if (
    typeof o.dureeTravailLibelleConverti === "string" &&
    o.dureeTravailLibelleConverti.trim()
  ) {
    workingTime = o.dureeTravailLibelleConverti.trim();
  } else if (
    typeof o.dureeTravailLibelle === "string" &&
    o.dureeTravailLibelle.trim()
  ) {
    workingTime = o.dureeTravailLibelle.trim();
  }

  // Nombre de postes
  if (
    o.nombrePostes !== undefined &&
    (typeof o.nombrePostes !== "number" ||
      !Number.isSafeInteger(o.nombrePostes) ||
      o.nombrePostes < 1)
  )
    return {
      success: false,
      external_id: rawId,
      error: "Nombre de postes invalide",
    };
  const positions = (o.nombrePostes as number | undefined) ?? 1;

  // Compétences
  const skills: NormalizedSkill[] = [];
  if (Array.isArray(o.competences)) {
    for (const item of o.competences) {
      if (item && typeof item === "object") {
        const c = item as Record<string, unknown>;
        if (typeof c.libelle === "string" && c.libelle.trim()) {
          skills.push({
            name: c.libelle.trim(),
            required: c.exigence === "E",
          });
        }
      }
    }
  }

  // Qualités professionnelles
  const professionalQualities: NormalizedQuality[] = [];
  if (Array.isArray(o.qualitesProfessionnelles)) {
    for (const item of o.qualitesProfessionnelles) {
      if (item && typeof item === "object") {
        const q = item as Record<string, unknown>;
        if (typeof q.libelle === "string" && q.libelle.trim()) {
          professionalQualities.push({
            label: q.libelle.trim(),
            description:
              typeof q.description === "string" && q.description.trim()
                ? q.description.trim()
                : undefined,
          });
        }
      }
    }
  }

  const normalizedSkills = canonicalSkills(skills);
  const normalizedQualities = canonicalQualities(professionalQualities);

  // Origine et URL source
  let sourceUrl: string | null = null;
  if (o.origineOffre && typeof o.origineOffre === "object") {
    const orig = o.origineOffre as Record<string, unknown>;
    sourceUrl = safeUrl(orig.urlOrigine);
  }

  const createdAtSource = safeIsoDate(o.dateCreation);
  const updatedAtSource = safeIsoDate(o.dateActualisation);

  // Checksum des données utiles normalisées
  const signatureData = {
    external_id: rawId,
    title: rawTitle,
    description,
    rome_code: romeCode,
    rome_label: romeLabel,
    company_name: companyName,
    contract_type: contractType,
    contract_label: contractLabel,
    experience_label: experienceLabel,
    postal_code: postalCode,
    city,
    latitude,
    longitude,
    salary_label: salaryLabel,
    working_time: workingTime,
    positions,
    skills: normalizedSkills,
    professional_qualities: normalizedQualities,
    source_url: sourceUrl,
    created_at_source: createdAtSource,
    updated_at_source: updatedAtSource,
  };

  const rawChecksum = createHash("sha256")
    .update(JSON.stringify(signatureData))
    .digest("hex");

  return {
    success: true,
    data: {
      source: "france_travail",
      external_id: rawId,
      title: rawTitle,
      description,
      rome_code: romeCode,
      rome_label: romeLabel,
      company_name: companyName,
      contract_type: contractType,
      contract_label: contractLabel,
      experience_label: experienceLabel,
      postal_code: postalCode,
      city,
      latitude,
      longitude,
      salary_label: salaryLabel,
      working_time: workingTime,
      positions,
      skills: normalizedSkills,
      professional_qualities: normalizedQualities,
      source_url: sourceUrl,
      created_at_source: createdAtSource,
      updated_at_source: updatedAtSource,
      raw_checksum: rawChecksum,
    },
  };
}
