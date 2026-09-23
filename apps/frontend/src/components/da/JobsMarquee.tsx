import { Marquee } from "../ui/marquee";

/*
 * Bandeau qui défile sous le haut de l'accueil.
 *
 * Composant utilisé : Marquee de Magic UI
 * https://magicui.design/docs/components/marquee
 *
 * Il remplace les pastilles en verre posées sur les photos (« Critères
 * visibles », « Auvergne-Rhône-Alpes »), jugées trop « IA » en revue.
 * Ici, pas de pastille : du texte en Fraunces, les métiers en clair, les
 * villes en italique, séparés par une étoile orange. Deux lignes qui
 * défilent en sens inverse.
 *
 * Marquee duplique son contenu 4 fois et le fait glisser en boucle : une
 * seule copie est lue par les lecteurs d'écran (les autres sont masquées
 * par aria-hidden sur le bloc entier, et la liste est donnée en sr-only).
 */

const JOBS = [
  "Serveur",
  "Chef de partie",
  "Barman",
  "Réceptionniste",
  "Commis de cuisine",
  "Plongeur",
  "Maître d’hôtel",
];

const CITIES = [
  "Lyon",
  "Villeurbanne",
  "Annecy",
  "Grenoble",
  "Saint-Étienne",
  "Chambéry",
  "Clermont-Ferrand",
];

function Row({ items, italic = false }: { items: string[]; italic?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item}
          className={
            "flex items-center gap-6 whitespace-nowrap font-brand text-[clamp(1.5rem,3vw,2.25rem)] leading-none tracking-tight " +
            (italic ? "italic text-forest/55" : "font-medium text-forest")
          }
        >
          {item}
          {/* Étoile orange entre deux mots (décor). */}
          <span className="text-orange-ink text-[0.6em]" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </>
  );
}

export function JobsMarquee() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-surface py-6">
      <p className="sr-only">
        Métiers : {JOBS.join(", ")}. Villes : {CITIES.join(", ")}.
      </p>
      <div aria-hidden="true">
        <Marquee pauseOnHover className="[--duration:45s] [--gap:1.5rem]">
          <Row items={JOBS} />
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:55s] [--gap:1.5rem]">
          <Row items={CITIES} italic />
        </Marquee>
      </div>
      {/* Fondu sur les bords : les mots apparaissent et disparaissent en douceur. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-linear-to-r from-surface" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-linear-to-l from-surface" />
    </section>
  );
}
