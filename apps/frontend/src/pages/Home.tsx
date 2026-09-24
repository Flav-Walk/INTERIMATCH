import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination } from "../services/session";

/*
 * Page d'accueil publique.
 *
 * Refonte : la mascotte et les pictos dans des pastilles teintées sont
 * retirés. Le visuel du haut devient un « ticket » de mission, dans l'esprit
 * d'un bon de commande de brasserie : il montre la promesse — des critères
 * visibles — au lieu de l'illustrer. Tous les titres, boutons et liens gardent
 * leur texte exact (tests e2e et SEO).
 */

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

/** Critères du ticket d'exemple : ce que le rapprochement vérifie. */
const TICKET_CRITERIA = ["Métier et compétences", "Zone de mobilité", "Disponibilité"];

function FeatureList({ features }: { features: typeof WORKER_FEATURES }) {
  return (
    <ul className="landing-features">
      {features.map((feature) => (
        <li key={feature.title}>
          <h3>{feature.title}</h3>
          <p>{feature.desc}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ticket d'exemple. Purement illustratif : il est masqué aux lecteurs
 * d'écran et porte la mention « Exemple » pour ne jamais passer pour une
 * vraie mission ni un vrai chiffre.
 */
function MissionTicket() {
  return (
    <div className="landing-ticket" aria-hidden="true">
      <div className="landing-ticket__head">
        <span className="landing-ticket__tag">Exemple</span>
        <span className="landing-ticket__no">Bon n° 0412</span>
      </div>
      <p className="landing-ticket__role">Chef de rang</p>
      <dl className="landing-ticket__meta">
        <div>
          <dt>Service</dt>
          <dd>Samedi soir</dd>
        </div>
        <div>
          <dt>Horaires</dt>
          <dd>18h – 23h30</dd>
        </div>
        <div>
          <dt>Lieu</dt>
          <dd>Lyon 2e</dd>
        </div>
      </dl>
      <ul className="landing-ticket__criteria">
        {TICKET_CRITERIA.map((criterion) => (
          <li key={criterion}>
            <Check size={15} strokeWidth={2.5} />
            {criterion}
          </li>
        ))}
      </ul>
      <p className="landing-ticket__foot">
        <strong>InteriMatch vous accompagne</strong>
        <span>Du profil jusqu’à la mission confirmée.</span>
      </p>
    </div>
  );
}

export function Home() {
  usePageSeo({
    title: "InteriMatch · Missions et recrutement en hôtellerie-restauration",
    description:
      "Plateforme de mise en relation entre professionnels et établissements de l’hôtellerie-restauration. Missions adaptées, compétences et disponibilités.",
    robots: "index,follow",
  });
  const { user } = useAuth();

  return (
    <div className="landing">
      {/* ---------- Ouverture ---------- */}
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero__body">
          <span className="landing-hero__eyeline">
            Hôtellerie · Restauration · Auvergne-Rhône-Alpes
          </span>
          <h1 id="hero-title" className="landing-hero__title">
            Les bonnes personnes,
            <span className="landing-hero__accent"> au bon moment.</span>
          </h1>
          <p className="landing-hero__lead">
            InteriMatch rapproche les besoins des établissements HCR et les
            profils disponibles, avec des critères visibles et un suivi simple
            de chaque candidature.
          </p>
          {user ? (
            <div className="landing-hero__ctas">
              <Link className="button" to={destination(user)}>
                Retrouver mon espace
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="landing-hero__ctas">
              <Link className="button" to="/register">
                Créer mon profil
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="landing-hero__ghost" to="/login">
                Me connecter
              </Link>
            </div>
          )}
        </div>
        <div className="landing-hero__visual">
          <MissionTicket />
        </div>
      </section>

      {/* ---------- Deux publics, deux colonnes ---------- */}
      <div className="landing-paths">
        <section className="landing-path" aria-labelledby="worker-title">
          <span className="kicker">Intérimaires</span>
          <h2 id="worker-title">Votre profil ouvre le bon chemin</h2>
          <p className="landing-path__lead">
            Plus votre situation est précise, plus les propositions sont
            faciles à comprendre et à choisir.
          </p>
          <FeatureList features={WORKER_FEATURES} />
          {!user && (
            <Link className="secondary-button" to="/register">
              Créer mon profil intérimaire
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>

        <section
          className="landing-path landing-path--company"
          aria-labelledby="company-title"
        >
          <span className="kicker">Établissements</span>
          <h2 id="company-title">Un recrutement lisible, de bout en bout</h2>
          <p className="landing-path__lead">
            Décrivez la mission, consultez les candidatures et attribuez les
            postes depuis le même espace.
          </p>
          <FeatureList features={COMPANY_FEATURES} />
          {!user && (
            <div className="landing-path__access">
              <span>Vous disposez déjà d’un accès établissement ?</span>
              <Link className="secondary-button" to="/login">
                Accéder à l’espace entreprise
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* ---------- Parcours ---------- */}
      <section className="landing-how" aria-labelledby="how-title">
        <header className="landing-how__head">
          <span className="kicker">Le parcours intérimaire</span>
          <h2 id="how-title">Trois étapes, sans détour</h2>
          <p>Chaque étape correspond à une action réellement disponible.</p>
        </header>
        <ol
          className="landing-steps"
          aria-label="Étapes pour utiliser InteriMatch"
        >
          {HOW_STEPS.map((step) => (
            <li key={step.num} className="landing-step">
              <span className="landing-step__num" aria-hidden="true">
                {step.num}
              </span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Appel final ---------- */}
      {!user && (
        <section className="landing-final" aria-labelledby="final-cta-title">
          <div>
            <h2 id="final-cta-title">Prêt à construire votre profil ?</h2>
            <p>
              Commencez par vos informations professionnelles, puis complétez
              vos disponibilités à votre rythme.
            </p>
          </div>
          <Link className="button" to="/register">
            Créer mon compte intérimaire
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}
