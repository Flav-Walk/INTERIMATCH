import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  Plus,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import { RecentApplications } from "../components/applications/RecentApplications";
import { useCompanyData } from "../hooks/CompanyData";
import { pendingByMission } from "../services/applications";
import { PlanningCard } from "../components/mission/PlanningCard";
import { HeroBanner } from "../components/HeroBanner";
import {
  listMissions,
  missionTabs,
  missionTabOf,
  type Mission,
  type MissionTab,
} from "../services/missions";
import { EmptyState } from "../components/da/EmptyState";

function MissionsSkeleton() {
  return (
    <div className="mission-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}

/**
 * Accueil de l'espace entreprise : carte héros, section « Vos missions » avec
 * ses filtres, puis rail droit planning et établissement.
 *
 * Les blocs Messages, Documents, mode urgent et aide conversationnelle de la
 * maquette ne sont pas repris : les services correspondants n'existent pas, et
 * aucun bouton factice ne doit figurer dans le produit.
 */
export function CompanyDashboard() {
  const { user, revision } = useAuth();
  // Les candidatures viennent du fournisseur partagé : la même lecture sert le
  // badge de navigation, cette page et l'écran Candidatures.
  const { applications } = useCompanyData();
  const [data, setData] = useState<Mission[]>([]),
    [counts, setCounts] = useState<Partial<Record<MissionTab, number>>>({}),
    [tab, setTab] = useState<MissionTab>("open"),
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
    // `revision` change après chaque écriture et au retour sur l'onglet : la
    // liste et les compteurs suivent alors l'état réel du serveur.
  }, [revision]);

  if (!user) return null;
  const p = user.profile;
  // Même regroupement que les compteurs servis par le serveur : filtrer sur
  // `status` laissait « Pourvues » et « Terminées » vides face à un compteur
  // non nul, ces statuts n'étant jamais écrits.
  const shown = data.filter((m) => missionTabOf(m) === tab).slice(0, 4);
  const pending = pendingByMission(applications);

  return (
    <div className="dashboard-page">
      {user.demo && (
        <p className="demo-banner" role="status">
          DEVELOPMENT / DEMO DATA · Profil fictif
        </p>
      )}

      <div className="company-brand-hero" data-tour="profile-status">
        <HeroBanner
          eyeline={p.establishment_name ?? "Espace entreprise"}
          title={
            user.first_name
              ? `Bonjour ${user.first_name}, prêt à renforcer votre équipe ?`
              : "Prêt à renforcer votre équipe ?"
          }
          subtitle="Publiez une mission en quelques minutes et suivez les candidatures qualifiées près de chez vous."
          mascotPose="dashboard"
          action={
            <Link className="brand-hero__link" to="/company/missions/new">
              <Plus size={18} aria-hidden="true" />
              Créer une mission
            </Link>
          }
        />
      </div>

      <div className="dashboard-body">
        <div className="dashboard-layout">
          <div className="dashboard-main">
            <section aria-labelledby="missions-title" data-tour="missions">
              <div className="dashboard-section-head">
                <h2 id="missions-title">Vos missions</h2>
                <Link className="link-more" to="/company/missions">
                  Voir toutes les missions →
                </Link>
              </div>

              <div className="dashboard-tabs" aria-label="Filtrer les missions">
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
                    {/* Même principe qu'Animated Tabs (SmoothUI, variante
                        « underline ») : le trait orange est UN élément qui
                        glisse d'un onglet à l'autre (layoutId). Les boutons
                        et aria-pressed restent : les tests e2e s'en servent. */}
                    {tab === entry.key && (
                      <motion.span
                        layoutId="dashboard-tab-pill"
                        className="dashboard-tab__pill"
                        aria-hidden="true"
                        transition={{ type: "spring", bounce: 0.05, duration: 0.3 }}
                      />
                    )}
                    <span className="dashboard-tab__label">{entry.label}</span>
                    <span className="dashboard-tab__count">
                      {counts[entry.key] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

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
                  <EmptyState icon={BriefcaseBusiness}>
                    <h3>Aucune mission dans cet onglet</h3>
                    <p>
                      Créez une mission pour commencer à recevoir des candidats
                      compatibles.
                    </p>
                    <Link className="button" to="/company/missions/new">
                      Créer une mission
                    </Link>
                  </EmptyState>
                ))}
            </section>

            <RecentApplications />
          </div>

          <aside
            className="dashboard-rail"
            aria-label="Planning et établissement"
          >
            <PlanningCard missions={data} />
            <section className="detail-card" aria-labelledby="company-info">
              <h2 id="company-info" className="detail-card__title">
                <Building2 size={16} aria-hidden="true" />
                Votre établissement
              </h2>
              {user.onboarding_completed ? (
                <>
                  <p className="detail-company-name">{p.establishment_name}</p>
                  <p className="quiet">
                    {p.address ? `${p.address}, ` : ""}
                    {p.postal_code} {p.city}
                  </p>
                  <Link className="link-more" to="/company/profile">
                    Modifier les informations →
                  </Link>
                </>
              ) : (
                <>
                  <p className="quiet">
                    Les intérimaires verront ces informations avant de répondre
                    à vos missions.
                  </p>
                  <Link
                    className="secondary-button inline"
                    to="/company/profile"
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
