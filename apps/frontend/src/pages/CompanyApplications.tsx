import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX2, MapPin, Users, Utensils } from "lucide-react";
import { useCompanyData } from "../hooks/CompanyData";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  applicationCandidateName,
  applicationLabels,
  type ApplicationStatus,
  type CompanyApplication,
} from "../services/applications";
import { ApplicationStatus as StatusBadge } from "../components/applications/ApplicationStatus";

const when = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Filter = "pending" | ApplicationStatus | "all";

const filters: { key: Filter; label: string }[] = [
  { key: "pending", label: "À traiter" },
  { key: "accepted", label: applicationLabels.accepted + "s" },
  { key: "rejected", label: applicationLabels.rejected + "s" },
  { key: "all", label: "Toutes" },
];

function Card({ application }: { application: CompanyApplication }) {
  const { mission, worker } = application;
  return (
    <li className="application-card">
      <div className="application-card-head">
        <div>
          <strong>{applicationCandidateName(application)}</strong>
          <p className="quiet">
            {[worker.main_job, worker.city].filter(Boolean).join(" · ") ||
              "Profil en cours de complétion"}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <p className="application-card-mission">
        <Utensils size={14} aria-hidden="true" />
        <Link to={`/company/missions/${mission.id}`}>{mission.title}</Link>
      </p>
      <p className="quiet application-card-meta">
        <MapPin size={13} aria-hidden="true" />
        {mission.city}
        {" · "}
        {when.format(new Date(mission.starts_at))}
      </p>

      {application.conflict && application.status === "pending" && (
        <p className="application-conflict">
          <CalendarX2 size={14} aria-hidden="true" />
          Déjà engagée sur un autre créneau : cette candidature ne peut plus
          être acceptée.
        </p>
      )}

      <Link className="link-more" to={`/company/missions/${mission.id}`}>
        {application.status === "pending"
          ? "Examiner la candidature →"
          : "Voir la mission →"}
      </Link>
    </li>
  );
}

/**
 * Toutes les candidatures reçues, missions confondues.
 *
 * Cet écran s'appelait « Candidats » et ne montrait rien : il décrivait un
 * moteur de matching à venir, livré depuis. Il montre désormais exactement ce
 * que son nom annonce — des personnes qui ont postulé, et rien d'autre.
 *
 * Les profils suggérés par le rapprochement n'y figurent pas : l'entreprise ne
 * traite que les personnes qui ont réellement choisi de postuler.
 */
export function CompanyApplicationsPage() {
  usePageSeo({
    title: "Candidatures reçues · InteriMatch",
    description: "Consultation des candidatures pour vos missions.",
    robots: "noindex,nofollow",
  });
  const { applications, counts, loading, error } = useCompanyData();
  const [filter, setFilter] = useState<Filter>("pending");

  const shown = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((one) => one.status === filter),
    [applications, filter],
  );

  const tally: Record<Filter, number> = {
    pending: counts.pending,
    accepted: counts.accepted,
    rejected: counts.rejected,
    all: counts.total,
  };

  return (
    <section className="page-wide">
      <span className="eyeline">Espace entreprise</span>
      <h1>Candidatures</h1>
      <p className="quiet page-lead">
        Les intérimaires qui ont postulé à vos missions. Chaque candidature se
        traite depuis la mission concernée.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="chips" role="group" aria-label="Filtrer les candidatures">
        {filters.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={"chip" + (filter === entry.key ? " is-active" : "")}
            aria-pressed={filter === entry.key}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
            <span className="chip-count">{tally[entry.key]}</span>
          </button>
        ))}
      </div>

      {loading && applications.length === 0 ? (
        <ul className="application-cards" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <li className="application-card" key={n}>
              <span className="skeleton-row" />
            </li>
          ))}
        </ul>
      ) : shown.length > 0 ? (
        <ul className="application-cards">
          {shown.map((application) => (
            <Card key={application.id} application={application} />
          ))}
        </ul>
      ) : (
        <div className="empty">
          <Users aria-hidden="true" />
          <h2>
            {counts.total === 0
              ? "Aucune candidature reçue"
              : "Rien dans ce filtre"}
          </h2>
          <p>
            {counts.total === 0
              ? "Publiez une mission : dès qu’un intérimaire y postule, sa candidature apparaît ici."
              : "Aucune candidature ne porte ce statut pour l’instant."}
          </p>
          {counts.total === 0 && (
            <Link className="button" to="/company/missions/new">
              Créer une mission
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
