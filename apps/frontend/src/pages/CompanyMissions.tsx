import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, SearchX } from "lucide-react";
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
    tab === "all" ? data : data.filter((m) => m.status === tab),
    query,
  );

  return (
    <section className="page-wide">
      <div className="section-head">
        <h1>Vos missions</h1>
        <div className="chips">
          <button
            type="button"
            className={"chip" + (tab === "all" ? " is-active" : "")}
            aria-pressed={tab === "all"}
            onClick={() => setTab("all")}
          >
            Toutes
            <span className="chip-count">{data.length}</span>
          </button>
          {missionTabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={"chip" + (tab === entry.key ? " is-active" : "")}
              aria-pressed={tab === entry.key}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
              <span className="chip-count">{counts[entry.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <Link className="button" to="/company/missions/new">
          Créer une mission
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {query && (
        <p className="quiet search-note" role="status">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""} pour
          «&nbsp;
          {query}&nbsp;»
          <button
            type="button"
            className="text-button"
            onClick={() => setParams({})}
          >
            Effacer la recherche
          </button>
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="quiet">
          Chargement de vos missions…
        </p>
      ) : filtered.length > 0 ? (
        <div className="mission-grid is-wide">
          {filtered.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      ) : query ? (
        <div className="empty">
          <SearchX aria-hidden="true" />
          <h2>Aucune mission ne correspond</h2>
          <p>Essayez un autre intitulé, une autre ville ou un autre métier.</p>
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
            Décrivez le poste, les horaires et les compétences attendues : les
            candidats compatibles vous seront ensuite proposés.
          </p>
          <Link className="button" to="/company/missions/new">
            Créer une mission
          </Link>
        </div>
      )}
    </section>
  );
}
