import { useEffect, useState } from "react";
import { Users, MapPin, Sliders } from "lucide-react";
import { api, errorMessage, type ReferenceValue } from "../services/session";

/**
 * Espace de suivi des candidats. Les profils viendront du moteur de matching ;
 * cet écran présente déjà les règles de sélection décidées (D04) et le vocabulaire
 * de suivi servi par le backend, sans inventer de score ni de candidat.
 */
export function Candidates() {
  const [statuses, setStatuses] = useState<ReferenceValue[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void api<{ application_statuses: ReferenceValue[] }>("/reference")
      .then((r) => setStatuses(r.application_statuses))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <section className="page">
      <span className="eyeline">Espace entreprise</span>
      <h1>Candidats compatibles</h1>
      <p>
        Les profils seront classés par score de compatibilité, chaque score
        étant expliqué critère par critère.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="empty">
        <Users aria-hidden="true" />
        <h2>Aucun candidat à afficher</h2>
        <p>
          Les candidats apparaîtront dès qu’une mission existera et que le
          moteur de matching sera disponible. Aucun profil de démonstration
          n’est affiché ici.
        </p>
      </div>

      <div className="card-grid">
        <section className="side-panel">
          <MapPin aria-hidden="true" />
          <h2>La localisation compte, sans exclure</h2>
          <p>
            La distance pèse dans le score, mais un profil hors de votre zone
            reste consultable : un filtre permettra de l’afficher
            volontairement.
          </p>
        </section>
        <section className="side-panel">
          <Sliders aria-hidden="true" />
          <h2>Recherche progressive</h2>
          <p>
            La sélection commence à 70 % de compatibilité. Si aucun profil
            pertinent n’atteint ce palier, la recherche descend à 60–69 %, puis
            à 50–59 %. En dessous, aucune proposition automatique.
          </p>
        </section>
      </div>

      <section className="section">
        <h2>Suivi des candidatures</h2>
        <p className="quiet">
          Les statuts de suivi sont définis côté serveur et pourront évoluer
          sans modifier l’interface.
        </p>
        <div className="skill-options">
          {statuses.map((s) => (
            <span className="badge" key={s.value}>
              {s.label}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}
