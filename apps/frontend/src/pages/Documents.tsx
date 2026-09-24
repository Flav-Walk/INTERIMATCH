import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  FileText,
} from "lucide-react";
import { HeroBanner } from "../components/HeroBanner";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  documentStatus,
  listDocuments,
  type ContractListItem,
} from "../services/documents";
import { errorMessage } from "../services/session";

const date = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function counterpart(document: ContractListItem, role: "worker" | "company") {
  if (role === "worker")
    return (
      document.company.establishment_name ??
      document.company.legal_name ??
      "Établissement"
    );
  return (
    `${document.worker.first_name ?? ""} ${document.worker.last_name ?? ""}`.trim() ||
    "Intérimaire"
  );
}

export function DocumentsPage({ role }: { role: "worker" | "company" }) {
  usePageSeo({
    title: `${role === "worker" ? "Mes documents" : "Documents"} · InteriMatch`,
    description: "Documents de mission et suivi des validations.",
    robots: "noindex,nofollow",
  });
  const { revision } = useAuth();
  const [documents, setDocuments] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void listDocuments(role)
      .then((result) => {
        if (live) setDocuments(result.documents);
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
  }, [attempt, revision, role]);

  const base = role === "worker" ? "/worker/documents" : "/company/documents";

  return (
    <section className="page-wide documents-page">
      <HeroBanner
        compact
        eyeline={role === "worker" ? "Espace intérimaire" : "Espace entreprise"}
        title={role === "worker" ? "Mes documents" : "Documents"}
        subtitle={
          role === "worker"
            ? "Retrouvez les documents générés après votre sélection et suivez leur validation."
            : "Suivez les documents liés aux intérimaires retenus pour vos missions."
        }
        mascotPose="profile"
      />

      {error ? (
        <div className="document-load-error">
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
        <div className="document-skeleton" aria-label="Chargement des documents">
          <span />
          <span />
          <span />
        </div>
      ) : documents.length === 0 ? (
        <div className="empty documents-empty">
          <FileText aria-hidden="true" />
          <h2>Aucun document pour le moment</h2>
          <p>
            Un document apparaît automatiquement lorsqu’une candidature est
            acceptée pour une mission.
          </p>
        </div>
      ) : (
        <ul className="document-list">
          {documents.map((document) => (
            <li key={document.id}>
              <div className="document-list__icon" aria-hidden="true">
                <FileText size={20} />
              </div>
              <div className="document-list__main">
                <span className="quiet">{counterpart(document, role)}</span>
                <h2>{document.mission.title}</h2>
                <span className="document-date">
                  <CalendarDays size={14} aria-hidden="true" />
                  {date.format(new Date(document.mission.starts_at))}
                </span>
                {role === "company" && (
                  <span className="document-list__signatures">
                    Intérimaire :{" "}
                    {document.worker_signed_at ? "validé" : "en attente"}
                    <span aria-hidden="true"> · </span>
                    Entreprise :{" "}
                    {document.company_signed_at ? "validé" : "en attente"}
                  </span>
                )}
              </div>
              <span className={`document-status is-${document.status}`}>
                {documentStatus(document.status, role)}
              </span>
              <Link className="link-more" to={`${base}/${document.id}`}>
                Voir
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
