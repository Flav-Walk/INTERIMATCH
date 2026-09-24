import {
  ArrowRight,
  Briefcase,
  Users,
} from "lucide-react";
// Fond photo animé. À droite du titre : les faisceaux d'Animated Beam
// (Magic UI), à la place de l'ancienne carte « InteriMatch vous accompagne ».
import { PhotoBackdrop } from "../components/PhotoBackdrop";
import { MatchingBeam } from "../components/da/MatchingBeam";
// Bandeau défilant des métiers et des villes (Marquee, Magic UI), à la place
// des pastilles en verre posées sur les photos.
import { JobsMarquee } from "../components/da/JobsMarquee";
// Le métier qui change dans l'accroche (Word Rotate, Magic UI).
import { WordRotate } from "../components/ui/word-rotate";
// Sections « Intérimaires » et « Établissements » : grille bento (Aceternity)
// avec la photo du métier et un visuel animé par avantage (Magic UI, Animata).
import { CompanyBento, WorkerBento } from "../components/da/HomeBento";
import { illustrationFor } from "../lib/job-photos";
import { UnsplashCredit } from "../components/mission/MissionPhotoField";
import { motion, useReducedMotion } from "motion/react";
import { cascade, revealOnScroll, rise } from "../lib/motion";
// CTA : halo qui suit la souris (principaux, Hover.dev) et fond qui glisse
// au survol (secondaires). Les classes home-cta gardent le style d'origine.
import { SpotlightLink } from "../components/ui/spotlight-button";
import { SlideFillLink } from "../components/ui/slide-fill-button";
import { SITE_URL, usePageSeo } from "../hooks/usePageSeo";

const WORKER_FEATURES = [
  {
    title: "Des missions dans votre zone",
    desc: "Les besoins publiés en Auvergne-Rhône-Alpes sont rapprochés de votre mobilité.",
  },
  {
    title: "Un rapprochement expliqué",
    desc: "Métier, compétences et distance rendent chaque proposition compréhensible.",
  },
  {
    title: "Votre agenda reste le vôtre",
    desc: "Vous renseignez vos créneaux et choisissez les missions auxquelles postuler.",
  },
];

const COMPANY_FEATURES = [
  {
    title: "Des profils adaptés au besoin",
    desc: "Les compétences, disponibilités et mobilité renseignées alimentent le rapprochement.",
  },
  {
    title: "Un besoin décrit précisément",
    desc: "Poste, horaires, lieu et compétences structurent chaque mission publiée.",
  },
  {
    title: "Des échanges maîtrisés",
    desc: "L’établissement examine les candidatures reçues et décide de l’attribution.",
  },
];

const HOW_STEPS = [
  {
    num: "01",
    title: "Construisez votre profil",
    desc: "Métier, compétences, mobilité et disponibilités.",
  },
  {
    num: "02",
    title: "Découvrez les missions",
    desc: "Le rapprochement met en avant celles qui correspondent à votre situation.",
  },
  {
    num: "03",
    title: "Candidatez simplement",
    desc: "L’établissement reçoit votre candidature et vous retrouvez son suivi dans votre espace.",
  },
];

/*
 * Photos d'illustration de l'accueil, prises dans la bibliothèque des métiers
 * (lib/job-photos.ts). La « graine » fixe le choix : la page affiche toujours
 * les mêmes photos.
 */
const WORKER_PHOTO = illustrationFor("Serveur en salle", "accueil-interimaires");
const COMPANY_PHOTO = illustrationFor("Cuisinier", "accueil-etablissements");
const FINAL_PHOTO = illustrationFor("Barman", "accueil-appel-final");

export function Home() {
  usePageSeo({
    title: "InteriMatch · Missions et recrutement en hôtellerie-restauration",
    description:
      "Plateforme de mise en relation entre professionnels et établissements de l’hôtellerie-restauration. Missions adaptées, compétences et disponibilités.",
    robots: "index,follow",
    // Page publique : URL canonique et balises de partage (Open Graph).
    path: "/",
    // Données structurées schema.org : qui est InteriMatch, quel site.
    // Pas de JobPosting : les missions sont privées (réservées aux inscrits).
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "InteriMatch",
          url: SITE_URL,
          description:
            "Plateforme de mise en relation entre professionnels et établissements de l’hôtellerie-restauration.",
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "InteriMatch",
          url: SITE_URL,
          inLanguage: "fr-FR",
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ],
    },
  });
  const reduceMotion = useReducedMotion();
  // Révélation au scroll, sauf si « Réduire les animations » est activé.
  const reveal = reduceMotion ? {} : revealOnScroll;

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="hero-title">
        <PhotoBackdrop src="/images/hero/accueil.jpg" />
        <div className="home-hero__inner">
          <div className="home-hero__body">
            {/* Accroche en texte simple, plus de pilule : seul le métier
                bouge (Word Rotate). */}
            <p className="home-hero__kicker">
              Missions de{" "}
              <WordRotate
                words={["serveur", "cuisinier", "barman", "réceptionniste"]}
                className="home-hero__kicker-word"
              />{" "}
              en Auvergne-Rhône-Alpes
            </p>
            <h1 id="hero-title" className="home-hero__title">
              Les bonnes personnes,
              <span className="home-hero__accent"> au bon moment.</span>
            </h1>
            <p className="home-hero__lead">
              InteriMatch rapproche les besoins des établissements HCR et les
              profils disponibles, avec des critères visibles et un suivi
              simple de chaque candidature.
            </p>
            {/* Toujours la version publique : l'accueil est la vitrine du
                site, il s'affiche pareil pour tout le monde. */}
            <div className="home-hero__ctas">
              <SpotlightLink className="home-cta home-cta--primary" to="/register">
                Créer mon profil
                <ArrowRight size={18} aria-hidden="true" />
              </SpotlightLink>
              <SlideFillLink
                className="home-cta home-cta--ghost"
                to="/login"
                color="var(--surface)"
              >
                Me connecter
              </SlideFillLink>
            </div>
          </div>
          <div className="home-hero__beam">
            <MatchingBeam />
          </div>
        </div>
      </section>

      <JobsMarquee />

      {/* Intérimaires : titre et bouton en ligne, puis la grille bento
          (Aceternity) dont chaque case porte un visuel animé. */}
      <section className="home-section home-path" aria-labelledby="worker-title">
        <div className="home-section__inner home-path__stack">
          <div className="home-path__head">
            <div>
              <span className="home-section__tag">Intérimaires</span>
              <h2 id="worker-title">Votre profil ouvre le bon chemin</h2>
              <p>
                Plus votre situation est précise, plus les propositions sont
                faciles à comprendre et à choisir.
              </p>
            </div>
            <SlideFillLink
              className="home-cta home-cta--outline"
              to="/register"
            >
              <Briefcase size={16} aria-hidden="true" />
              Créer mon profil intérimaire
            </SlideFillLink>
          </div>
          <WorkerBento features={WORKER_FEATURES} photo={WORKER_PHOTO} />
        </div>
      </section>

      <section
        className="home-section home-section--tinted home-path home-path--company"
        aria-labelledby="company-title"
      >
        <div className="home-section__inner home-path__stack">
          <div className="home-path__head">
            <div>
              <span className="home-section__tag home-section__tag--orange">
                Établissements
              </span>
              <h2 id="company-title">Un recrutement lisible, de bout en bout</h2>
              <p>
                Décrivez la mission, consultez les candidatures et attribuez
                les postes depuis le même espace.
              </p>
            </div>
            <div className="home-company-access">
              <span>Vous disposez déjà d’un accès établissement ?</span>
              <SlideFillLink className="home-cta home-cta--outline" to="/login">
                <Users size={16} aria-hidden="true" />
                Accéder à l’espace entreprise
              </SlideFillLink>
            </div>
          </div>
          <CompanyBento features={COMPANY_FEATURES} photo={COMPANY_PHOTO} />
        </div>
      </section>

      <section className="home-section home-how" aria-labelledby="how-title">
        <div className="home-section__inner home-how__inner">
          <div className="home-section__head">
            <span className="home-section__tag">Le parcours intérimaire</span>
            <h2 id="how-title">Trois étapes, sans détour</h2>
            <p>Chaque étape correspond à une action réellement disponible.</p>
          </div>
          {/* Les étapes apparaissent l'une après l'autre au scroll. */}
          <motion.ol
            className="home-steps"
            aria-label="Étapes pour utiliser InteriMatch"
            variants={cascade}
            {...reveal}
          >
            {HOW_STEPS.map((step) => (
              <motion.li key={step.num} className="home-step" variants={rise}>
                <span className="home-step__num" aria-hidden="true">
                  {step.num}
                </span>
                <div>
                  <h3 className="home-step__title">{step.title}</h3>
                  <p className="home-step__desc">{step.desc}</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      <section className="home-final-cta" aria-labelledby="final-cta-title">
        {/* Photo de fond (illustration), voile vert, crédit en bas. */}
        <PhotoBackdrop src={FINAL_PHOTO.url} />
        <motion.div
          className="home-final-cta__inner"
          variants={rise}
          {...reveal}
        >
          <div>
            <h2 id="final-cta-title">Prêt à construire votre profil ?</h2>
            <p>
              Commencez par vos informations professionnelles, puis complétez
              vos disponibilités à votre rythme.
            </p>
          </div>
          <SpotlightLink className="home-cta home-cta--primary" to="/register">
            Créer mon compte intérimaire
            <ArrowRight size={18} aria-hidden="true" />
          </SpotlightLink>
        </motion.div>
        <UnsplashCredit media={FINAL_PHOTO} className="photo-credit home-final-cta__credit" />
      </section>
    </div>
  );
}
