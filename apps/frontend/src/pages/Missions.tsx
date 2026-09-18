// src/pages/Missions.tsx
//
// Logique Flavien — intacte (useAuth, services, états, explainEmpty).
// JSX rewrite v2 — charte ALP'EMPLOI, filtres ville front-only, skeletons.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import {
  explainEmpty,
  listOpenMissions,
  type Exclusions,
  type OpenMission,
} from "../services/missions";

// ─── Constantes ───────────────────────────────────────────────────────────────

const HOW_STEPS = [
  "Recevoir les missions compatibles avec votre zone",
  "Consulter le détail et les compétences attendues",
  "Accepter ou refuser chaque proposition",
];

// ─── Skeleton (état loading) ──────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="mission-grid" aria-hidden="true" aria-label="Chargement des missions">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function Missions() {
  // ── État — logique Flavien, rien de modifié ──────────────────────────────
  const { user, revision } = useAuth();
  const [missions,  setMissions]  = useState<OpenMission[]>([]);
  const [excluded,  setExcluded]  = useState<Exclusions>();
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // ── Filtre ville — front-only, ne touche pas aux services ────────────────
  const [filterCity, setFilterCity] = useState("");

  // ── Fetch — logique Flavien intouchable ──────────────────────────────────
  useEffect(() => {
    let live = true;
    setLoading(true);
    void listOpenMissions()
      .then((r) => {
        if (!live) return;
        setMissions(r.missions);
        setExcluded(r.excluded);
        setError("");
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [revision]);

  if (!user || user.role !== "worker") return null;

  const reason = explainEmpty(excluded);

  // ── Villes uniques extraites du résultat serveur ─────────────────────────
  const cities = useMemo(
    () => Array.from(new Set(missions.map((m) => m.city).filter(Boolean))).sort(),
    [missions],
  );

  // ── Missions affichées après filtre ─────────────────────────────────────
  const displayed = filterCity
    ? missions.filter((m) => m.city === filterCity)
    : missions;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="missions-page">

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="page-hero">
        <div className="page-hero__inner">
          <span className="eyeline">Espace intérimaire</span>
          <h1>Missions disponibles</h1>
          <p className="page-hero__lead">
            Les missions compatibles avec votre profil, votre zone et vos
            disponibilités — de la plus compatible à la moins compatible.
          </p>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="missions-page__body">

        {/* Erreur réseau */}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {/* Loading → skeletons animés */}
        {loading ? (
          <SkeletonGrid />

        ) : missions.length > 0 ? (
          <>
            {/* Toolbar : compteur + filtre ville */}
            <div className="missions-toolbar">
              <p className="missions-toolbar__count" role="status">
                <Sparkles size={15} aria-hidden="true" />
                <strong>{displayed.length}</strong>
                {" "}mission{displayed.length > 1 ? "s" : ""} compatible
                {displayed.length > 1 ? "s" : ""}
                {filterCity && ` à ${filterCity}`}
              </p>

              {/* Filtre ville — affiché uniquement si 2+ villes disponibles */}
              {cities.length > 1 && (
                <div className="missions-toolbar__filter">
                  <label htmlFor="filter-city" className="sr-only">
                    Filtrer par ville
                  </label>
                  <div className="select-wrapper">
                    <select
                      id="filter-city"
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                    >
                      <option value="">Toutes les villes</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>

            {/* Grille de missions */}
            <div className="mission-grid">
              {displayed.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  basePath="/worker/missions"
                  score={mission.match.score}
                />
              ))}
            </div>

            {/* Filtre actif mais aucune mission dans cette ville */}
            {displayed.length === 0 && (
              <div className="empty">
                <BriefcaseBusiness aria-hidden="true" />
                <h2>Aucune mission à {filterCity}</h2>
                <p>Essayez une autre ville ou consultez toutes les missions.</p>
                <button className="button" onClick={() => setFilterCity("")}>
                  Voir toutes les missions
                </button>
              </div>
            )}
          </>

        ) : (
          /* ── État vide global ──────────────────────────────────────────── */
          <>
            <div className="empty">
              <BriefcaseBusiness aria-hidden="true" />
              <h2>
                {reason
                  ? reason.title
                  : "Aucune mission disponible pour le moment"}
              </h2>
              <p>
                {reason
                  ? reason.detail
                  : "Aucune mission n'est publiée pour l'instant. Dès qu'un établissement en publie une qui vous correspond, elle apparaît ici."}
              </p>
              {reason ? (
                <Link className="button" to={reason.action.to}>
                  {reason.action.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                !user.onboarding_completed && (
                  <Link className="button" to="/worker/profile">
                    Compléter mon profil
                  </Link>
                )
              )}
            </div>

            {/* Comment ça marche */}
            <section className="how-it-works" aria-labelledby="how-title">
              <h2 id="how-title">Comment cela fonctionnera</h2>
              <ol className="how-steps" role="list">
                {HOW_STEPS.map((label, i) => (
                  <li key={label} className="how-step">
                    <span className="how-step__num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <Check size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  );
}