import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { errorMessage, type ReferenceValue } from "../../services/session";
import { api } from "../../services/session";
import {
  listCandidates,
  type CandidateList as Candidates,
  type MatchingInactive,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";

/**
 * Pourquoi aucun profil n'est cherché.
 *
 * Le rapprochement suit la visibilité : une mission qu'aucun intérimaire ne
 * peut voir ne peut pas non plus lui proposer de candidats. Le dire évite la
 * lecture fausse d'un vivier vide — jusqu'ici, un brouillon affichait des
 * profils que personne n'aurait pu contacter.
 */
const inactiveText: Record<MatchingInactive, string> = {
  draft:
    "Le rapprochement commence à la publication. Tant que cette mission reste un brouillon, aucun intérimaire ne la voit — et aucun profil ne lui est rapproché.",
  ended:
    "Cette mission est terminée. Elle n’est plus proposée aux intérimaires, et le rapprochement ne s’y applique plus.",
  closed:
    "Cette mission n’est plus ouverte. Le rapprochement ne s’y applique plus.",
};

/**
 * Profils rapprochés d'une mission.
 *
 * Ce sont des **suggestions du système**, pas des candidatures : personne ne
 * s'est manifesté, et rien ne se décide ici. La distinction est dite à l'écran
 * pour qu'on ne confonde pas les deux listes.
 *
 * Le palier retenu est affiché tel quel : une entreprise doit savoir qu'elle
 * lit des profils « envisageables » faute de meilleurs, et non l'élite de son
 * bassin d'emploi.
 */
export function CandidateList({
  missionId,
  revision,
}: {
  missionId: string;
  revision: number;
}) {
  const [data, setData] = useState<Candidates | null>(null),
    [jobs, setJobs] = useState<ReferenceValue[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    void Promise.all([
      listCandidates(missionId),
      api<{ jobs: ReferenceValue[] }>("/reference"),
    ])
      .then(([result, reference]) => {
        if (!live) return;
        setData(result);
        setJobs(reference.jobs);
        setError("");
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [missionId, revision]);

  const jobLabel = (value: string | null) =>
    jobs.find((j) => j.value === value)?.label ?? value;

  return (
    <section className="rail-card">
      <div className="rail-head">
        <Users size={18} aria-hidden="true" />
        <h2>Profils compatibles</h2>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="quiet" role="status">
          Recherche des profils…
        </p>
      ) : data?.inactive ? (
        <p className="quiet">{inactiveText[data.inactive]}</p>
      ) : !data || data.candidates.length === 0 ? (
        <p className="quiet">
          Aucun profil ne correspond encore à cette mission. Les compétences
          exigées, le créneau et la zone de déplacement sont les trois critères
          qui écartent le plus de candidats.
        </p>
      ) : (
        <>
          <p className="quiet" role="status">
            {data.candidates.length} profil
            {data.candidates.length > 1 ? "s" : ""}
            {data.band !== null && data.band < 70
              ? ` · aucun profil au-delà de 70 %, élargi à ${data.band} %`
              : ""}
          </p>
          <ul className="candidate-list">
            {data.candidates.map((c) => (
              <li key={c.id}>
                <div className="candidate-head">
                  <strong>
                    {c.first_name} {c.last_initial}.
                  </strong>
                  <MatchBadge score={c.match.score} />
                </div>
                <p className="quiet">
                  {[
                    jobLabel(c.main_job),
                    c.city,
                    c.years_experience
                      ? `${c.years_experience} an${c.years_experience > 1 ? "s" : ""} d’expérience`
                      : null,
                    c.match.distance_km !== null
                      ? `${c.match.distance_km} km`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {c.matched_skills.length > 0 && (
                  <div className="skill-options">
                    {c.matched_skills.map((s) => (
                      <span className="badge" key={s.id}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="quiet">
            Ces profils sont suggérés par le rapprochement. Ils n’ont pas
            postulé.
          </p>
        </>
      )}
    </section>
  );
}
