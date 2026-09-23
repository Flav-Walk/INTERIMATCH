import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { cascade, pop, revealOnScroll, rise } from "../lib/motion";
import { illustrationFor } from "../lib/job-photos";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Coins,
  FileText,
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
import { UnsplashCredit } from "../components/mission/MissionPhotoField";

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
  // Déclaré ici, avant les « return » anticipés : un hook ne doit jamais
  // être appelé seulement dans certains cas.
  const reduceMotion = useReducedMotion();
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
  // Photo de l'établissement, ou à défaut une photo du métier (illustration).
  const media = mission.media ?? illustrationFor(mission.title, mission.id);
  // « Réduire les animations » : tout s'affiche directement, sans mouvement.
  const reveal = reduceMotion ? {} : revealOnScroll;

  return (
    <div className="detail-page">
      <div className="detail-hero">
        {media && (
          <figure className="detail-hero__photo">
            {/* La photo passe en fond du bandeau, avec un zoom lent à
                l'arrivée (effet « Ken Burns »). */}
            <motion.img
              src={media.url}
              alt={mission.media ? (media.alt ?? "") : ""}
              decoding="async"
              initial={reduceMotion ? false : { scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 14, ease: "easeOut" }}
            />
            {/* Le crédit voyage avec la photo : Unsplash l'exige partout où
                l'image est montrée, pas seulement au moment du choix. */}
            <figcaption>
              {!mission.media && (
                <span className="photo-illustration-tag is-inline">
                  Photo d’illustration
                </span>
              )}
              <UnsplashCredit media={media} />
            </figcaption>
          </figure>
        )}
        {/* Le contenu du bandeau arrive en cascade : retour, titre, infos. */}
        <motion.div
          className="detail-hero__inner"
          variants={cascade}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.div variants={rise}>
            <Link className="detail-back" to="/worker/missions">
              <ArrowLeft size={15} aria-hidden="true" />
              Missions disponibles
            </Link>
          </motion.div>

          <motion.div className="detail-hero__head" variants={rise}>
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
          </motion.div>

          <motion.div
            className="detail-hero__meta detail-grid"
            variants={rise}
          >
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
          </motion.div>
        </motion.div>
      </div>

      <div className="detail-body">
        <div className="detail-layout">
          <div className="detail-main">
            {mission.description && (
              <motion.section
                className="detail-card"
                aria-labelledby="desc-title"
                variants={rise}
                {...reveal}
              >
                <h2 id="desc-title" className="detail-card__title">
                  <FileText size={16} aria-hidden="true" />
                  Description de la mission
                </h2>
                <p className="detail-description">{mission.description}</p>
              </motion.section>
            )}

            <motion.section
              className="detail-card"
              aria-labelledby="skills-title"
              variants={rise}
              {...reveal}
            >
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
                  <motion.div
                    className="skill-options"
                    variants={cascade}
                    {...reveal}
                  >
                    {required.map((s) => (
                      <motion.span
                        className="badge badge--required"
                        key={s.id}
                        variants={pop}
                      >
                        {s.name}
                      </motion.span>
                    ))}
                  </motion.div>
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
                  <motion.div
                    className="skill-options"
                    variants={cascade}
                    {...reveal}
                  >
                    {desired.map((s) => (
                      <motion.span className="badge" key={s.id} variants={pop}>
                        {s.name}
                      </motion.span>
                    ))}
                  </motion.div>
                </div>
              )}
            </motion.section>

            {mission.match && (
              <motion.div variants={rise} {...reveal}>
                <MatchExplanation match={mission.match} />
              </motion.div>
            )}
          </div>

          <aside
            className="detail-rail"
            aria-label="Établissement et candidature"
          >
            <motion.section
              className="detail-card"
              aria-labelledby="company-title"
              variants={rise}
              {...reveal}
            >
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
            </motion.section>

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
