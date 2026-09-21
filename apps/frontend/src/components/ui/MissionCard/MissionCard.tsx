/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — MissionCard v3
   Carte centrale du parcours intérimaire
   Conçue pour fonctionner SANS imageUrl (JobGlyph + couleur par métier)
   ══════════════════════════════════════════════════════════════ */

import { Link } from 'react-router-dom';
import { MapPin, Clock, Euro, ArrowRight, Users } from 'lucide-react';
import { MatchBadge, MatchBadgeSkeleton } from '../MatchBadge';
import { StatusBadge } from '../StatusBadge';
import type { Mission } from '../../../services/missions';
import './MissionCard.css';

/* ── Métier → palette ────────────────────────────────────────
   Les couleurs vivent dans tokens.css (--c-job-*) et sont appliquées
   par les classes .mission-card__media--<métier>. */

type JobKey = 'serveur' | 'chef' | 'barman' | 'reception' | 'plongeur' | 'default';

function getJobKey(job: string): JobKey {
  const k = job.toLowerCase();
  if (k.includes('chef') || k.includes('cuisin')) return 'chef';
  if (k.includes('bar'))                          return 'barman';
  if (k.includes('recep') || k.includes('accueil')) return 'reception';
  if (k.includes('plongeur'))                     return 'plongeur';
  if (k.includes('serveur') || k.includes('serveuse')) return 'serveur';
  return 'default';
}

/* ── Glyph SVG par métier ────────────────────────────────────
   Dessiné en currentColor : la couleur vient du CSS (--job-fg). */

function JobGlyph({ jobKey }: { jobKey: JobKey }) {
  const fill = 'currentColor';
  const op   = 0.25;

  if (jobKey === 'chef')
    return (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <circle cx="40" cy="28" r="18" fill={fill} fillOpacity={op + 0.05} />
        <rect x="20" y="44" width="40" height="18" rx="4" fill={fill} fillOpacity={op} />
        <line x1="28" y1="44" x2="28" y2="62" stroke={fill} strokeWidth="2" strokeOpacity={op + 0.1} />
        <line x1="40" y1="44" x2="40" y2="62" stroke={fill} strokeWidth="2" strokeOpacity={op + 0.1} />
        <line x1="52" y1="44" x2="52" y2="62" stroke={fill} strokeWidth="2" strokeOpacity={op + 0.1} />
      </svg>
    );

  if (jobKey === 'barman')
    return (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <path d="M20 20 L30 56 L50 56 L60 20Z" fill={fill} fillOpacity={op} />
        <rect x="34" y="56" width="12" height="10" fill={fill} fillOpacity={op + 0.1} />
        <rect x="28" y="64" width="24" height="4" rx="2" fill={fill} fillOpacity={op + 0.05} />
      </svg>
    );

  if (jobKey === 'reception')
    return (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="15" y="40" width="50" height="26" rx="4" fill={fill} fillOpacity={op} />
        <rect x="30" y="26" width="20" height="14" rx="2" fill={fill} fillOpacity={op + 0.1} />
        <circle cx="40" cy="19" r="8" fill={fill} fillOpacity={op + 0.15} />
      </svg>
    );

  /* Serveur — défaut */
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="20" r="10" fill={fill} fillOpacity={op + 0.15} />
      <path d="M20 36 Q40 30 60 36 L58 66 H22Z" fill={fill} fillOpacity={op} />
      <rect x="10" y="34" width="60" height="4" rx="2" fill={fill} fillOpacity={op + 0.1} />
    </svg>
  );
}

/* ── Formatage dates ──────────────────────────────────────── */

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmtDay = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  if (s.toDateString() === e.toDateString()) return fmtDay(s);
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${fmtDay(e)}`;
  return `${fmtDay(s)} – ${fmtDay(e)}`;
}

/* ── Props ───────────────────────────────────────────────── */

export interface MissionCardProps {
  mission:             Mission;
  basePath:            string;
  /** Score de matching 0–100, undefined = pas encore calculé */
  score?:              number;
  /** Nombre de candidatures en attente (vue entreprise) */
  pendingApplications?: number;
  /** Index pour le stagger d'animation */
  animIndex?:          number;
}

/* ── Composant ───────────────────────────────────────────── */

export function MissionCard({
  mission,
  basePath,
  score,
  pendingApplications,
  animIndex = 0,
}: MissionCardProps) {
  const jobKey      = getJobKey(mission.job);
  const isFilled    = mission.status === 'filled' || mission.status === 'completed';
  const isCancelled = mission.status === 'cancelled';
  const isInactive  = isFilled || isCancelled;

  const hasSalary = mission.pay_amount && mission.pay_unit;

  return (
    <Link
      to={`${basePath}/${mission.id}`}
      className={[
        'mission-card',
        isInactive ? 'mission-card--inactive' : '',
        'anim-fade-up',
      ].filter(Boolean).join(' ')}
      style={{ animationDelay: `${animIndex * 50}ms` }}
      aria-label={`Mission ${mission.job} à ${mission.city}${score !== undefined ? ` — ${Math.round(score)}% de compatibilité` : ''}`}
    >
      {/* ── MEDIA ───────────────────────────────────────── */}
      <div
        className={`mission-card__media mission-card__media--${jobKey}`}
        aria-hidden="true"
      >
        <div className="mission-card__glyph">
          <JobGlyph jobKey={jobKey} />
        </div>

        {/* Badge statut — coin supérieur gauche */}
        <div className="mission-card__status-wrap">
          <StatusBadge status={mission.status} />
        </div>

        {/* Badge match — coin supérieur droit */}
        <div className="mission-card__match-wrap">
          {score !== undefined ? (
            <MatchBadge score={score} animated />
          ) : !isInactive ? (
            <MatchBadgeSkeleton />
          ) : null}
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────── */}
      <div className="mission-card__body">
        <h3 className="mission-card__title">
          {mission.title || mission.job}
        </h3>

        {/* Méta */}
        <ul className="mission-card__meta" aria-label="Détails de la mission">
          <li>
            <MapPin size={13} aria-hidden="true" />
            {mission.city}
          </li>
          <li>
            <Clock size={13} aria-hidden="true" />
            {formatDateRange(mission.starts_at, mission.ends_at)}
          </li>
          {mission.headcount > 1 && (
            <li>
              <Users size={13} aria-hidden="true" />
              {mission.headcount} postes
            </li>
          )}
        </ul>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <div className="mission-card__foot">
        <span className="mission-card__salary">
          {hasSalary ? (
            <>
              <Euro size={13} aria-hidden="true" />
              {mission.pay_amount} €/{mission.pay_unit}
            </>
          ) : (
            <span className="mission-card__salary--unknown">Salaire à définir</span>
          )}
        </span>

        {pendingApplications !== undefined && pendingApplications > 0 && (
          <span className="mission-card__pending" aria-label={`${pendingApplications} candidature(s) en attente`}>
            {pendingApplications} en attente
          </span>
        )}

        <span className="mission-card__arrow" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}

/* ── Skeleton ─────────────────────────────────────────────── */

export function MissionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="mission-card mission-card--skeleton anim-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-busy="true"
      aria-label="Chargement d'une mission…"
    >
      <div className="mission-card__media skeleton" />
      <div className="mission-card__body" style={{ gap: 'var(--sp-3)' }}>
        <div className="skeleton" style={{ height: '20px', width: '70%', borderRadius: 'var(--r-sm)' }} />
        <div className="skeleton" style={{ height: '14px', width: '50%', borderRadius: 'var(--r-sm)' }} />
        <div className="skeleton" style={{ height: '14px', width: '40%', borderRadius: 'var(--r-sm)' }} />
      </div>
      <div className="mission-card__foot">
        <div className="skeleton" style={{ height: '14px', width: '60px', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  );
}
