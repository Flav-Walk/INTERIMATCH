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
import {
  getOpenMission,
  missionStatePresentation,
  type OpenMission,
} from "../services/missions";
import { missionSchedule } from "../components/mission/MissionCard";
import { MatchExplanation } from "../components/mission/MatchExplanation";
import { MatchBadge } from "../components/mission/MatchBadge";
import { ApplyToMission } from "../components/applications/ApplyToMission";

const payLabels: Record<string, string> = {
  hour: "de l’heure",
  day: "par jour",
  mission: "pour la mission",
};

function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden="true">
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

/** Détail d'une mission offerte et point de départ de la candidature. */
export function WorkerMissionDetail() {
  const { id = "" } = useParams();
  const { revision } = useAuth();
  const [mission, setMission] = useState<OpenMission | null>(null),
    [sectors, setSectors] = useState<ReferenceValue[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    // Les deux lectures sont indépendantes : une panne du référentiel ne doit
    // pas empêcher d'afficher la mission, qui est l'objet de la page.
    void Promise.allSettled([
      getOpenMission(id),
      api<{ sectors: ReferenceValue[] }>("/reference"),
    ])
      .then(([missionResult, referenceResult]) => {
        if (!live) return;
        if (missionResult.status === "fulfilled") {
          setMission(missionResult.value);
          setError("");
        } else {
          setError(errorMessage(missionResult.reason));
        }
        if (referenceResult.status === "fulfilled")
          setSectors(referenceResult.value.sectors);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id, revision]);

  if (loading)
    return (
      <>
        <p role="status" className="sr-only">
          Chargement de la mission…
        </p>
        <DetailSkeleton />
      </>
    );

  if (error || !mission)
    return (
      <div className="detail-error-wrap">
        <div className="detail-error-card">
          <p className="form-error" role="alert">
            {error || "Cette mission n’est plus disponible."}
          </p>
          <Link className="button-ghost" to="/worker/missions">
            <ArrowLeft size={15} aria-hidden="true" />
            Revenir aux missions
          </Link>
        </div>
      </div>
    );

  const required = mission.skills.filter((s) => s.required);
  const desired = mission.skills.filter((s) => !s.required);
  const experience = Number(mission.min_years_experience);
  const sector =
    sectors.find((s) => s.value === mission.company.sector)?.label ??
    mission.company.sector;
  const presentation = missionStatePresentation(mission);

  return (
    <div className="detail-page">
      <div className="detail-hero">
        <div className="detail-hero__inner">
          <Link className="detail-back" to="/worker/missions">
            <ArrowLeft size={15} aria-hidden="true" />
            Missions disponibles
          </Link>

          <div className="detail-hero__head">
            <div className="detail-hero__title-wrap">
              <span
                className={`mission-status is-inline ${presentation.className}`}
              >
                {presentation.label}
              </span>
              {presentation.temporal === "upcoming" && (
                <span className="mission-timing is-inline">À venir</span>
              )}
              <h1 className="detail-hero__title">{mission.title}</h1>
              {mission.company.establishment_name && (
                <p className="detail-hero__company">
                  <Building2 size={14} aria-hidden="true" />
                  {mission.company.establishment_name}
                  {sector && (
                    <span className="detail-hero__sector"> · {sector}</span>
                  )}
                </p>
              )}
            </div>

            {mission.match?.compatible && (
              <div className="detail-hero__badge">
                <MatchBadge
                  score={mission.match.score}
                  band={mission.match.band}
                  bandLabel={mission.match.band_label}
                  size="large"
                />
              </div>
            )}
          </div>

          <div className="detail-hero__meta detail-grid">
            <span className="detail-meta-chip">
              <CalendarDays size={13} aria-hidden="true" />
              {missionSchedule(mission)}
            </span>
            <span className="detail-meta-chip">
              <MapPin size={13} aria-hidden="true" />
              {mission.address ? `${mission.address}, ` : ""}
              {mission.postal_code} {mission.city}
            </span>
            <span className="detail-meta-chip">
              <Users size={13} aria-hidden="true" />
              {mission.headcount > 1
                ? `${mission.headcount} postes à pourvoir`
                : "1 poste à pourvoir"}
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
            {Number.isFinite(experience) && experience > 0 && (
              <span className="detail-meta-chip">
                <GraduationCap size={13} aria-hidden="true" />
                {experience} an{experience > 1 ? "s" : ""} d’expérience attendus
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-layout">
          <div className="detail-main">
            {mission.description && (
              <section className="detail-card" aria-labelledby="desc-title">
                <h2 id="desc-title" className="detail-card__title">
                  Description de la mission
                </h2>
                <p className="detail-description">{mission.description}</p>
              </section>
            )}

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
                      {" "}
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
                  Aucune compétence obligatoire n’a été précisée.
                </p>
              )}

              {desired.length > 0 && (
                <div className="detail-skills-group">
                  <p className="detail-skills-label">
                    Souhaitées
                    <span className="detail-skills-sub">
                      {" "}
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

            {mission.match && <MatchExplanation match={mission.match} />}
          </div>

          <aside
            className="detail-rail"
            aria-label="Établissement et candidature"
          >
            <section className="detail-card" aria-labelledby="company-title">
              <h2 id="company-title" className="detail-card__title">
                <Building2 size={16} aria-hidden="true" />
                L’établissement
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
                  Cet établissement n’a pas encore rédigé sa présentation.
                </p>
              )}
            </section>

            <div className="detail-rail__sticky">
              <ApplyToMission
                missionId={mission.id}
                mission={{
                  title: mission.title,
                  starts_at: mission.starts_at,
                  ends_at: mission.ends_at,
                  city: mission.city,
                  postal_code: mission.postal_code,
                  establishment_name: mission.company.establishment_name,
                  status: mission.status,
                  recruiting_blocked: mission.recruiting_blocked,
                }}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
