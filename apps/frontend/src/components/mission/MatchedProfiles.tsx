import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiError } from "../../services/api";
import { errorMessage } from "../../services/session";
import {
  listMissionCandidates,
  type CandidateSelection,
  type CandidateSelectionInactive,
  type MissionCandidate,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";
import {
  ExplanationIcon,
  matchBlockerLines,
  matchExplanationLines,
} from "./MatchExplanation";

const inactiveCopy: Record<CandidateSelectionInactive, string> = {
  draft:
    "Publiez cette mission pour lancer le rapprochement avec les profils disponibles.",
  ended:
    "Cette mission est terminée : le rapprochement de profils n’est plus actif.",
  closed:
    "Tous les postes sont pourvus : le rapprochement de profils est maintenant fermé.",
  // Une offre retirée n'a rien pourvu : la ranger sous « complet » serait faux.
  cancelled:
    "Cette mission est annulée : le rapprochement de profils est arrêté.",
  full: "Tous les postes sont pourvus : le rapprochement de nouveaux profils est suspendu.",
};

const readableJob = (job: string) =>
  job
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("fr"));

const candidateName = (candidate: MissionCandidate) =>
  `${candidate.first_name} ${candidate.last_initial}${candidate.last_initial.endsWith(".") ? "" : "."}`;

/**
 * Ce que le palier retenu veut dire, en une phrase.
 *
 * POURQUOI PLUS AUCUN INTERVALLE FERMÉ. La phrase disait « entre 60 % et
 * 69 % », et la pastille juste à côté pouvait afficher « Compatible à 70 % » :
 * un profil à 69,6 % s'arrondit à 70 tout en restant au palier 60. Les deux
 * textes étaient exacts séparément et se contredisaient ensemble.
 *
 * Seule la borne HAUTE posait problème. Un arrondi ne peut jamais faire
 * descendre un score sous le plancher de son palier — si le score réel atteint
 * 60, l'arrondi vaut 60 ou plus — mais il peut lui faire franchir le plafond.
 * La borne basse reste donc vraie de tous les profils listés, et c'est elle
 * qu'on garde ; le plafond disparaît.
 *
 * Le nom du palier vient de `band_label`, servi par le serveur. Le frontend ne
 * redéduit rien : ni le palier, ni son intitulé.
 */
export function selectionSummary(selection: CandidateSelection) {
  const count = selection.candidates.length;
  const profiles = count > 1 ? "profils" : "profil";

  if (selection.band === null || selection.band_label === null)
    return `${count} ${profiles} ${count > 1 ? "retenus" : "retenu"} au palier décidé par le moteur.`;

  // Une seule borne, et c'est la basse. Elle est vraie de tous les profils
  // listés, y compris de celui dont l'arrondi dépasse le plafond du palier.
  //
  // L'espace insécable est nommé plutôt qu'écrit : la typographie française
  // l'exige avant « % » et à l'intérieur des guillemets, mais un caractère
  // invisible, indistinguable d'une espace ordinaire, n'a rien à faire en
  // clair dans du code — ESLint le refuse d'ailleurs, à juste titre.
  const nb = "\u00a0";
  const palier = selection.band_label.toLocaleLowerCase("fr");
  const principal = `${count} ${profiles} au palier «${nb}${palier}${nb}» (au moins ${selection.band}${nb}% de correspondance).`;
  if (selection.band === 70) return principal;

  // Le repli est dit sans nommer de seuil : « aucun profil n'atteint 70 % »
  // serait démenti à l'écran par une pastille « Compatible à 70 % », alors que
  // les deux affirmations portent sur des grandeurs différentes — le score
  // réel pour l'une, son arrondi pour l'autre.
  return `Aucun profil n’atteint le palier supérieur. ${principal}`;
}

/**
 * Pourquoi ce profil obtient ce score.
 *
 * Remplace le relévé de ratios qui tenait lieu d'explication : « Proximité
 * 40 % » est un chiffre, pas une raison, et il demandait au lecteur de refaire
 * lui-même le raisonnement du moteur. Les lignes affichées ici viennent toutes
 * du calcul réel — la qualification en point fort ou point limitant est celle
 * que le serveur a posée, l'interface ne fait que la formuler.
 */
function CandidateExplanation({
  candidate,
  outsideZone,
}: {
  candidate: MissionCandidate;
  outsideZone: boolean;
}) {
  const lines = matchExplanationLines(candidate.match, "company");
  const strengths = lines.filter((line) => line.tone === "strength");
  const limitations = lines.filter((line) => line.tone === "limitation");
  const others = lines.filter((line) => line.tone === "neutral");
  const blocked = matchBlockerLines(candidate.match, "company");

  return (
    <details className="match-breakdown">
      <summary>Comprendre ce score</summary>

      {/* Hors zone, les critères obligatoires ne sont PAS tous validés : le
          dire quand même serait une explication mensongère. */}
      {blocked.length > 0 ? (
        <ul className="match-list" aria-label="Ce qui ne correspond pas">
          {blocked.map((line) => (
            <li className="is-blocked" key={line.code}>
              {line.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet">
          Tous les critères que vous avez rendus obligatoires sont satisfaits.
        </p>
      )}

      {strengths.length > 0 && (
        <>
          <h4>Points positifs</h4>
          <ul className="match-list" aria-label="Points positifs">
            {strengths.map((line) => (
              <li className="is-good" key={line.key}>
                <ExplanationIcon tone={line.tone} />
                {line.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {limitations.length > 0 && (
        <>
          <h4>
            {limitations.length > 1 ? "Points limitants" : "Point limitant"}
          </h4>
          <ul className="match-list" aria-label="Points limitants">
            {limitations.map((line) => (
              <li key={line.key}>
                <ExplanationIcon tone={line.tone} />
                {line.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <ul className="match-list" aria-label="Autres critères">
          {others.map((line) => (
            <li key={line.key}>
              <ExplanationIcon tone={line.tone} />
              {line.text}
            </li>
          ))}
        </ul>
      )}

      {candidate.match.distance_km === null && !outsideZone && (
        <p className="quiet">
          La distance n’a pas pu être calculée : elle n’entre pas dans ce
          rapprochement.
        </p>
      )}
    </details>
  );
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
                <span>{readableJob(candidate.main_job)}</span>
              )}
              {candidate.city && <span>{candidate.city}</span>}
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
            <MatchBadge
              score={candidate.match.score}
              band={candidate.match.band}
              bandLabel={candidate.match.band_label}
              size="large"
            />
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

        <CandidateExplanation candidate={candidate} outsideZone={outsideZone} />
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
