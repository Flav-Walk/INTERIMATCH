/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — CandidateCard
   Vue entreprise — grille de candidats matchés
   ══════════════════════════════════════════════════════════════ */

import { Link } from 'react-router-dom';
import { MapPin, Star, ArrowRight, Clock } from 'lucide-react';
import { MatchBadge, MatchBadgeSkeleton } from '../MatchBadge';
import { StatusBadge } from '../StatusBadge';
import './CandidateCard.css';

/* ── Types ────────────────────────────────────────────────── */

export interface Candidate {
  id:         string;
  firstName:  string;
  lastName:   string;
  jobTitle:   string;        /* "Serveur en salle" */
  city:       string;
  yearsXp?:   number;
  score:      number;
  applicationStatus?: 'pending' | 'accepted' | 'rejected';
  availableFrom?: string;
  skills?:    string[];
}

export interface CandidateCardProps {
  candidate:  Candidate;
  basePath:   string;
  animIndex?: number;
}

/* ── Initiales ────────────────────────────────────────────── */

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/* ── Variante d'avatar déterministe ───────────────────────────
   Renvoie 1 à 4 : la couleur correspondante (--c-avatar-N) est
   appliquée par la classe .im-candidate-card__avatar--N. */

const AVATAR_VARIANTS = 4;

function getAvatarVariant(id: string): number {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (hash % AVATAR_VARIANTS) + 1;
}

/* ── Composant ───────────────────────────────────────────── */

export function CandidateCard({ candidate, basePath, animIndex = 0 }: CandidateCardProps) {
  const variant = getAvatarVariant(candidate.id);
  const init    = initials(candidate.firstName, candidate.lastName);

  return (
    <Link
      to={`${basePath}/${candidate.id}`}
      className="im-candidate-card anim-fade-up"
      style={{ animationDelay: `${animIndex * 50}ms` }}
      aria-label={`Candidat ${candidate.firstName} ${candidate.lastName} — ${Math.round(candidate.score)}% de compatibilité`}
    >
      {/* ── AVATAR ──────────────────────────────────────── */}
      <div
        className="im-candidate-card__avatar-zone"
        aria-hidden="true"
      >
        <div className={`im-candidate-card__avatar im-candidate-card__avatar--${variant}`}>
          <span className="im-candidate-card__initials">{init}</span>
        </div>

        {/* Match badge */}
        <div className="im-candidate-card__match">
          <MatchBadge score={candidate.score} size="md" animated />
        </div>

        {/* Statut candidature si disponible */}
        {candidate.applicationStatus && (
          <div className="im-candidate-card__app-status">
            <StatusBadge status={candidate.applicationStatus} />
          </div>
        )}
      </div>

      {/* ── BODY ─────────────────────────────────────────── */}
      <div className="im-candidate-card__body">
        <h3 className="im-candidate-card__name">
          {candidate.firstName} {candidate.lastName.charAt(0)}.
        </h3>

        <p className="im-candidate-card__job">{candidate.jobTitle}</p>

        <ul className="im-candidate-card__meta" aria-label="Informations du candidat">
          <li>
            <MapPin size={12} aria-hidden="true" />
            {candidate.city}
          </li>
          {candidate.yearsXp !== undefined && (
            <li>
              <Star size={12} aria-hidden="true" />
              {candidate.yearsXp} an{candidate.yearsXp > 1 ? 's' : ''} d'expérience
            </li>
          )}
          {candidate.availableFrom && (
            <li>
              <Clock size={12} aria-hidden="true" />
              Dispo. {new Date(candidate.availableFrom).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </li>
          )}
        </ul>

        {/* Compétences clés — max 3 pills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <ul className="im-candidate-card__skills" aria-label="Compétences">
            {candidate.skills.slice(0, 3).map(skill => (
              <li key={skill} className="im-candidate-card__skill-pill">
                {skill}
              </li>
            ))}
            {candidate.skills.length > 3 && (
              <li className="im-candidate-card__skill-pill im-candidate-card__skill-pill--more">
                +{candidate.skills.length - 3}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <div className="im-candidate-card__foot">
        <span className="im-candidate-card__cta">
          Voir le profil
        </span>
        <span className="im-candidate-card__arrow" aria-hidden="true">
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}

/* ── Skeleton ─────────────────────────────────────────────── */

export function CandidateCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="im-candidate-card im-candidate-card--skeleton anim-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-busy="true"
      aria-label="Chargement d'un candidat…"
    >
      <div className="im-candidate-card__avatar-zone">
        <div className="im-candidate-card__avatar skeleton" />
        <div className="im-candidate-card__match">
          <MatchBadgeSkeleton />
        </div>
      </div>
      <div className="im-candidate-card__body" style={{ gap: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
        <div className="skeleton" style={{ height: '16px', width: '60%', borderRadius: 'var(--r-sm)' }} />
        <div className="skeleton" style={{ height: '13px', width: '80%', borderRadius: 'var(--r-sm)' }} />
        <div className="skeleton" style={{ height: '12px', width: '50%', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  );
}
