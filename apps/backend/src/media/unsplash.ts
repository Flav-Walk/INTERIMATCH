import { HttpError } from "../errors.js";
import type { UnsplashMissionMedia } from "./schemas.js";

/**
 * Accès à l'API Unsplash, côté serveur uniquement.
 *
 * POURQUOI LE SERVEUR ET PAS LE NAVIGATEUR. Unsplash accepte techniquement sa
 * clé d'accès en clair depuis un client (`Authorization: Client-ID …`). Nous ne
 * le faisons pas, pour deux raisons qui n'ont rien de théorique :
 *
 *  1. le quota est celui de l'APPLICATION, pas de l'utilisateur — 50 requêtes
 *     par heure en démonstration, 1000 une fois l'application validée. Une clé
 *     lisible dans le bundle, c'est un quota que n'importe qui peut épuiser ;
 *  2. la clé identifie l'application auprès d'Unsplash. La publier, c'est
 *     laisser un tiers agir sous notre nom.
 *
 * Le navigateur ne parle donc qu'à InteriMatch, qui parle à Unsplash.
 *
 * Conditions d'utilisation respectées ici :
 *  - les URL d'images servies sont celles renvoyées par l'API (`urls.*`), sans
 *    réécriture : Unsplash impose ce lien direct pour compter les vues et les
 *    reverser au photographe ;
 *  - le paramètre `ixid` présent dans ces URL est conservé tel quel ;
 *  - `links.download_location` est appelé au moment exact où l'entreprise
 *    retient une photo, comme l'exige la documentation — et n'est pas stocké.
 */
const API = "https://api.unsplash.com";

/** Ce que nous lisons d'une photo. Tout le reste est ignoré volontairement. */
interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  urls: { regular: string; small: string };
  links: { download_location: string };
  user: { name: string; links: { html: string } };
}

export interface UnsplashSearchResult {
  id: string;
  thumb_url: string;
  preview_url: string;
  alt: string | null;
  author_name: string;
  author_url: string;
}

/**
 * Nom transmis à Unsplash dans les liens d'attribution. Il identifie
 * l'application dans leurs statistiques de référencement.
 */
const APP_NAME = "interimatch";

/** `?utm_source=…&utm_medium=referral`, exigé sur tout lien de crédit. */
export function withReferral(link: string) {
  try {
    const url = new URL(link);
    url.searchParams.set("utm_source", APP_NAME);
    url.searchParams.set("utm_medium", "referral");
    return url.toString();
  } catch {
    return link;
  }
}

export class UnsplashService {
  constructor(
    private accessKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API}${path}`, {
        headers: {
          Authorization: `Client-ID ${this.accessKey}`,
          "Accept-Version": "v1",
        },
      });
    } catch {
      // Panne réseau : le message dit quoi faire, car l'autre voie reste ouverte.
      throw new HttpError(
        503,
        "UNSPLASH_UNAVAILABLE",
        "La bibliothèque de photos est momentanément indisponible. Vous pouvez importer une photo depuis votre ordinateur.",
      );
    }
    if (response.status === 403 || response.status === 429)
      throw new HttpError(
        503,
        "UNSPLASH_RATE_LIMITED",
        "La bibliothèque de photos a atteint sa limite horaire. Réessayez plus tard, ou importez une photo depuis votre ordinateur.",
      );
    if (response.status === 404)
      throw new HttpError(
        404,
        "UNSPLASH_PHOTO_NOT_FOUND",
        "Cette photo n'existe plus dans la bibliothèque.",
      );
    if (!response.ok)
      throw new HttpError(
        503,
        "UNSPLASH_UNAVAILABLE",
        "La bibliothèque de photos est momentanément indisponible. Vous pouvez importer une photo depuis votre ordinateur.",
      );
    return (await response.json()) as T;
  }

  /** Recherche. `content_filter=high` : le catalogue s'affiche à des recruteurs. */
  async search(query: string, page: number) {
    const parameters = new URLSearchParams({
      query,
      page: String(page),
      per_page: "12",
      orientation: "landscape",
      content_filter: "high",
    });
    const payload = await this.call<{
      total: number;
      total_pages: number;
      results: UnsplashPhoto[];
    }>(`/search/photos?${parameters}`);
    return {
      total: payload.total,
      total_pages: payload.total_pages,
      results: payload.results.map((photo): UnsplashSearchResult => ({
        id: photo.id,
        thumb_url: photo.urls.small,
        preview_url: photo.urls.regular,
        alt: photo.alt_description,
        author_name: photo.user.name,
        author_url: withReferral(photo.user.links.html),
      })),
    };
  }

  /**
   * Résout la photo retenue et déclare son usage à Unsplash.
   *
   * L'appel à `download_location` est la contrepartie du service : il fait
   * remonter l'usage au photographe. Il est déclenché ici, une fois, au moment
   * où l'entreprise associe réellement la photo à sa mission — pas à chaque
   * affichage de carte, ce qui fausserait le compte autant que de ne rien
   * envoyer.
   *
   * Son échec n'annule pas l'enregistrement : la mission de l'entreprise ne
   * dépend pas d'une statistique. Le refus d'Unsplash sur la LECTURE de la
   * photo, lui, est bien remonté — sans elle, il n'y a pas d'attribution, donc
   * pas de média valable.
   */
  async resolve(id: string): Promise<UnsplashMissionMedia> {
    const photo = await this.call<UnsplashPhoto>(
      `/photos/${encodeURIComponent(id)}`,
    );
    try {
      await this.fetchImpl(photo.links.download_location, {
        headers: { Authorization: `Client-ID ${this.accessKey}` },
      });
    } catch {
      // Statistique manquée, rien de plus. L'entreprise n'a pas à en pâtir.
    }
    return {
      provider: "unsplash",
      external_id: photo.id,
      url: photo.urls.regular,
      thumb_url: photo.urls.small,
      author_name: photo.user.name,
      author_url: withReferral(photo.user.links.html),
      ...(photo.alt_description ? { alt: photo.alt_description } : {}),
    };
  }
}
