/*
 * Photos de fond du bandeau (HeroBanner), une par rubrique.
 *
 * Pour mettre une vraie photo : déposer le fichier dans
 * public/images/hero/ avec le nom indiqué ci-dessous (ex. dashboard.jpg).
 * Tant que le fichier n'existe pas, le bandeau affiche la photo provisoire
 * FALLBACK_HERO_IMAGE (voir onError dans HeroBanner).
 *
 * Direction artistique visée, pour que la série soit cohérente :
 *   - lieux réels de l'hôtellerie-restauration lyonnaise ;
 *   - lumière naturelle et chaude, pas de pose face caméra ;
 *   - sujet plutôt à DROITE de l'image : la gauche passe sous le texte.
 * Le voile vert et le grain sont ajoutés en CSS : inutile de retoucher.
 */

export const FALLBACK_HERO_IMAGE = "/images/fixtures/mission.jpg";

interface HeroImage {
  src: string;
  /** Cadrage CSS (object-position), pour garder le sujet visible. */
  position?: string;
}

// Du plus précis au plus général : la première règle qui correspond gagne.
const HERO_IMAGES: Array<[prefix: string, image: HeroImage]> = [
  ["/worker/public-offers", { src: "/images/hero/offres.jpg" }], // terrasse, service
  ["/worker/profile", { src: "/images/hero/profil.jpg" }], // serveur en salle
  ["/worker/documents", { src: "/images/hero/documents.jpg" }], // réception d'hôtel
  ["/worker/missions", { src: "/images/hero/missions.jpg" }], // brigade en cuisine
  ["/company/missions", { src: "/images/hero/missions.jpg" }],
  ["/company/applications", { src: "/images/hero/candidatures.jpg" }], // équipe au briefing
  ["/", { src: "/images/hero/dashboard.jpg" }], // salle de bouchon lyonnais
];

export function heroImageFor(pathname: string): HeroImage {
  const match = HERO_IMAGES.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : { src: FALLBACK_HERO_IMAGE };
}
