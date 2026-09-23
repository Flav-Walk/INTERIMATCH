import type { MissionMedia } from "../services/missions";

/*
 * Photos d'illustration par famille de métier.
 *
 * À quoi ça sert : tout poste SANS photo en reçoit une automatiquement, en
 * rapport avec son intitulé. Ça couvre :
 *   - chaque nouvelle offre France Travail importée (elles n'ont jamais de
 *     photo) ;
 *   - les anciennes missions InteriMatch créées avant que la photo ne soit
 *     obligatoire.
 * Une mission dont l'établissement a choisi sa photo garde SA photo.
 *
 * Honnêteté : ces photos ne montrent pas l'établissement. Elles sont donc
 * toujours signalées « Photo d'illustration » à l'écran, avec le crédit du
 * photographe (obligatoire chez Unsplash).
 *
 * Photos gratuites Unsplash (pas Unsplash+), choisies à la main, 3 par
 * famille pour que deux cartes voisines n'aient pas toujours la même.
 * Pour en ajouter : copier l'identifiant « photo-… » de l'image et l'auteur.
 */

export type JobFamily = "salle" | "cuisine" | "bar" | "reception";

/** Une photo au format « Unsplash » de MissionMedia (avec thumb_url). */
type UnsplashMedia = Extract<MissionMedia, { provider: "unsplash" }>;

/**
 * Famille d'un poste d'après son intitulé. L'ordre compte : « chef de rang »
 * et « maître d'hôtel » sont des métiers de salle, même s'ils contiennent
 * « chef » ou « hôtel ».
 */
export function jobFamily(title: string): JobFamily {
  if (/chef de rang|ma[îi]tre d|serveu|salle|runner/i.test(title)) return "salle";
  if (/r[ée]cep|h[ôo]tel|concierge|veilleur|voiturier/i.test(title))
    return "reception";
  if (/bar|cocktail|sommeli|caviste|barista/i.test(title)) return "bar";
  if (/cuisin|chef|commis|plong|p[âa]tiss|boulang|traiteur/i.test(title))
    return "cuisine";
  return "salle";
}

interface LibraryPhoto {
  /** Identifiant de l'image sur le CDN Unsplash (après « photo- »). */
  cdn: string;
  author: string;
  /** Pseudo du photographe sur Unsplash (sans le @). */
  handle: string;
  alt: string;
}

const LIBRARY: Record<JobFamily, LibraryPhoto[]> = {
  salle: [
    { cdn: "1566670735914-b2038696981d", author: "Louis Hansel", handle: "louishansel", alt: "Serveur tenant une assiette en salle" },
    { cdn: "1671588623593-6f80c45ed94f", author: "leo Caman", handle: "leocaman", alt: "Serveur dressant une table avec des verres à vin" },
    { cdn: "1744793981680-1914b08bf994", author: "Haberdoedas", handle: "haberdoedas", alt: "Serveuse servant des gâteaux et du café" },
  ],
  cuisine: [
    { cdn: "1622021142947-da7dedc7c39a", author: "Pylyp Sukhenko", handle: "novokayn", alt: "Chef coupant des légumes en cuisine" },
    { cdn: "1600565193348-f74bd3c7ccdf", author: "Johnathan Macedo", handle: "johnathanmphoto", alt: "Cuisinier en tenue blanche en cuisine" },
    { cdn: "1577219492769-b63a779fac28", author: "Louis Hansel", handle: "louishansel", alt: "Chef préparant une assiette" },
  ],
  bar: [
    { cdn: "1647776112336-72f4c30fafc1", author: "Olena Bohovyk", handle: "olenkasergienko", alt: "Barman préparant un cocktail au bar" },
    { cdn: "1623408859815-22534357b3db", author: "Bjarne Vijfvinkel", handle: "capturesbybjarne", alt: "Cocktail versé dans un verre" },
    { cdn: "1470337458703-46ad1756a187", author: "Adam Jaime", handle: "arobj", alt: "Cocktail ambré versé sur un grand glaçon" },
  ],
  reception: [
    { cdn: "1759038085950-1234ca8f5fed", author: "Neon Wang", handle: "neonwangphotography", alt: "Réception d'hôtel au mobilier en bois" },
    { cdn: "1763560705345-5aed55f99c8f", author: "Dushyant Bhardwaj", handle: "bajajmovie", alt: "Hall d'hôtel avec l'accueil" },
    { cdn: "1758708536313-e7055ddba277", author: "Jonathan Cosens Photography", handle: "jcosens", alt: "Cloche de service sur un comptoir d'accueil" },
  ],
};

/** Petit hachage stable : la même offre retombe toujours sur la même photo. */
function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

// Paramètres demandés par Unsplash sur les liens de crédit.
const UTM = "?utm_source=interimatch&utm_medium=referral";

/**
 * Photo d'illustration d'un poste, au même format qu'une photo Unsplash
 * choisie par un établissement : les composants existants (carte, crédit)
 * l'affichent sans code en plus.
 * `seed` : l'identifiant du poste, pour varier les photos d'une carte à
 * l'autre tout en gardant toujours la même pour un poste donné.
 */
export function illustrationFor(title: string, seed: string): UnsplashMedia {
  const photos = LIBRARY[jobFamily(title)];
  const photo = photos[hash(seed) % photos.length];
  const base = `https://images.unsplash.com/photo-${photo.cdn}?auto=format&fit=crop`;
  return {
    provider: "unsplash",
    url: `${base}&w=1400&q=70`,
    thumb_url: `${base}&w=600&q=60`,
    external_id: photo.cdn,
    author_name: photo.author,
    author_url: `https://unsplash.com/@${photo.handle}${UTM}`,
    alt: photo.alt,
  };
}
