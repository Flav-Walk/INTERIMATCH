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
  Repeat,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard, dayLabel, toHHMM } from "../components/mission/MissionCard";
import { RepublishList } from "../components/mission/RepublishList";
import { rebookable } from "../components/mission/republish";
import { RecentApplications } from "../components/applications/RecentApplications";
import { useCompanyData } from "../hooks/CompanyData";
import { pendingByMission } from "../services/applications";
import { PlanningCard } from "../components/mission/PlanningCard";
import { Badge } from "../components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import {
  listMissions,
  missionTabs,
  type Mission,
  type MissionTab,
} from "../services/missions";

// Garde de type : Tabs renvoie une chaîne, l'état attend une MissionTab
const isMissionTab = (value: string): value is MissionTab =>
  missionTabs.some((entry) => entry.key === value);

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
  const pending = pendingByMission(applications);

  // Le prochain service passe avant tout : les plus proches d'abord, sauf les
  // missions terminées, où l'on veut les plus récentes.
  const byStart = (a: Mission, b: Mission) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  const shown = data
    .filter((m) => m.status === tab)
    .sort(tab === "completed" ? (a, b) => byStart(b, a) : byStart)
    .slice(0, 3);

  const now = new Date();
  const accepted = new Map<string, number>();
  for (const a of applications)
    if (a.status === "accepted")
      accepted.set(a.mission_id, (accepted.get(a.mission_id) ?? 0) + 1);
  const toFill = data
    .filter(
      (m) =>
        m.status === "open" &&
        new Date(m.ends_at) > now &&
        (accepted.get(m.id) ?? 0) < m.headcount,
    )
    .sort(byStart);
  const next = toFill[0];
  const hasUpcoming = data.some(
    (m) =>
      (m.status === "open" || m.status === "filled") &&
      new Date(m.ends_at) > now,
  );
  const pendingTotal = [...pending.values()].reduce((sum, n) => sum + n, 0);
  const rebook = rebookable(data);

  const headline =
    toFill.length > 0
      ? `${toFill.length} service${toFill.length > 1 ? "s" : ""} à pourvoir`
      : hasUpcoming
        ? "Vos prochains services sont pourvus"
        : "Aucun service à venir";

  return (
    <div className="dashboard-page">

      {/* ── Bannière demo ─────────────────────────────────────────────────── */}
      {user.demo && (
        <div className="demo-banner" role="status">
          <span>⚠️ MODE DÉMO — données fictives</span>
        </div>
      )}

      {/* ── Hero : ce qui demande une action, avant les salutations ───────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero__inner">
          <div className="dashboard-hero__body">
            <span className="eyeline">
              {user.first_name ? `Bonjour ${user.first_name}` : "Bonjour"}
              {" · "}Espace entreprise
            </span>
            <h1 className="dashboard-hero__title">{headline}</h1>
            <p className="dashboard-hero__next">
              {next ? (
                <>
                  Le plus proche&nbsp;:{" "}
                  <strong>
                    {dayLabel(new Date(next.starts_at))},{" "}
                    {toHHMM(new Date(next.starts_at))} –{" "}
                    {toHHMM(new Date(next.ends_at))}
                  </strong>
                  {" · "}
                  {next.title}
                  {" · "}
                  {accepted.get(next.id) ?? 0}/{next.headcount} pourvu
                </>
              ) : (
                "Publiez votre prochain besoin en quelques minutes."
              )}
            </p>
            <div className="dashboard-hero__actions">
              {pendingTotal > 0 ? (
                <>
                  <Link className="dashboard-hero__cta" to="/company/applications">
                    Traiter {pendingTotal} candidature
                    {pendingTotal > 1 ? "s" : ""}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link
                    className="dashboard-hero__ghost"
                    to="/company/missions/new"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Créer une mission
                  </Link>
                </>
              ) : (
                <>
                  <Link className="dashboard-hero__cta" to="/company/missions/new">
                    <Plus size={18} aria-hidden="true" />
                    Créer une mission
                  </Link>
                  {rebook[0] && (
                    <Link
                      className="dashboard-hero__ghost"
                      to={`/company/missions/new?from=${encodeURIComponent(rebook[0].id)}`}
                    >
                      <Repeat size={16} aria-hidden="true" />
                      Republier « {rebook[0].title} »
                    </Link>
                  )}
                </>
              )}
            </div>
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

              <Tabs
                value={tab}
                onValueChange={(next) => {
                  if (isMissionTab(next)) setTab(next);
                }}
              >
                <TabsList aria-label="Filtrer les missions">
                  {missionTabs.map((entry) => (
                    <TabsTrigger key={entry.key} value={entry.key}>
                      {entry.label}
                      <Badge size="sm" variant="neutral">
                        {counts[entry.key] ?? 0}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={tab}>
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
                </TabsContent>
              </Tabs>
            </section>

            <RepublishList missions={rebook} />

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