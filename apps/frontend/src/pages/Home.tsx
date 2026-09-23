import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { MatchyMascot } from "../components/MatchyMascot";
// Grille bento (Aceternity UI) pour les avantages, à la place des 3 blocs
// identiques qu'on avait avant.
import { FeatureBento } from "../components/home/FeatureBento";
// CTA de Hover.dev : halo qui suit la souris (principaux) et contour qui se
// dessine au survol (secondaires). Les classes home-cta gardent le style.
import { SpotlightLink } from "../components/ui/spotlight-button";
import { DrawOutlineLink } from "../components/ui/draw-outline-button";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination } from "../services/session";

const WORKER_FEATURES = [
  {
    icon: <MapPin size={21} aria-hidden="true" />,
    title: "Des missions dans votre zone",
    desc: "Les besoins publiés en Auvergne-Rhône-Alpes sont rapprochés de votre mobilité.",
  },
  {
    icon: <Sparkles size={21} aria-hidden="true" />,
    title: "Un rapprochement expliqué",
    desc: "Métier, compétences et distance rendent chaque proposition compréhensible.",
  },
  {
    icon: <CalendarCheck size={21} aria-hidden="true" />,
    title: "Votre agenda reste le vôtre",
    desc: "Vous renseignez vos créneaux et choisissez les missions auxquelles postuler.",
  },
];

const COMPANY_FEATURES = [
  {
    icon: <Users size={21} aria-hidden="true" />,
    title: "Des profils adaptés au besoin",
    desc: "Les compétences, disponibilités et mobilité renseignées alimentent le rapprochement.",
  },
  {
    icon: <ClipboardList size={21} aria-hidden="true" />,
    title: "Un besoin décrit précisément",
    desc: "Poste, horaires, lieu et compétences structurent chaque mission publiée.",
  },
  {
    icon: <ShieldCheck size={21} aria-hidden="true" />,
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

export function Home() {
  usePageSeo({
    title: "InteriMatch · Missions et recrutement en hôtellerie-restauration",
    description:
      "Plateforme de mise en relation entre professionnels et établissements de l’hôtellerie-restauration. Missions adaptées, compétences et disponibilités.",
    robots: "index,follow",
  });
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="hero-title">
        <span className="home-hero__arch home-hero__arch--one" aria-hidden />
        <span className="home-hero__arch home-hero__arch--two" aria-hidden />
        <div className="home-hero__inner">
          <div className="home-hero__body">
            <span className="home-hero__eyeline">
              Hôtellerie · Restauration · Auvergne-Rhône-Alpes
            </span>
            <h1 id="hero-title" className="home-hero__title">
              Les bonnes personnes,
              <span className="home-hero__accent"> au bon moment.</span>
            </h1>
            <p className="home-hero__lead">
              InteriMatch rapproche les besoins des établissements HCR et les
              profils disponibles, avec des critères visibles et un suivi
              simple de chaque candidature.
            </p>
            {user ? (
              <SpotlightLink
                className="home-cta home-cta--primary"
                to={destination(user)}
              >
                Retrouver mon espace
                <ArrowRight size={18} aria-hidden="true" />
              </SpotlightLink>
            ) : (
              <div className="home-hero__ctas">
                <SpotlightLink className="home-cta home-cta--primary" to="/register">
                  Créer mon profil
                  <ArrowRight size={18} aria-hidden="true" />
                </SpotlightLink>
                <DrawOutlineLink
                  className="home-cta home-cta--ghost"
                  to="/login"
                  borderWidth={1}
                >
                  Me connecter
                </DrawOutlineLink>
              </div>
            )}
          </div>
          <div className="home-hero__visual">
            <div className="home-hero__matchy-frame">
              <p>
                <strong>InteriMatch vous accompagne</strong>
                <span>Du profil jusqu’à la mission confirmée.</span>
              </p>
              <MatchyMascot pose="missions" includeBackground size={310} />
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-path" aria-labelledby="worker-title">
        <div className="home-section__inner home-path__inner">
          <div className="home-path__intro">
            <span className="home-section__tag">Intérimaires</span>
            <h2 id="worker-title">Votre profil ouvre le bon chemin</h2>
            <p>
              Plus votre situation est précise, plus les propositions sont
              faciles à comprendre et à choisir.
            </p>
            {!user && (
              <DrawOutlineLink
                className="home-cta home-cta--outline"
                to="/register"
                borderWidth={2}
              >
                <Briefcase size={16} aria-hidden="true" />
                Créer mon profil intérimaire
              </DrawOutlineLink>
            )}
          </div>
          <FeatureBento features={WORKER_FEATURES} />
        </div>
      </section>

      <section
        className="home-section home-section--tinted home-path home-path--company"
        aria-labelledby="company-title"
      >
        <div className="home-section__inner home-path__inner">
          <div className="home-path__intro">
            <span className="home-section__tag home-section__tag--orange">
              Établissements
            </span>
            <h2 id="company-title">Un recrutement lisible, de bout en bout</h2>
            <p>
              Décrivez la mission, consultez les candidatures et attribuez les
              postes depuis le même espace.
            </p>
            {!user && (
              <div className="home-company-access">
                <span>Vous disposez déjà d’un accès établissement ?</span>
                <DrawOutlineLink
                  className="home-cta home-cta--outline"
                  to="/login"
                  borderWidth={2}
                >
                  <Users size={16} aria-hidden="true" />
                  Accéder à l’espace entreprise
                </DrawOutlineLink>
              </div>
            )}
          </div>
          <FeatureBento features={COMPANY_FEATURES} tone="orange" />
        </div>
      </section>

      <section className="home-section home-how" aria-labelledby="how-title">
        <div className="home-section__inner home-how__inner">
          <div className="home-section__head">
            <span className="home-section__tag">Le parcours intérimaire</span>
            <h2 id="how-title">Trois étapes, sans détour</h2>
            <p>Chaque étape correspond à une action réellement disponible.</p>
          </div>
          <ol className="home-steps" aria-label="Étapes pour utiliser InteriMatch">
            {HOW_STEPS.map((step) => (
              <li key={step.num} className="home-step">
                <span className="home-step__num" aria-hidden="true">
                  {step.num}
                </span>
                <div>
                  <h3 className="home-step__title">{step.title}</h3>
                  <p className="home-step__desc">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {!user && (
        <section className="home-final-cta" aria-labelledby="final-cta-title">
          <div className="home-final-cta__inner">
            <span className="home-final-cta__icon" aria-hidden="true">
              <Sparkles size={22} />
            </span>
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
          </div>
        </section>
      )}
    </div>
  );
}
