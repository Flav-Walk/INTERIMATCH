import { Link } from "react-router-dom";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { useCompanyData } from "../../hooks/CompanyData";
import {
  applicationCandidateName,
  type CompanyApplication,
} from "../../services/applications";
import { ApplicationStatus } from "./ApplicationStatus";

const day = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** « il y a 3 heures » plutôt qu'une date : ce qui compte est la fraîcheur. */
function since(iso: string) {
  const minutes = Math.max(0, (Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${Math.floor(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `il y a ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} jours`;
}

export function ApplicationRow({
  application,
}: {
  application: CompanyApplication;
}) {
  return (
    <li>
      <Link
        className="application-row"
        to={`/company/missions/${application.mission.id}`}
      >
        <span className="application-row-main">
          <strong>{applicationCandidateName(application)}</strong>
          <span className="quiet">
            {application.mission.title}
            {application.worker.city && (
              <>
                {" · "}
                <MapPin size={13} aria-hidden="true" />
                {application.worker.city}
              </>
            )}
          </span>
        </span>
        <span className="application-row-side">
          <ApplicationStatus status={application.status} />
          <span className="quiet">
            <CalendarClock size={13} aria-hidden="true" />
            {since(application.created_at)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Les dernières candidatures reçues, sur l'accueil entreprise.
 *
 * Cet emplacement affichait jusqu'ici un bloc figé annonçant « aucune
 * candidature » — sans jamais interroger le serveur. Une entreprise pouvait
 * donc recevoir dix candidatures et lire qu'elle n'en avait aucune.
 *
 * Les profils suggérés par le rapprochement n'ont pas leur place ici : personne
 * ne s'est manifesté, il n'y a donc rien à traiter.
 */
export function RecentApplications({ limit = 4 }: { limit?: number }) {
  const { applications, counts, loading, error } = useCompanyData();
  const recent = applications.slice(0, limit);
  const waiting = counts.pending;

  return (
    <section data-tour="candidates">
      <div className="section-head">
        <h2>Candidatures récentes</h2>
        {counts.total > 0 && (
          <Link className="link-more" to="/company/applications">
            Voir les {counts.total} candidature{counts.total > 1 ? "s" : ""} →
          </Link>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {waiting > 0 && (
        <p className="quiet" role="status">
          {waiting} candidature{waiting > 1 ? "s" : ""} attend
          {waiting > 1 ? "ent" : ""} votre réponse.
        </p>
      )}

      {loading && recent.length === 0 ? (
        <ul className="application-rows" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <li key={n}>
              <span className="skeleton-row" />
            </li>
          ))}
        </ul>
      ) : recent.length > 0 ? (
        <ul className="application-rows">
          {recent.map((application) => (
            <ApplicationRow key={application.id} application={application} />
          ))}
        </ul>
      ) : (
        <div className="empty">
          <Users aria-hidden="true" />
          <h3>Aucune candidature reçue</h3>
          <p>
            Dès qu’un intérimaire postule à l’une de vos missions, sa
            candidature apparaît ici, avant même que vous ouvriez la mission.
          </p>
        </div>
      )}
    </section>
  );
}

/** Missions démarrant sous huit jours, pour l'aperçu du tableau de bord. */
export function startingSoon<T extends { starts_at: string; status: string }>(
  missions: T[],
  days = 8,
) {
  const now = Date.now();
  const horizon = now + days * 86_400_000;
  return missions
    .filter(
      (m) =>
        m.status === "open" &&
        Date.parse(m.starts_at) > now &&
        Date.parse(m.starts_at) <= horizon,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export { day as missionDayFormat };
