import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Plus, SearchX, X } from "lucide-react";
import { errorMessage } from "../services/session";
import { useAuth } from "../hooks/useAuth";
import { MissionCard } from "../components/mission/MissionCard";
import { HeroBanner } from "../components/HeroBanner";
import { EmptyState, PageBody } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Reveal } from "../components/ui/Reveal";
import {
  listMissions,
  missionTabs,
  missionTabOf,
  searchMissions,
  type Mission,
  type MissionTab,
} from "../services/missions";

/** Ossature de chargement : la forme de la carte, pas un rectangle gris. */
function MissionsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-panel border border-rule bg-surface"
        >
          <div className="aspect-[16/9] animate-pulse bg-paper-deep" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper-deep" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-paper-deep" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-paper-deep" />
          </div>
        </div>
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
    <>
      <HeroBanner
        compact
        eyeline="Espace entreprise"
        title="Vos missions"
        subtitle="Préparez, publiez et suivez chaque besoin de renfort depuis un seul espace."
        mascotPose="missions"
        action={
          <Link className="im-btn im-btn--primary" to="/company/missions/new">
            <Plus size={16} aria-hidden="true" />
            Créer une mission
          </Link>
        }
      />

      <PageBody className="space-y-6">
        {/*
         * CE SONT DES FILTRES, PAS DES ONGLETS. On ne change pas de panneau :
         * on restreint la même liste. Le groupe est donc rendu en boutons à
         * deux états, et non en `tablist` — voir `Segmented`.
         */}
        <Segmented
          mode="filters"
          variant="switch"
          label="Filtrer par statut"
          value={tab}
          onChange={(id) => setTab(id as MissionTab | "all")}
          items={[
            { id: "all", label: "Toutes", count: data.length },
            ...missionTabs.map((entry) => ({
              id: entry.key,
              label: entry.label,
              count: counts[entry.key] ?? 0,
            })),
          ]}
        />

        {query && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-rule bg-surface px-4 py-3"
            role="status"
          >
            <span className="text-[0.875rem] text-ink-soft">
              <strong className="font-semibold text-ink">
                {filtered.length}
              </strong>{" "}
              résultat{filtered.length > 1 ? "s" : ""} pour «&nbsp;{query}&nbsp;»
            </span>
            <button
              type="button"
              className="im-btn im-btn--quiet im-btn--sm"
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
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((mission, index) => (
                  <Reveal
                    key={mission.id}
                    delay={Math.min(index, 5) * 0.04}
                    className="h-full"
                  >
                    <MissionCard mission={mission} />
                  </Reveal>
                ))}
              </div>
            </section>
          ) : query ? (
            <EmptyState
              icon={<SearchX size={20} />}
              title="Aucune mission ne correspond"
              action={
                <button
                  type="button"
                  className="im-btn im-btn--outline"
                  onClick={() => setParams({})}
                >
                  Effacer la recherche
                </button>
              }
            >
              Essayez un autre intitulé, une autre ville ou un autre métier.
            </EmptyState>
          ) : (
            <EmptyState
              icon={<BriefcaseBusiness size={20} />}
              title={
                tab === "all"
                  ? "Votre première mission commence ici"
                  : "Aucune mission dans cet onglet"
              }
              action={
                <Link className="im-btn im-btn--primary" to="/company/missions/new">
                  Créer une mission
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              }
            >
              Décrivez le poste, les horaires et les compétences attendues : les
              candidats compatibles vous seront ensuite proposés.
            </EmptyState>
          ))}
      </PageBody>
    </>
  );
}
