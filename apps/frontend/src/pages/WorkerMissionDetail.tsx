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

const payLabels: Record<string, string> = {
  hour: "de l’heure",
  day: "par jour",
  mission: "pour la mission",
};

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
    return () => {
      live = false;
    };
  }, [id, revision]);

  if (loading)
    return (
      <section className="page-wide">
        <p role="status" className="quiet">
          Chargement de la mission…
        </p>
      </section>
    );

  if (error || !mission)
    return (
      <section className="page-wide">
        <p className="form-error" role="alert">
          {error || "Cette mission n’est plus disponible."}
        </p>
        <Link className="link-more" to="/worker/missions">
          ← Revenir aux missions
        </Link>
      </section>
    );

  const required = mission.skills.filter((s) => s.required);
  const desired = mission.skills.filter((s) => !s.required);
  const experience = Number(mission.min_years_experience);
  const sector =
    sectors.find((s) => s.value === mission.company.sector)?.label ??
    mission.company.sector;

  return (
    <section className="page-wide">
      <Link className="link-back" to="/worker/missions">
        <ArrowLeft size={15} aria-hidden="true" />
        Missions disponibles
      </Link>

      <div className="section-head">
        <h1>{mission.title}</h1>
        <span className="mission-status is-inline is-open">À pourvoir</span>
        {mission.match?.compatible && (
          <MatchBadge score={mission.match.score} size="large" />
        )}
      </div>

      <div className="layout">
        <div className="layout-main">
          <section className="rail-card">
            <div className="detail-grid">
              <p className="mission-meta">
                <CalendarDays size={15} aria-hidden="true" />
                {missionSchedule(mission)}
              </p>
              <p className="mission-meta">
                <MapPin size={15} aria-hidden="true" />
                {mission.address ? `${mission.address}, ` : ""}
                {mission.postal_code} {mission.city}
              </p>
              <p className="mission-meta">
                <Users size={15} aria-hidden="true" />
                {mission.headcount > 1
                  ? `${mission.headcount} postes à pourvoir`
                  : "1 poste à pourvoir"}
              </p>
              {mission.pay_amount && mission.pay_unit && (
                <p className="mission-meta">
                  <Coins size={15} aria-hidden="true" />
                  {Number(mission.pay_amount).toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}{" "}
                  {payLabels[mission.pay_unit] ?? mission.pay_unit}
                </p>
              )}
              {Number.isFinite(experience) && experience > 0 && (
                <p className="mission-meta">
                  <GraduationCap size={15} aria-hidden="true" />
                  {experience} an{experience > 1 ? "s" : ""} d’expérience
                  attendus
                </p>
              )}
            </div>
            {mission.description && (
              <p className="detail-description">{mission.description}</p>
            )}
          </section>

          <section className="rail-card">
            <div className="rail-head">
              <Wrench size={18} aria-hidden="true" />
              <h2>Compétences attendues</h2>
            </div>
            {required.length > 0 ? (
              <>
                <p className="quiet">
                  Obligatoires — sans elles, la mission ne vous sera pas
                  proposée
                </p>
                <div className="skill-options">
                  {required.map((s) => (
                    <span className="badge" key={s.id}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="quiet">
                Aucune compétence obligatoire n’a été précisée.
              </p>
            )}
            {desired.length > 0 && (
              <>
                <p className="quiet">Souhaitées — elles font la différence</p>
                <div className="skill-options">
                  {desired.map((s) => (
                    <span className="badge" key={s.id}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {mission.match && <MatchExplanation match={mission.match} />}
        </div>

        <aside className="layout-rail">
          <section className="rail-card">
            <div className="rail-head">
              <Building2 size={18} aria-hidden="true" />
              <h2>L’établissement</h2>
            </div>
            {mission.company.establishment_name ? (
              <>
                <p className="lead-figure">
                  {mission.company.establishment_name}
                </p>
                {sector && <p className="quiet">{sector}</p>}
                {mission.company.description && (
                  <p>{mission.company.description}</p>
                )}
              </>
            ) : (
              <p className="quiet">
                Cet établissement n’a pas encore rédigé sa présentation.
              </p>
            )}
          </section>

          <ApplyToMission missionId={mission.id} />
        </aside>
      </div>
    </section>
  );
}
