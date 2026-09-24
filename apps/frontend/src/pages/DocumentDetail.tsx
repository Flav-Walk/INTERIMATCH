import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  FileClock,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  canSignDocument,
  documentStatus,
  downloadDocument,
  getDocument,
  signDocument,
  type ContractDetail,
} from "../services/documents";
import { DocumentStatusMark } from "../components/ui/Status";
import { errorMessage } from "../services/session";

const when = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

const payUnits: Record<string, string> = {
  hour: "de l’heure",
  day: "par jour",
  mission: "pour la mission",
};

export function DocumentDetailPage({ role }: { role: "worker" | "company" }) {
  const { id = "" } = useParams();
  const auth = useAuth();
  const [document, setDocument] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  usePageSeo({
    title: "Document de mission · InteriMatch",
    description: "Consultation et validation d’un document de mission.",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getDocument(id)
      .then((value) => {
        if (live) setDocument(value);
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
  }, [id]);

  async function sign() {
    if (!accepted) return;
    setBusy(true);
    setError("");
    try {
      setDocument(await signDocument(id));
      setAccepted(false);
      auth.invalidate();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadDocument(id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const back = role === "worker" ? "/worker/documents" : "/company/documents";
  if (loading)
    return (
      <p className="quiet page-wide" role="status">
        Chargement du document…
      </p>
    );
  if (!document)
    return (
      <section className="page-wide document-detail">
        <Link className="back-link" to={back}>
          <ArrowLeft size={16} aria-hidden="true" /> Retour aux documents
        </Link>
        <p className="form-error" role="alert">
          {error || "Document introuvable."}
        </p>
      </section>
    );

  const snapshot = document.snapshot;
  const company =
    snapshot.company.establishment_name ??
    snapshot.company.legal_name ??
    "Établissement";
  const worker = `${snapshot.worker.first_name} ${snapshot.worker.last_name}`.trim();
  const canSign = canSignDocument(document.status, role);

  return (
    <section className="page-wide document-detail">
      <Link className="back-link" to={back}>
        <ArrowLeft size={16} aria-hidden="true" /> Retour aux documents
      </Link>

      <header className="document-detail__head">
        <div>
          <span className="eyeline">Document de mission · version {document.document_version}</span>
          <h1>{snapshot.mission.title}</h1>
          <p className="quiet">
            {company} · {worker}
          </p>
        </div>
        <span className={`document-status is-${document.status}`}>
          <DocumentStatusMark
            status={document.status}
            label={documentStatus(document.status, role)}
          />
        </span>
      </header>

      <div className="document-detail__layout">
        <article className="document-sheet">
          <div className="document-sheet__title">
            <FileText size={22} aria-hidden="true" />
            <div>
              <h2>Informations figées à l’acceptation</h2>
              <p>Document n° {document.id}</p>
            </div>
          </div>

          <section>
            <h3>Mission</h3>
            <dl className="document-facts">
              <div>
                <dt>Début</dt>
                <dd>{when.format(new Date(snapshot.mission.starts_at))}</dd>
              </div>
              <div>
                <dt>Fin</dt>
                <dd>{when.format(new Date(snapshot.mission.ends_at))}</dd>
              </div>
              <div>
                <dt>Lieu</dt>
                <dd>
                  <MapPin size={14} aria-hidden="true" />
                  {[snapshot.mission.address, snapshot.mission.postal_code, snapshot.mission.city]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>Rémunération déclarée</dt>
                <dd>
                  {snapshot.mission.pay_amount === null
                    ? "Non renseignée"
                    : `${snapshot.mission.pay_amount} € ${payUnits[snapshot.mission.pay_unit ?? ""] ?? ""}`}
                </dd>
              </div>
            </dl>
            {snapshot.mission.description && <p>{snapshot.mission.description}</p>}
          </section>

          <div className="document-parties">
            <section>
              <h3>Entreprise</h3>
              <strong>{company}</strong>
              <p>
                {[snapshot.company.address, snapshot.company.postal_code, snapshot.company.city]
                  .filter(Boolean)
                  .join(", ") || "Adresse non renseignée"}
              </p>
            </section>
            <section>
              <h3>Intérimaire</h3>
              <strong>{worker}</strong>
              <p>
                {[snapshot.worker.postal_code, snapshot.worker.city]
                  .filter(Boolean)
                  .join(" ") || "Localité non renseignée"}
              </p>
            </section>
          </div>

          <p className="document-legal-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            {snapshot.legal_notice}
          </p>
        </article>

        <aside className="document-actions" aria-label="Validation du document">
          <h2>Suivi des validations</h2>
          <ol className="document-timeline">
            <li className={document.worker_signed_at ? "is-done" : "is-current"}>
              {document.worker_signed_at ? <CheckCircle2 /> : <FileClock />}
              <span>
                <strong>Intérimaire</strong>
                {document.worker_signed_at
                  ? when.format(new Date(document.worker_signed_at))
                  : "Validation attendue"}
              </span>
            </li>
            <li
              className={
                document.company_signed_at
                  ? "is-done"
                  : document.worker_signed_at
                    ? "is-current"
                    : ""
              }
            >
              {document.company_signed_at ? <CheckCircle2 /> : <FileClock />}
              <span>
                <strong>Entreprise</strong>
                {document.company_signed_at
                  ? when.format(new Date(document.company_signed_at))
                  : "Validation attendue"}
              </span>
            </li>
          </ol>

          {canSign && (
            <div className="document-sign">
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  J’ai lu ce document et je confirme cette validation interne de
                  démonstration.
                </span>
              </label>
              <button
                className="button"
                type="button"
                disabled={!accepted || busy}
                onClick={() => void sign()}
              >
                {busy ? "Validation…" : "Valider le document"}
              </button>
            </div>
          )}

          {document.download_available && (
            <button
              className="secondary-button document-download"
              type="button"
              disabled={busy}
              onClick={() => void download()}
            >
              <Download size={17} aria-hidden="true" />
              Télécharger le PDF
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="document-generated">
            <CalendarDays size={14} aria-hidden="true" />
            Généré le {when.format(new Date(snapshot.generated_at))}
          </p>
        </aside>
      </div>
    </section>
  );
}

