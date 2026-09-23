import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Clock3, MapPin } from "lucide-react";
import { errorMessage } from "../services/session";
import {
  listMyApplications,
  workerMissionContext,
  type WorkerApplication,
} from "../services/applications";
import { ApplicationStatus } from "../components/applications/ApplicationStatus";
import { workerApplicationSchedule } from "../components/applications/ConfirmedMissions";
// Nouvelle DA : onglets de filtre (Animated Tabs, SmoothUI), lignes qui
// apparaissent en cascade (Blur Fade, Magic UI), chiffres qui défilent
// (Number Ticker, Magic UI).
import AnimatedTabs from "../components/ui/animated-tabs";
import { BlurFade } from "../components/ui/blur-fade";
import { NumberTicker } from "../components/ui/number-ticker";
import { EmptyState } from "../components/da/EmptyState";

export function workerApplicationContext(application: WorkerApplication) {
  return workerMissionContext(application).label;
}

export function WorkerApplicationList({
  applications,
}: {
  applications: WorkerApplication[];
}) {
  if (!applications.length)
    return (
      <EmptyState icon={BriefcaseBusiness} className="application-page-empty">
        <h2>Vous n’avez pas encore postulé</h2>
        <p>
          Consultez les missions disponibles et ouvrez celle qui vous intéresse.
        </p>
        <Link className="button" to="/worker/missions">
          Voir les missions
        </Link>
      </EmptyState>
    );

  return (
    <ul className="worker-application-list">
      {applications.map((application, index) => {
        const context = workerMissionContext(application);
        const start = new Date(application.mission.starts_at);
        const location = [
          application.mission.postal_code,
          application.mission.city,
        ]
          .filter(Boolean)
          .join(" ");
        const state = ["confirmed", "running"].includes(context.key)
          ? "is-confirmed"
          : context.key === "cancelled" ||
              context.key === "completed" ||
              context.key === "filled"
            ? "is-inactive"
            : undefined;
        return (
          <li key={application.id} className={state}>
            {/* Chaque ligne arrive en fondu, 60 ms après la précédente. */}
            <BlurFade delay={Math.min(index, 8) * 0.06} className="worker-application-row">
              {/* Page d'agenda (même dessin que « Vos prochaines missions »). */}
              <span className="next-mission__date" aria-hidden="true">
                <span>{weekday.format(start)}</span>
                <strong>{start.getDate()}</strong>
                <span>{month.format(start)}</span>
              </span>
              <div className="worker-application-main">
                <span className="worker-application-company">
                  {application.company.establishment_name ?? "Établissement"}
                  {/* Le contexte (« Mission confirmée », « Mission annulée »…)
                      en texte simple, plus en badge. */}
                  <em className={`application-context is-${context.key}`}>
                    {context.label}
                  </em>
                </span>
                <h2>{application.mission.title}</h2>
                <div className="application-meta">
                  <span>
                    <Clock3 size={14} aria-hidden="true" />
                    {workerApplicationSchedule(application)}
                  </span>
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {location || "Lieu à confirmer"}
                  </span>
                </div>
              </div>
              <div className="worker-application-side">
                <ApplicationStatus status={application.status} />
                <Link
                  className="link-more"
                  to={`/worker/missions/${application.mission_id}`}
                >
                  Voir la mission
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </BlurFade>
          </li>
        );
      })}
    </ul>
  );
}

// Morceaux de date pour la page d'agenda de chaque ligne.
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const month = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/** Les onglets de filtre, et à quelle candidature chacun correspond. */
type Filter = "all" | "pending" | "confirmed" | "past";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "pending", label: "En attente" },
  { id: "confirmed", label: "Confirmées" },
  { id: "past", label: "Terminées et refusées" },
];
function matches(filter: Filter, application: WorkerApplication) {
  const key = workerMissionContext(application).key;
  if (filter === "pending") return key === "pending";
  if (filter === "confirmed") return key === "confirmed" || key === "running";
  if (filter === "past")
    return !["pending", "confirmed", "running"].includes(key);
  return true;
}

export function WorkerApplications() {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  // Combien de candidatures dans chaque onglet (affiché dans l'en-tête).
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ id }) => [
          id,
          applications.filter((a) => matches(id, a)).length,
        ]),
      ) as Record<Filter, number>,
    [applications],
  );
  const shown = applications.filter((a) => matches(filter, a));

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void listMyApplications()
      .then((result) => {
        if (live) setApplications(result.applications);
      })
      .catch((cause) => {
        if (live) setError(errorMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <section className="page-wide applications-page">
      <div className="section-head applications-head">
        <div>
          <h1>Mes candidatures</h1>
          <p className="quiet">Suivez ici les réponses des entreprises.</p>
        </div>
        {/* Trois chiffres clés, qui défilent jusqu'à leur valeur. */}
        {!loading && !error && applications.length > 0 && (
          <dl className="applications-figures">
            <div>
              <dt>En attente</dt>
              <dd>
                <NumberTicker value={counts.pending} />
              </dd>
            </div>
            <div>
              <dt>Confirmées</dt>
              <dd>
                <NumberTicker value={counts.confirmed} />
              </dd>
            </div>
            <div>
              <dt>Au total</dt>
              <dd>
                <NumberTicker value={counts.all} />
              </dd>
            </div>
          </dl>
        )}
      </div>
      {error ? (
        <div className="application-load-error">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : loading ? (
        <p className="quiet" role="status">
          Chargement de vos candidatures…
        </p>
      ) : (
        <>
          {applications.length > 0 && (
            // Animated Tabs (SmoothUI), variante « underline » : le trait
            // orange glisse d'un onglet à l'autre.
            <AnimatedTabs
              className="applications-tabs"
              variant="underline"
              ariaLabel="Filtrer mes candidatures"
              tabs={FILTERS.map(({ id, label }) => ({
                id,
                label: `${label} (${counts[id]})`,
              }))}
              activeTab={filter}
              onChange={(id) => setFilter(id as Filter)}
            />
          )}
          {applications.length > 0 && shown.length === 0 ? (
            <p className="quiet applications-filter-empty" role="status">
              Aucune candidature dans cet onglet.
            </p>
          ) : (
            <WorkerApplicationList
              applications={applications.length ? shown : applications}
            />
          )}
        </>
      )}
    </section>
  );
}
