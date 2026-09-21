// src/pages/WorkerMissionDetail.tsx
//
// Logique Flavien — intacte (useAuth, services, états).
// JSX rewrite v2 — hero mission, skeleton, charte ALP'EMPLOI.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Coins,
  GraduationCap,
  MapPin,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage, type ReferenceValue } from "../services/session";
import { api } from "../services/session";
import { getOpenMission, type OpenMission } from "../services/missions";
import { missionSchedule } from "../components/mission/MissionCard";
import { MatchExplanation } from "../components/mission/MatchExplanation";
import { MatchBadge } from "../components/mission/MatchBadge";
import { ApplyToMission } from "../components/applications/ApplyToMission";

// ─── Constantes ───────────────────────────────────────────────────────────────

const payLabels: Record<string, string> = {
  hour: "de l'heure",
  day: "par jour",
  mission: "pour la mission",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden="true" aria-label="Chargement de la mission">
      <div className="detail-skeleton__hero" />
      <div className="detail-skeleton__body">
        <div className="detail-skeleton__main">
          <div className="detail-skeleton__card" />
          <div className="detail-skeleton__card" />
        </div>
        <div className="detail-skeleton__rail" />
      </div>
    </div>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function WorkerMissionDetail() {
  // ── Logique Flavien — intouchable ────────────────────────────────────────
  const { id = "" } = useParams();
  const { revision } = useAuth();
  const [mission,  setMission]  = useState<OpenMission | null>(null);
  const [sectors,  setSectors]  = useState<ReferenceValue[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void Promise.all([
      getOpenMission(id),
      api<{ sectors: ReferenceValue[] }>("/reference"),
    ])
      .then(([m, reference]) => {
        if (!live) return;
        setMission(m);
        setSectors(reference.sectors);
        setError("");
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, revision]);

  // ── États loading / erreur ───────────────────────────────────────────────
  if (loading) return <DetailSkeleton />;

  if (error || !mission)
    return (
      <div className="detail-error-wrap">
        <div className="detail-error-card">
          <p className="form-error" role="alert">
            {error || "Cette mission n'est plus disponible."}
          </p>
          <Link className="button-ghost" to="/worker/missions">
            <ArrowLeft size={15} aria-hidden="true" />
            Revenir aux missions
          </Link>
        </div>
      </div>
    );

  // ── Données dérivées — logique Flavien ───────────────────────────────────
  const required   = mission.skills.filter((s) => s.required);
  const desired    = mission.skills.filter((s) => !s.required);
  const experience = Number(mission.min_years_experience);
  const sector     =
    sectors.find((s) => s.value === mission.company.sector)?.label ??
    mission.company.sector;

  return (
    <div className="detail-page">

      {/* ── Hero mission ──────────────────────────────────────────────────── */}
      <div className="detail-hero">
        <div className="detail-hero__inner">
          <Link className="detail-back" to="/worker/missions">
            <ArrowLeft size={15} aria-hidden="true" />
            Missions disponibles
          </Link>

          <div className="detail-hero__head">
            <div className="detail-hero__title-wrap">
              <span className="mission-status is-open">À pourvoir</span>
              <h1 className="detail-hero__title">{mission.title}</h1>
              {mission.company.establishment_name && (
                <p className="detail-hero__company">
                  <Building2 size={14} aria-hidden="true" />
                  {mission.company.establishment_name}
                  {sector && <span className="detail-hero__sector"> · {sector}</span>}
                </p>
              )}
            </div>

            {mission.match?.compatible && (
              <div className="detail-hero__badge">
                <MatchBadge score={mission.match.score} size="large" />
              </div>
            )}
          </div>

          {/* Méta inline dans le hero */}
          <div className="detail-hero__meta">
            <span className="detail-meta-chip">
              <CalendarDays size={13} aria-hidden="true" />
              {missionSchedule(mission)}
            </span>
            <span className="detail-meta-chip">
              <MapPin size={13} aria-hidden="true" />
              {mission.postal_code} {mission.city}
            </span>
            <span className="detail-meta-chip">
              <Users size={13} aria-hidden="true" />
              {mission.headcount > 1
                ? `${mission.headcount} postes`
                : "1 poste"}
            </span>
            {mission.pay_amount && mission.pay_unit && (
              <span className="detail-meta-chip detail-meta-chip--pay">
                <Coins size={13} aria-hidden="true" />
                {Number(mission.pay_amount).toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}{" "}
                {payLabels[mission.pay_unit] ?? mission.pay_unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="detail-body">
        <div className="detail-layout">

          {/* ── Colonne principale ──────────────────────────────────────────── */}
          <div className="detail-main">

            {/* Description */}
            {mission.description && (
              <section className="detail-card" aria-labelledby="desc-title">
                <h2 id="desc-title" className="detail-card__title">
                  Description de la mission
                </h2>
                <p className="detail-description">{mission.description}</p>

                {/* Infos complémentaires */}
                {Number.isFinite(experience) && experience > 0 && (
                  <p className="detail-xp">
                    <GraduationCap size={15} aria-hidden="true" />
                    {experience} an{experience > 1 ? "s" : ""} d'expérience
                    attendus
                  </p>
                )}
              </section>
            )}

            {/* Compétences */}
            <section className="detail-card" aria-labelledby="skills-title">
              <h2 id="skills-title" className="detail-card__title">
                <Wrench size={16} aria-hidden="true" />
                Compétences attendues
              </h2>

              {required.length > 0 ? (
                <div className="detail-skills-group">
                  <p className="detail-skills-label">
                    Obligatoires
                    <span className="detail-skills-sub">
                      — sans elles, la mission ne vous sera pas proposée
                    </span>
                  </p>
                  <div className="skill-options">
                    {required.map((s) => (
                      <span className="badge badge--required" key={s.id}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="quiet">
                  Aucune compétence obligatoire n'a été précisée.
                </p>
              )}

              {desired.length > 0 && (
                <div className="detail-skills-group">
                  <p className="detail-skills-label">
                    Souhaitées
                    <span className="detail-skills-sub">
                      — elles font la différence
                    </span>
                  </p>
                  <div className="skill-options">
                    {desired.map((s) => (
                      <span className="badge" key={s.id}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Match explanation */}
            {mission.match && <MatchExplanation match={mission.match} />}
          </div>

          {/* ── Rail latéral ─────────────────────────────────────────────── */}
          <aside className="detail-rail" aria-label="Informations établissement et candidature">

            {/* Établissement */}
            <section className="detail-card" aria-labelledby="company-title">
              <h2 id="company-title" className="detail-card__title">
                <Building2 size={16} aria-hidden="true" />
                L'établissement
              </h2>

              {mission.company.establishment_name ? (
                <>
                  <p className="detail-company-name">
                    {mission.company.establishment_name}
                  </p>
                  {sector && <p className="quiet">{sector}</p>}
                  {mission.company.description && (
                    <p className="detail-company-desc">
                      {mission.company.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="quiet">
                  Cet établissement n'a pas encore rédigé sa présentation.
                </p>
              )}
            </section>

            {/* CTA candidature — collant desktop */}
            <div className="detail-rail__sticky">
              <ApplyToMission missionId={mission.id} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}