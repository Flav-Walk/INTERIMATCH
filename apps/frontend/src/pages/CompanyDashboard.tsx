// src/pages/CompanyDashboard.tsx
//
// Logique Flavien — intacte (useAuth, useCompanyData, listMissions, tabs, états).
// JSX rewrite v2 — hero charte ALP'EMPLOI, chips redessinés, skeletons.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  Plus,
  Utensils,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import { RecentApplications } from "../components/applications/RecentApplications";
import { useCompanyData } from "../hooks/CompanyData";
import { pendingByMission } from "../services/applications";
import { PlanningCard } from "../components/mission/PlanningCard";
import {
  listMissions,
  missionTabs,
  type Mission,
  type MissionTab,
} from "../services/missions";

// ─── Skeleton missions ────────────────────────────────────────────────────────

function MissionSkeleton() {
  return (
    <div className="mission-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CompanyDashboard() {
  // ── Logique Flavien — intouchable ────────────────────────────────────────
  const { user, revision } = useAuth();
  const { applications }   = useCompanyData();

  const [data,    setData]    = useState<Mission[]>([]);
  const [counts,  setCounts]  = useState<Partial<Record<MissionTab, number>>>({});
  const [tab,     setTab]     = useState<MissionTab>("open");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void listMissions()
      .then((r) => {
        if (!live) return;
        setData(r.missions);
        setCounts(r.counts);
        setError("");
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [revision]);

  if (!user) return null;

  const p       = user.profile;
  const shown   = data.filter((m) => m.status === tab).slice(0, 4);
  const pending = pendingByMission(applications);

  return (
    <div className="dashboard-page">

      {/* ── Bannière demo ─────────────────────────────────────────────────── */}
      {user.demo && (
        <div className="demo-banner" role="status">
          <span>⚠️ MODE DÉMO — données fictives</span>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero__inner">
          <div className="dashboard-hero__body">
            <span className="eyeline">Espace entreprise</span>
            <h1 className="dashboard-hero__title">
              {user.first_name
                ? `Bonjour ${user.first_name},`
                : "Bonjour,"}
              <span className="dashboard-hero__sub">
                Prêt à renforcer votre équipe&nbsp;?
              </span>
            </h1>
            <p className="dashboard-hero__lead">
              Publiez une mission en quelques minutes et trouvez des talents
              qualifiés près de chez vous.
            </p>
            <Link className="dashboard-hero__cta" to="/company/missions/new">
              <Plus size={18} aria-hidden="true" />
              Créer une mission
            </Link>
          </div>

          {/* Icône décorative */}
          <div className="dashboard-hero__media" aria-hidden="true">
            <Utensils />
          </div>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="dashboard-body">
        <div className="dashboard-layout">

          {/* ── Colonne principale ──────────────────────────────────────────── */}
          <div className="dashboard-main">

            {/* Section Missions */}
            <section aria-labelledby="missions-title">
              <div className="dashboard-section-head">
                <h2 id="missions-title">Vos missions</h2>
                <Link className="link-more" to="/company/missions">
                  Voir toutes →
                </Link>
              </div>

              {/* Chips / onglets */}
              <div className="dashboard-tabs" role="tablist" aria-label="Filtrer les missions">
                {missionTabs.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.key}
                    className={[
                      "dashboard-tab",
                      tab === entry.key ? "is-active" : "",
                    ].join(" ").trim()}
                    onClick={() => setTab(entry.key)}
                  >
                    {entry.label}
                    <span className="dashboard-tab__count">
                      {counts[entry.key] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* États */}
              {error && (
                <p className="form-error" role="alert">{error}</p>
              )}

              {loading ? (
                <MissionSkeleton />
              ) : shown.length > 0 ? (
                <div className="mission-grid">
                  {shown.map((mission) => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      pendingApplications={pending.get(mission.id) ?? 0}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <BriefcaseBusiness aria-hidden="true" />
                  <h3>Aucune mission dans cet onglet</h3>
                  <p>
                    Créez une mission pour commencer à recevoir des candidats
                    compatibles.
                  </p>
                  <Link className="button" to="/company/missions/new">
                    Créer une mission
                  </Link>
                </div>
              )}
            </section>

            {/* Candidatures récentes — composant Flavien */}
            <RecentApplications />
          </div>

          {/* ── Rail latéral ─────────────────────────────────────────────── */}
          <aside className="dashboard-rail" aria-label="Planning et établissement">

            {/* Planning — composant Flavien */}
            <PlanningCard missions={data} />

            {/* Carte établissement */}
            <section
              className="detail-card"
              aria-labelledby="company-info-title"
            >
              <h2 id="company-info-title" className="detail-card__title">
                <Building2 size={16} aria-hidden="true" />
                Votre établissement
              </h2>

              {user.onboarding_completed ? (
                <>
                  <p className="detail-company-name">
                    {p.establishment_name}
                  </p>
                  <p className="quiet">
                    {p.address ? `${p.address}, ` : ""}
                    {p.postal_code} {p.city}
                  </p>
                  <Link
                    className="link-more"
                    to="/company/profile"
                    style={{ marginTop: "0.75rem", display: "inline-block" }}
                  >
                    Modifier les informations →
                  </Link>
                </>
              ) : (
                <>
                  <p className="quiet">
                    Les intérimaires voient ces informations avant de répondre
                    à vos missions.
                  </p>
                  <Link
                    className="button"
                    to="/company/profile"
                    style={{ marginTop: "1rem" }}
                  >
                    Compléter mon établissement
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}