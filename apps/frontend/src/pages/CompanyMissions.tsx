import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Plus, SearchX, X } from "lucide-react";
import { errorMessage } from "../services/session";
import { useAuth } from "../hooks/useAuth";
import { MissionCard } from "../components/mission/MissionCard";
import { HeroBanner } from "../components/HeroBanner";
import {
  listMissions,
  missionTabs,
  missionTabOf,
  searchMissions,
  type Mission,
  type MissionTab,
} from "../services/missions";

function MissionsSkeleton() {
  return (
    <div className="mission-grid is-wide" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}

/**
 * Liste complète des missions de l'entreprise, avec les onglets de la maquette.
 * La recherche de l'en-tête arrive par `?q=` et filtre les missions chargées.
 */
export function CompanyMissions() {
  const { revision } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [data, setData] = useState<Mission[]>([]),
    [counts, setCounts] = useState<Partial<Record<MissionTab, number>>>({}),
    [tab, setTab] = useState<MissionTab | "all">("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");

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
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = searchMissions(
    // Le groupe vient du serveur : filtrer sur `status` laissait « Pourvues »
    // et « Terminées » vides, ces statuts n'étant jamais écrits.
    tab === "all" ? data : data.filter((m) => missionTabOf(m) === tab),
    query,
  );

  return (
    <div className="missions-list-page">
      <div className="company-brand-hero">
        <HeroBanner
          compact
          eyeline="Espace entreprise"
          title="Vos missions"
          subtitle="Préparez, publiez et suivez chaque besoin de renfort depuis un seul espace."
          mascotPose="missions"
          action={
            <Link className="brand-hero__link" to="/company/missions/new">
              <Plus size={16} aria-hidden="true" />
              Créer une mission
            </Link>
          }
        />
      </div>

      <div className="missions-list-body">
        <div className="missions-list-toolbar">
          <div className="dashboard-tabs" aria-label="Filtrer par statut">
            <button
              type="button"
              className={"dashboard-tab" + (tab === "all" ? " is-active" : "")}
              aria-pressed={tab === "all"}
              onClick={() => setTab("all")}
            >
              Toutes
              <span className="dashboard-tab__count">{data.length}</span>
            </button>
            {missionTabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={
                  "dashboard-tab" + (tab === entry.key ? " is-active" : "")
                }
                aria-pressed={tab === entry.key}
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

        {query && (
          <div className="search-result-bar" role="status">
            <span>
              <strong>{filtered.length}</strong> résultat
              {filtered.length > 1 ? "s" : ""} pour «&nbsp;{query}&nbsp;»
            </span>
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setParams({})}
            >
              <X size={13} aria-hidden="true" />
              Effacer la recherche
            </button>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!error &&
          (loading ? (
            <>
              <p role="status" className="sr-only">
                Chargement de vos missions…
              </p>
              <MissionsSkeleton />
            </>
          ) : filtered.length > 0 ? (
            <section aria-labelledby="company-missions-list-title">
              <h2 id="company-missions-list-title" className="sr-only">
                Liste de vos missions
              </h2>
              <div className="mission-grid is-wide">
                {filtered.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </div>
            </section>
          ) : query ? (
            <div className="empty">
              <SearchX aria-hidden="true" />
              <h2>Aucune mission ne correspond</h2>
              <p>
                Essayez un autre intitulé, une autre ville ou un autre métier.
              </p>
              <button
                type="button"
                className="button"
                onClick={() => setParams({})}
              >
                Effacer la recherche
              </button>
            </div>
          ) : (
            <div className="empty">
              <BriefcaseBusiness aria-hidden="true" />
              <h2>
                {tab === "all"
                  ? "Votre première mission commence ici"
                  : "Aucune mission dans cet onglet"}
              </h2>
              <p>
                Décrivez le poste, les horaires et les compétences attendues :
                les candidats compatibles vous seront ensuite proposés.
              </p>
              <Link className="button" to="/company/missions/new">
                Créer une mission
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ))}
      </div>
    </div>
  );
}
