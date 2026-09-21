// src/pages/Home.tsx
//
// Landing page publique ALP'EMPLOI — HCR / AURA.
// SEO : structure h1 → h2 sémantique, landmarks, textes indexables.
// RGAA 4.1 : aria-labels, contrastes WCAG AA, liens explicites.
// Aucune logique backend — useAuth() en lecture seule.

import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
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
    icon: <MapPin size={18} aria-hidden="true" />,
    title: "Missions près de chez vous",
    desc: "Uniquement des établissements en région Auvergne-Rhône-Alpes.",
  },
  {
    icon: <Sparkles size={18} aria-hidden="true" />,
    title: "Matching intelligent",
    desc: "Vos compétences et disponibilités sont croisés automatiquement avec les besoins.",
  },
  {
    icon: <CalendarCheck size={18} aria-hidden="true" />,
    title: "Flexibilité totale",
    desc: "Choisissez vos missions, refusez sans justification, gérez votre agenda.",
  },
];

const COMPANY_FEATURES = [
  {
    icon: <Users size={18} aria-hidden="true" />,
    title: "Des profils qualifiés HCR",
    desc: "Cuisiniers, serveurs, réceptionnistes — des professionnels vérifiés par leurs compétences.",
  },
  {
    icon: <ClipboardList size={18} aria-hidden="true" />,
    title: "Publiez en 3 minutes",
    desc: "Décrivez le poste, les horaires et les compétences : les candidatures arrivent.",
  },
  {
    icon: <ShieldCheck size={18} aria-hidden="true" />,
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
          HERO — fond sombre, titre à gauche, CTA en pill
      ══════════════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero__inner">
          <p className="home-hero__eyeline">
            Intérim Hôtellerie · Restauration · AURA
          </p>

          <h1 id="hero-title" className="home-hero__title">
            Les bonnes personnes, au bon moment.
          </h1>

          <p className="home-hero__lead">
            ALP'EMPLOI connecte les établissements HCR d'Auvergne-Rhône-Alpes
            avec des intérimaires qualifiés — en quelques minutes, sans
            intermédiaire.
          </p>

          {/* CTA — conditionnel selon l'état de connexion */}
          {user ? (
            <div className="home-hero__ctas">
              <Link
                className="home-cta home-cta--primary"
                to={destination(user)}
                aria-label="Accéder à mon espace ALP'EMPLOI"
              >
                Retrouver mon espace
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
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
                className="home-cta home-cta--light"
                to="/login"
                aria-label="Se connecter à mon compte existant"
              >
                J'ai déjà un compte
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PANNEAU CLAIR — chevauche le hero et le pied de page
      ══════════════════════════════════════════════════════════════════ */}
      <div className="home-panel">

        {/* Trois colonnes : intérimaires · établissements · appel à l'action */}
        <div className="home-panel__grid">
          <section aria-labelledby="worker-title" className="home-col">
            <span className="home-tag">Intérimaires</span>
            <h2 id="worker-title" className="home-col__title">
              Des missions qui vous ressemblent
            </h2>
            <ul className="home-list">
              {WORKER_FEATURES.map((f) => (
                <li key={f.title} className="home-list__item">
                  <span className="home-list__icon">{f.icon}</span>
                  <span>
                    <strong>{f.title}</strong>
                    <span className="home-list__desc">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!user && (
              <Link
                className="home-cta home-cta--dark"
                to="/register"
                aria-label="Créer un compte intérimaire HCR"
              >
                Créer mon profil
              </Link>
            )}
          </section>

          <section aria-labelledby="company-title" className="home-col">
            <span className="home-tag">Établissements</span>
            <h2 id="company-title" className="home-col__title">
              Renforcez votre équipe en quelques minutes
            </h2>
            <ul className="home-list">
              {COMPANY_FEATURES.map((f) => (
                <li key={f.title} className="home-list__item">
                  <span className="home-list__icon">{f.icon}</span>
                  <span>
                    <strong>{f.title}</strong>
                    <span className="home-list__desc">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!user && (
              <Link
                className="home-cta home-cta--dark"
                to="/register"
                aria-label="Créer un compte établissement HCR"
              >
                Inscrire mon établissement
              </Link>
            )}
          </section>

          {/* Bloc sombre : l'appel à l'action final */}
          <section aria-labelledby="final-cta-title" className="home-dark-card">
            <h2 id="final-cta-title">Prêt à rejoindre ALP'EMPLOI&nbsp;?</h2>
            <p>
              Intérimaire ou établissement — votre compte est créé en moins de
              2 minutes.
            </p>
            <Link
              className="home-cta home-cta--light"
              to={user ? destination(user) : "/register"}
              aria-label={
                user
                  ? "Accéder à mon espace ALP'EMPLOI"
                  : "Créer mon compte ALP'EMPLOI gratuitement"
              }
            >
              {user ? "Retrouver mon espace" : "Démarrer gratuitement"}
            </Link>
          </section>
        </div>

        {/* Comment ça marche */}
        <section className="home-how" aria-labelledby="how-title">
          <div className="home-how__head">
            <h2 id="how-title">Comment ça marche</h2>
            <span className="home-tag">3 étapes</span>
          </div>

          <ol className="home-steps" aria-label="Étapes pour rejoindre ALP'EMPLOI">
            {HOW_STEPS.map((s) => (
              <li key={s.num} className="home-step">
                <span className="home-step__num" aria-hidden="true">{s.num}</span>
                <h3 className="home-step__title">{s.title}</h3>
                <p className="home-step__desc">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
