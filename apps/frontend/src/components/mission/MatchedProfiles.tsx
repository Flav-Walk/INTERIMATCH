import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ApiError } from "../../services/api";
import { errorMessage } from "../../services/session";
import {
  listMissionCandidates,
  type CandidateSelection,
  type CandidateSelectionInactive,
  type MissionCandidate,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";

const inactiveCopy: Record<CandidateSelectionInactive, string> = {
  draft:
    "Publiez cette mission pour lancer le rapprochement avec les profils disponibles.",
  ended:
    "Cette mission est terminée : le rapprochement de profils n’est plus actif.",
  closed:
    "Tous les postes sont pourvus : le rapprochement de profils est maintenant fermé.",
  full: "Tous les postes sont pourvus : le rapprochement de nouveaux profils est suspendu.",
};

const readableJob = (job: string) =>
  job
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("fr"));

const candidateName = (candidate: MissionCandidate) =>
  `${candidate.first_name} ${candidate.last_initial}${candidate.last_initial.endsWith(".") ? "" : "."}`;

export function selectionSummary(selection: CandidateSelection) {
  const count = selection.candidates.length;
  const profiles = count > 1 ? "profils" : "profil";
  const match = count > 1 ? "correspondent" : "correspond";

  if (selection.band === 70)
    return `${count} ${profiles} ${match} à au moins 70 % à cette mission.`;
  if (selection.band === 60)
    return `Aucun profil n’atteint 70 %. ${count} ${profiles} ${match} entre 60 % et 69 %.`;
  if (selection.band === 50)
    return `Aucun profil n’atteint 60 %. ${count} ${profiles} ${match} entre 50 % et 59 %.`;
  return `${count} ${profiles} ${match} au palier retenu par le moteur.`;
}

function CandidateRow({
  candidate,
  outsideZone = false,
}: {
  candidate: MissionCandidate;
  outsideZone?: boolean;
}) {
  return (
    <li className="matched-profile">
      <article aria-labelledby={`candidate-${candidate.id}`}>
        <div className="matched-profile-head">
          <div>
            <h3 id={`candidate-${candidate.id}`}>{candidateName(candidate)}</h3>
            <div className="matched-profile-meta">
              {candidate.main_job && (
                <span>
                  <BriefcaseBusiness size={15} aria-hidden="true" />
                  {readableJob(candidate.main_job)}
                </span>
              )}
              {candidate.city && (
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  {candidate.city}
                </span>
              )}
              {candidate.years_experience !== null && (
                <span>
                  {candidate.years_experience} an
                  {candidate.years_experience > 1 ? "s" : ""} d’expérience
                </span>
              )}
            </div>
          </div>
          {outsideZone ? (
            <span className="match-badge is-low is-large">
              Score {candidate.match.score}&nbsp;% · hors zone
            </span>
          ) : (
            <MatchBadge score={candidate.match.score} size="large" />
          )}
        </div>

        {candidate.matched_skills.length > 0 && (
          <div
            className="matched-profile-skills"
            aria-label="Compétences correspondantes"
          >
            {candidate.matched_skills.map((skill) => (
              <span className="badge" key={skill.id}>
                {skill.name}
                {skill.required && (
                  <span className="sr-only">, obligatoire</span>
                )}
              </span>
            ))}
          </div>
        )}

        <details className="match-breakdown">
          <summary>Comprendre ce score</summary>
          <p className="quiet">
            Le moteur a validé les critères obligatoires. Le score et son détail
            viennent directement du rapprochement serveur.
          </p>
          <ul>
            {candidate.match.dimensions.map((dimension) => (
              <li key={dimension.key}>
                <span>{dimension.label}</span>
                <strong>{Math.round(dimension.ratio * 100)} %</strong>
              </li>
            ))}
          </ul>
          {candidate.match.distance_km !== null && (
            <p className="quiet">
              Distance estimée :{" "}
              {candidate.match.distance_km.toLocaleString("fr-FR")} km.
            </p>
          )}
        </details>
      </article>
    </li>
  );
}

export function MatchedProfilesView({
  selection,
  loading,
  error,
  inaccessible,
  showOutsideZone,
  onRetry,
  onToggleOutsideZone,
}: {
  selection: CandidateSelection | null;
  loading: boolean;
  error: string;
  inaccessible: boolean;
  showOutsideZone: boolean;
  onRetry: () => void;
  onToggleOutsideZone: () => void;
}) {
  return (
    <section
      className="rail-card matched-profiles"
      aria-labelledby="matched-profiles-title"
    >
      <div className="rail-head">
        <Sparkles size={18} aria-hidden="true" />
        <h2 id="matched-profiles-title">Profils correspondants</h2>
      </div>
      <p className="quiet matched-profiles-intro">
        Profils disponibles rapprochés des critères de cette mission. Une
        candidature reçue apparaît séparément plus bas.
      </p>

      {loading && (
        <div
          className="matched-profiles-loading"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">
            Chargement des profils correspondants…
          </span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
      )}

      {!loading && inaccessible && (
        <div className="matched-profiles-state">
          <p className="form-error" role="alert">
            Cette sélection de profils n’est pas accessible avec ce compte.
          </p>
        </div>
      )}

      {!loading && !inaccessible && error && (
        <div className="matched-profiles-state">
          <p className="form-error" role="alert">
            Impossible de charger les profils correspondants. {error}
          </p>
          <button type="button" className="secondary-button" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}

      {!loading && !inaccessible && !error && selection?.inactive && (
        <div className="matched-profiles-state">
          <p>{inactiveCopy[selection.inactive]}</p>
        </div>
      )}

      {!loading &&
        !inaccessible &&
        !error &&
        selection &&
        !selection.inactive &&
        !selection.candidates.length && (
          <div className="matched-profiles-state">
            <p>
              Aucun profil n’atteint actuellement le seuil de correspondance de
              50 %.
            </p>
            <p className="quiet">
              La liste évoluera lorsque des profils compatibles seront
              disponibles.
            </p>
          </div>
        )}

      {!loading &&
        !inaccessible &&
        !error &&
        selection &&
        selection.candidates.length > 0 && (
          <>
            <p className="matched-profiles-summary">
              <CheckCircle2 size={17} aria-hidden="true" />
              {selectionSummary(selection)}
            </p>
            <ol className="matched-profile-list">
              {selection.candidates.map((candidate) => (
                <CandidateRow candidate={candidate} key={candidate.id} />
              ))}
            </ol>
          </>
        )}

      {!loading &&
        !inaccessible &&
        !error &&
        selection &&
        !selection.inactive &&
        selection.outside_zone.length > 0 && (
          <div className="outside-zone-profiles">
            <button
              type="button"
              className="secondary-button"
              aria-expanded={showOutsideZone}
              aria-controls="outside-zone-list"
              onClick={onToggleOutsideZone}
            >
              {showOutsideZone ? "Masquer" : "Voir également"} les profils hors
              zone ({selection.outside_zone.length})
            </button>
            {showOutsideZone && (
              <div id="outside-zone-list">
                <h3>Profils hors zone</h3>
                <p className="quiet">
                  La distance est leur seul critère bloquant. Ils restent
                  séparés de la sélection principale.
                </p>
                <ol className="matched-profile-list">
                  {selection.outside_zone.map((candidate) => (
                    <CandidateRow
                      candidate={candidate}
                      outsideZone
                      key={candidate.id}
                    />
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
    </section>
  );
}

export function MatchedProfiles({
  missionId,
  revision,
}: {
  missionId: string;
  revision: number;
}) {
  const [selection, setSelection] = useState<CandidateSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inaccessible, setInaccessible] = useState(false);
  const [showOutsideZone, setShowOutsideZone] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setInaccessible(false);
    void listMissionCandidates(missionId)
      .then((result) => {
        if (live) setSelection(result);
      })
      .catch((cause) => {
        if (!live) return;
        if (
          cause instanceof ApiError &&
          (cause.status === 403 || cause.status === 404)
        )
          setInaccessible(true);
        else setError(errorMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [missionId, revision, retry]);

  return (
    <MatchedProfilesView
      selection={selection}
      loading={loading}
      error={error}
      inaccessible={inaccessible}
      showOutsideZone={showOutsideZone}
      onRetry={() => setRetry((value) => value + 1)}
      onToggleOutsideZone={() => setShowOutsideZone((value) => !value)}
    />
  );
}
