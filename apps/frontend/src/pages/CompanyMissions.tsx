// src/pages/CompanyMissions.tsx
//
// Logique Flavien — intacte (listMissions, searchMissions, tabs, query params).
// JSX rewrite v2 — hero, chips dashboard-tab, skeleton, charte ALP'EMPLOI.

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Plus,
  SearchX,
  X,
} from "lucide-react";
import { errorMessage } from "../services/session";
import { useAuth } from "../hooks/useAuth";
import { MissionCard } from "../components/mission/MissionCard";
import {
  listMissions,
  missionTabs,
  searchMissions,
  type Mission,
  type MissionTab,
} from "../services/missions";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MissionsListSkeleton() {
  return (
    <div className="mission-grid mission-grid--wide" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CompanyMissions() {
  // ── Logique Flavien — intouchable ────────────────────────────────────────
  const { revision } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [data,    setData]    = useState<Mission[]>([]);
  const [counts,  setCounts]  = useState<Partial<Record<MissionTab, number>>>({});
  const [tab,     setTab]     = useState<MissionTab | "all">("all");
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

  const filtered = searchMissions(
    tab === "all" ? data : data.filter((m) => m.status === tab),
    query,
  );

  return (
    <div className="missions-list-page">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--space">
          <div>
            <span className="eyeline">Espace entreprise</span>
            <h1>Vos missions</h1>
          </div>
          <Link className="dashboard-hero__cta" to="/company/missions/new">
            <Plus size={16} aria-hidden="true" />
            Créer une mission
          </Link>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="missions-list-body">

        {/* Toolbar : chips + compteur total */}
        <div className="missions-list-toolbar">
          <div className="dashboard-tabs" role="tablist" aria-label="Filtrer par statut">

            {/* Onglet "Toutes" */}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={["dashboard-tab", tab === "all" ? "is-active" : ""].join(" ").trim()}
              onClick={() => setTab("all")}
            >
              Toutes
              <span className="dashboard-tab__count">{data.length}</span>
            </button>

            {/* Onglets par statut */}
            {missionTabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={["dashboard-tab", tab === entry.key ? "is-active" : ""].join(" ").trim()}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
                <span className="dashboard-tab__count">
                  {counts[entry.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Résultat de recherche active */}
        {query && (
          <div className="search-result-bar" role="status">
            <span>
              <strong>{filtered.length}</strong>{" "}
              résultat{filtered.length > 1 ? "s" : ""} pour «&nbsp;{query}&nbsp;»
            </span>
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setParams({})}
              aria-label="Effacer la recherche"
            >
              <X size={13} aria-hidden="true" />
              Effacer
            </button>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <p className="form-error" role="alert">{error}</p>
        )}

        {/* Loading */}
        {loading ? (
          <MissionsListSkeleton />

        ) : filtered.length > 0 ? (
          <div className="mission-grid mission-grid--wide">
            {filtered.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>

        ) : query ? (
          /* Empty — recherche sans résultat */
          <div className="empty">
            <SearchX aria-hidden="true" />
            <h2>Aucune mission ne correspond</h2>
            <p>Essayez un autre intitulé, une autre ville ou un autre métier.</p>
            <button
              type="button"
              className="button"
              onClick={() => setParams({})}
            >
              Effacer la recherche
            </button>
          </div>

        ) : (
          /* Empty — aucune mission */
          <div className="empty">
            <BriefcaseBusiness aria-hidden="true" />
            <h2>
              {tab === "all"
                ? "Votre première mission commence ici"
                : "Aucune mission dans cet onglet"}
            </h2>
            <p>
              Décrivez le poste, les horaires et les compétences attendues :
              les candidats compatibles vous seront proposés.
            </p>
            <Link className="button" to="/company/missions/new">
              Créer une mission
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}