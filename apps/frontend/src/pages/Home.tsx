// src/pages/Home.tsx
//
// Landing page publique ALP'EMPLOI — HCR / AURA.
// SEO : structure h1 → h2 sémantique, landmarks, textes indexables.
// RGAA 4.1 : aria-labels, contrastes WCAG AA, liens explicites.
// Aucune logique backend — useAuth() en lecture seule.

import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { destination } from "../services/session";

// ─── Données statiques (SEO — indexables) ─────────────────────────────────────

const WORKER_FEATURES = [
  {
    icon: <MapPin size={22} aria-hidden="true" />,
    title: "Missions près de chez vous",
    desc: "Uniquement des établissements en région Auvergne-Rhône-Alpes.",
  },
  {
    icon: <Sparkles size={22} aria-hidden="true" />,
    title: "Matching intelligent",
    desc: "Vos compétences et disponibilités sont croisés automatiquement avec les besoins.",
  },
  {
    icon: <CalendarCheck size={22} aria-hidden="true" />,
    title: "Flexibilité totale",
    desc: "Choisissez vos missions, refusez sans justification, gérez votre agenda.",
  },
];

const COMPANY_FEATURES = [
  {
    icon: <Users size={22} aria-hidden="true" />,
    title: "Des profils qualifiés HCR",
    desc: "Cuisiniers, serveurs, réceptionnistes — des professionnels vérifiés par leurs compétences.",
  },
  {
    icon: <ClipboardList size={22} aria-hidden="true" />,
    title: "Publiez en 3 minutes",
    desc: "Décrivez le poste, les horaires et les compétences : les candidatures arrivent.",
  },
  {
    icon: <ShieldCheck size={22} aria-hidden="true" />,
    title: "Conforme et sécurisé",
    desc: "Données chiffrées, RGPD respecté, contrats générés automatiquement.",
  },
];

const HOW_STEPS = [
  { num: "01", title: "Créez votre profil", desc: "Compétences, disponibilités, zone géographique." },
  { num: "02", title: "Recevez les missions", desc: "Seules les missions qui correspondent à votre profil apparaissent." },
  { num: "03", title: "Postulez en un clic", desc: "L'établissement reçoit votre candidature immédiatement." },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export function Home() {
  const { user } = useAuth();

  return (
    <div className="home">

      {/* ══════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero__inner">
          <div className="home-hero__body">

            <span className="home-hero__eyeline">
              <ChefHat size={14} aria-hidden="true" />
              Intérim Hôtellerie · Restauration · AURA
            </span>

            <h1 id="hero-title" className="home-hero__title">
              Les bonnes personnes,
              <span className="home-hero__accent"> au bon moment.</span>
            </h1>

            <p className="home-hero__lead">
              ALP'EMPLOI connecte les établissements HCR d'Auvergne-Rhône-Alpes
              avec des intérimaires qualifiés — en quelques minutes, sans
              intermédiaire.
            </p>

            {/* CTA — conditionnel selon l'état de connexion */}
            {user ? (
              <Link
                className="home-cta home-cta--primary"
                to={destination(user)}
                aria-label="Accéder à mon espace ALP'EMPLOI"
              >
                Retrouver mon espace
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <div className="home-hero__ctas">
                <Link
                  className="home-cta home-cta--primary"
                  to="/register"
                  aria-label="Créer un compte intérimaire ou établissement"
                >
                  Rejoindre ALP'EMPLOI
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  className="home-cta home-cta--ghost"
                  to="/login"
                  aria-label="Se connecter à mon compte existant"
                >
                  J'ai déjà un compte
                </Link>
              </div>
            )}
          </div>

          {/* Illustration décorative */}
          <div className="home-hero__visual" aria-hidden="true">
            <div className="home-hero__orb" />
            <ChefHat />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          POUR LES INTÉRIMAIRES
      ══════════════════════════════════════════════════════════════════ */}
      <section className="home-section" aria-labelledby="worker-title">
        <div className="home-section__inner">
          <div className="home-section__head">
            <span className="home-section__tag">Intérimaires</span>
            <h2 id="worker-title">Trouvez des missions qui vous ressemblent</h2>
            <p>
              Plus besoin de démarcher. Votre profil parle pour vous — les
              missions compatibles arrivent directement.
            </p>
          </div>

          <div className="home-features">
            {WORKER_FEATURES.map((f) => (
              <div key={f.title} className="home-feature-card">
                <div className="home-feature-card__icon">{f.icon}</div>
                <h3 className="home-feature-card__title">{f.title}</h3>
                <p className="home-feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>

          {!user && (
            <Link
              className="home-cta home-cta--outline"
              to="/register"
              aria-label="Créer un compte intérimaire HCR"
            >
              <Briefcase size={16} aria-hidden="true" />
              Créer mon profil intérimaire
            </Link>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          POUR LES ÉTABLISSEMENTS
      ══════════════════════════════════════════════════════════════════ */}
      <section className="home-section home-section--tinted" aria-labelledby="company-title">
        <div className="home-section__inner">
          <div className="home-section__head">
            <span className="home-section__tag home-section__tag--orange">
              Établissements
            </span>
            <h2 id="company-title">Renforcez votre équipe en quelques minutes</h2>
            <p>
              Décrivez votre besoin, recevez des profils compatibles. Sans
              agence, sans délai, sans surprise.
            </p>
          </div>

          <div className="home-features">
            {COMPANY_FEATURES.map((f) => (
              <div key={f.title} className="home-feature-card">
                <div className="home-feature-card__icon home-feature-card__icon--orange">
                  {f.icon}
                </div>
                <h3 className="home-feature-card__title">{f.title}</h3>
                <p className="home-feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>

          {!user && (
            <Link
              className="home-cta home-cta--outline"
              to="/register"
              aria-label="Créer un compte établissement HCR"
            >
              <Users size={16} aria-hidden="true" />
              Inscrire mon établissement
            </Link>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          COMMENT ÇA MARCHE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="home-section" aria-labelledby="how-title">
        <div className="home-section__inner">
          <div className="home-section__head">
            <h2 id="how-title">Comment ça marche</h2>
            <p>Trois étapes pour trouver votre prochaine mission.</p>
          </div>

          <ol className="home-steps" aria-label="Étapes pour rejoindre ALP'EMPLOI">
            {HOW_STEPS.map((s) => (
              <li key={s.num} className="home-step">
                <span className="home-step__num" aria-hidden="true">{s.num}</span>
                <div>
                  <h3 className="home-step__title">{s.title}</h3>
                  <p className="home-step__desc">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════════════════════════ */}
      {!user && (
        <section className="home-final-cta" aria-labelledby="final-cta-title">
          <div className="home-final-cta__inner">
            <h2 id="final-cta-title">
              Prêt à rejoindre ALP'EMPLOI&nbsp;?
            </h2>
            <p>
              Intérimaire ou établissement — votre compte est créé en moins
              de 2 minutes.
            </p>
            <Link
              className="home-cta home-cta--primary"
              to="/register"
              aria-label="Créer mon compte ALP'EMPLOI gratuitement"
            >
              Démarrer gratuitement
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}