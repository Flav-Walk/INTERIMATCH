import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  Utensils,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import { PlanningCard } from "../components/mission/PlanningCard";
import {
  listMissions,
  missionTabs,
  type Mission,
  type MissionTab,
} from "../services/missions";

/**
 * Accueil de l'espace entreprise, repris de la maquette : carte héros, section
 * « Vos missions » avec ses filtres, puis rail droit planning et établissement.
 *
 * Les blocs Messages, Documents, mode urgent et aide conversationnelle de la
 * maquette ne sont pas repris : les services correspondants n'existent pas, et
 * aucun bouton factice ne doit figurer dans le produit.
 */
export function CompanyDashboard() {
  const { user } = useAuth();
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
  }, []);

  if (!user) return null;
  const p = user.profile;
  const shown = data.filter((m) => m.status === tab).slice(0, 4);

  return (
    <>
      {user.demo && (
        <p className="demo-label">DEVELOPMENT / DEMO DATA · Profil fictif</p>
      )}
      <div className="layout">
        <div className="layout-main">
          <section className="hero" data-tour="profile-status">
            <div className="hero-body">
              <span className="hero-badge">
                {p.establishment_name ?? "Votre établissement"}
              </span>
              <h1>
                {user.first_name ? `Bonjour ${user.first_name},` : "Bonjour,"}
                <br />
                Prêt à renforcer votre équipe&nbsp;?
              </h1>
              <p>
                Publiez une mission en quelques minutes et trouvez des talents
                qualifiés près de chez vous.
              </p>
              <button
                className="button"
                disabled
                title="La création de mission arrive au prochain sous-lot"
              >
                Créer une mission
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="hero-media" aria-hidden="true">
              <Utensils />
            </div>
          </section>

          <section data-tour="missions">
            <div className="section-head">
              <h2>Vos missions</h2>
              <div className="chips">
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
              <Link className="link-more" to="/company/missions">
                Voir toutes les missions →
              </Link>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p role="status" className="quiet">
                Chargement de vos missions…
              </p>
            ) : shown.length > 0 ? (
              <div className="mission-grid">
                {shown.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
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
                <button
                  className="button"
                  disabled
                  title="La création de mission arrive au prochain sous-lot"
                >
                  Créer une mission
                </button>
              </div>
            )}
          </section>

          <section data-tour="candidates">
            <div className="section-head">
              <h2>Candidatures récentes</h2>
              <Link className="link-more" to="/company/candidates">
                Voir toutes les candidatures →
              </Link>
            </div>
            <div className="empty is-placeholder">
              <Users aria-hidden="true" />
              <h3>Aucune candidature pour le moment</h3>
              <p>
                Les profils compatibles apparaîtront ici, classés par score, dès
                que le rapprochement sera disponible.
              </p>
            </div>
          </section>
        </div>

        <aside className="layout-rail">
          <PlanningCard missions={data} />
          <section className="rail-card">
            <div className="rail-head">
              <Building2 size={18} aria-hidden="true" />
              <h2>Votre établissement</h2>
            </div>
            {user.onboarding_completed ? (
              <>
                <p className="lead-figure">{p.establishment_name}</p>
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
                  Les intérimaires verront ces informations avant de répondre à
                  vos missions.
                </p>
                <Link className="secondary-button inline" to="/company/profile">
                  Compléter mon établissement
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
