/**
 * Géocodage ville + code postal → coordonnées.
 *
 * L'utilisateur ne saisit jamais de latitude/longitude : ce sont des données
 * techniques dérivées, nécessaires au futur scoring de localisation (D04).
 *
 * Service retenu : la Base Adresse Nationale (api-adresse.data.gouv.fr),
 * service public français, gratuit, sans clé d'API ni quota contractuel.
 * Aucune dépendance npm ajoutée : `fetch` natif suffit.
 *
 * Le géocodage ne doit jamais bloquer l'enregistrement d'un profil : une panne,
 * un timeout ou une commune introuvable renvoient `null`, le profil est
 * enregistré sans coordonnées et `geocoded_at` reste vide, ce qui permet de
 * réessayer plus tard.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type Geocoder = (
  city: string,
  postalCode: string,
) => Promise<Coordinates | null>;

const ENDPOINT = "https://api-adresse.data.gouv.fr/search/";
const TIMEOUT_MS = 4000;

export function createAddressGeocoder(
  endpoint = ENDPOINT,
  timeoutMs = TIMEOUT_MS,
): Geocoder {
  return async (city, postalCode) => {
    const url = new URL(endpoint);
    url.searchParams.set("q", city);
    url.searchParams.set("postcode", postalCode);
    url.searchParams.set("type", "municipality");
    url.searchParams.set("limit", "1");
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return readCoordinates(await response.json());
    } catch {
      // Panne réseau, timeout, réponse illisible : on renonce silencieusement.
      return null;
    }
  };
}

/** La BAN renvoie du GeoJSON : coordinates = [longitude, latitude]. */
export function readCoordinates(payload: unknown): Coordinates | null {
  if (typeof payload !== "object" || payload === null) return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const coordinates = (
    features[0] as { geometry?: { coordinates?: unknown } } | null
  )?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  if (typeof longitude !== "number" || typeof latitude !== "number")
    return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    return null;
  return { latitude, longitude };
}
