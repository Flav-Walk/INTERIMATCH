import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { HeroBanner } from "../components/HeroBanner";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  canSignDocument,
  documentStatus,
  listDocuments,
  type ContractListItem,
} from "../services/documents";
import { DocumentSteps } from "../components/documents/DocumentSteps";
import "../styles/documents-list.css";
import { errorMessage } from "../services/session";
import { EmptyState } from "../components/da/EmptyState";

const date = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
const month = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const year = new Intl.DateTimeFormat("fr-FR", { year: "numeric" });

/*
 * Les documents sont rangés par ce qu'ils demandent, l'action d'abord :
 * - « à valider »  : c'est à la personne connectée de valider ;
 * - « en cours »   : on attend l'autre partie ou la finalisation ;
 * - « finalisés »  et « annulés » ensuite.
 */
type Group = "action" | "progress" | "completed" | "cancelled";

const GROUPS: { id: Group; title: string }[] = [
  { id: "action", title: "À valider" },
  { id: "progress", title: "En cours" },
  { id: "completed", title: "Finalisés" },
  { id: "cancelled", title: "Annulés" },
];

function groupOf(document: ContractListItem, role: "worker" | "company"): Group {
  if (canSignDocument(document.status, role)) return "action";
  if (document.status === "completed") return "completed";
  if (document.status === "cancelled") return "cancelled";
  return "progress";
}

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
        <EmptyState icon={FileText} className="documents-empty">
          <h2>Aucun document pour le moment</h2>
          <p>
            Un document apparaît automatiquement lorsqu’une candidature est
            acceptée pour une mission.
          </p>
        </EmptyState>
      ) : (
        <>
          <DocumentSummary documents={documents} role={role} base={base} />
          {GROUPS.map(({ id, title }) => {
            const items = documents
              .filter((document) => groupOf(document, role) === id)
              .sort((a, b) => {
                const gap =
                  Date.parse(a.mission.starts_at) -
                  Date.parse(b.mission.starts_at);
                // À venir d'abord ; les finalisés, du plus récent au plus ancien.
                return id === "completed" ? -gap : gap;
              });
            if (items.length === 0) return null;
            return (
              <section
                key={id}
                className={`doc-group is-${id}`}
                aria-labelledby={`doc-group-${id}`}
              >
                <h2 id={`doc-group-${id}`} className="doc-group__title">
                  {title}
                  <span className="doc-group__count">{items.length}</span>
                </h2>
                <ul className="doc-cards">
                  {items.map((document) => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                      role={role}
                      base={base}
                      action={id === "action"}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}

/**
 * Synthèse en haut de page (bento, 3 cartes) : ce qui attend la personne,
 * ce qui avance sans elle, ce qui est terminé. La carte « À valider » mène
 * directement au premier document à valider.
 */
function DocumentSummary({
  documents,
  role,
  base,
}: {
  documents: ContractListItem[];
  role: "worker" | "company";
  base: string;
}) {
  const action = documents
    .filter((document) => groupOf(document, role) === "action")
    .sort(
      (a, b) =>
        Date.parse(a.mission.starts_at) - Date.parse(b.mission.starts_at),
    );
  const progress = documents.filter(
    (document) => groupOf(document, role) === "progress",
  ).length;
  const completed = documents.filter(
    (document) => groupOf(document, role) === "completed",
  ).length;

  return (
    <div className="doc-summary">
      <article className={`doc-summary__card is-action${action.length ? " is-due" : ""}`}>
        <p className="doc-summary__label">À valider</p>
        <p className="doc-summary__value">{action.length}</p>
        {action.length > 0 ? (
          <Link className="button doc-summary__cta" to={`${base}/${action[0].id}`}>
            Valider {action.length > 1 ? "le prochain" : "le document"}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <p className="doc-summary__hint">Rien n’attend votre validation.</p>
        )}
      </article>
      <article className="doc-summary__card is-progress">
        <p className="doc-summary__label">En cours</p>
        <p className="doc-summary__value">{progress}</p>
        <p className="doc-summary__hint">
          {role === "worker"
            ? "En attente de l’établissement ou de la finalisation."
            : "En attente de l’intérimaire ou de la finalisation."}
        </p>
      </article>
      <article className="doc-summary__card is-completed">
        <p className="doc-summary__label">Finalisés</p>
        <p className="doc-summary__value">{completed}</p>
        <p className="doc-summary__hint">Validés par les deux parties.</p>
      </article>
    </div>
  );
}

/** Un document : date en bloc, mission, parcours de validation, action. */
function DocumentCard({
  document,
  role,
  base,
  action,
}: {
  document: ContractListItem;
  role: "worker" | "company";
  base: string;
  action: boolean;
}) {
  const starts = new Date(document.mission.starts_at);
  const to = `${base}/${document.id}`;
  return (
    <li className={`doc-card is-${document.status}${action ? " is-action" : ""}`}>
      {/* La date de mission remplace l'icône « fichier » générique. */}
      <time className="doc-card__date" dateTime={document.mission.starts_at}>
        <span className="doc-card__day">{day.format(starts)}</span>
        <span className="doc-card__month">{month.format(starts)}</span>
        <span className="doc-card__year">{year.format(starts)}</span>
        <span className="sr-only">{date.format(starts)}</span>
      </time>

      <div className="doc-card__main">
        <p className="doc-card__who">{counterpart(document, role)}</p>
        <h3 className="doc-card__title">
          <Link to={to}>{document.mission.title}</Link>
        </h3>
        <DocumentSteps document={document} role={role} />
      </div>

      <div className="doc-card__side">
        <span className={`doc-card__status is-${document.status}`}>
          {documentStatus(document.status, role)}
        </span>
        {action ? (
          <Link className="button doc-card__cta" to={to}>
            Valider le document
            <span className="sr-only"> « {document.mission.title} »</span>
          </Link>
        ) : (
          <Link className="doc-card__link" to={to}>
            Voir le document
            <span className="sr-only"> « {document.mission.title} »</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}
