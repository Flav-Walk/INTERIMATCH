import { Check, Info, X } from "lucide-react";
import type { BlockerCode, MatchResult } from "../../services/missions";

/**
 * Pourquoi cette mission convient — ou ne convient pas.
 *
 * Écrit pour un intérimaire, pas pour un développeur : aucun nom de critère,
 * aucun pourcentage par dimension, aucun code. Chaque ligne dit une chose
 * vérifiable, et l'ordre va du plus décisif au plus accessoire.
 */

const blockerText: Record<BlockerCode, string> = {
  paused:
    "Votre recherche est en pause. Réactivez-la depuis votre profil pour recevoir des missions.",
  missing_required_skills:
    "Il vous manque une compétence exigée pour cette mission.",
  unavailable:
    "Vous n’êtes pas disponible sur toute la durée de cette mission.",
  out_of_range: "Cette mission est au-delà de votre rayon de déplacement.",
  engaged:
    "Vous avez déjà accepté une mission sur ce créneau. Vos disponibilités restent inchangées.",
};

/** Formulation d'une dimension, du point de vue de celui qui la lit. */
function dimensionText(
  key: MatchResult["dimensions"][number]["key"],
  ratio: number,
  distance: number | null,
): string | null {
  switch (key) {
    case "job":
      return ratio === 1
        ? "C’est votre métier principal."
        : ratio > 0
          ? "C’est l’un de vos métiers secondaires."
          : "Ce métier n’est pas dans votre profil.";
    case "desired_skills":
      return ratio === 1
        ? "Vous avez toutes les compétences appréciées pour ce poste."
        : ratio > 0
          ? "Vous avez une partie des compétences appréciées pour ce poste."
          : "Vous n’avez aucune des compétences appréciées pour ce poste.";
    case "proximity":
      return distance === null
        ? null
        : distance <= 1
          ? "La mission est à moins d’un kilomètre de chez vous."
          : `La mission est à environ ${distance} km de chez vous.`;
    case "experience":
      return ratio === 1
        ? "Vous avez l’expérience demandée."
        : "L’expérience demandée est supérieure à celle de votre profil.";
  }
}

export function MatchExplanation({ match }: { match: MatchResult }) {
  const lines = match.dimensions
    .map((d) => ({
      key: d.key,
      positive: d.ratio >= 0.5,
      text: dimensionText(d.key, d.ratio, match.distance_km),
    }))
    .filter(
      (line): line is typeof line & { text: string } => line.text !== null,
    );

  return (
    <section className="rail-card match-card">
      {/* Le score est déjà affiché près du titre de la mission : cette carte
          porte les raisons, pas la note. */}
      <div className="rail-head">
        <Info size={18} aria-hidden="true" />
        <h2>Pourquoi cette mission</h2>
      </div>

      {!match.compatible && (
        <ul className="match-list" aria-label="Ce qui ne correspond pas">
          {match.blockers.map((code) => (
            <li className="is-blocked" key={code}>
              <X size={15} aria-hidden="true" />
              {blockerText[code]}
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <ul className="match-list" aria-label="Détail du rapprochement">
          {lines.map((line) => (
            <li className={line.positive ? "is-good" : ""} key={line.key}>
              {line.positive ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <span className="match-dot" aria-hidden="true" />
              )}
              {line.text}
            </li>
          ))}
        </ul>
      )}

      {match.distance_km === null && (
        <p className="quiet">
          La distance n’a pas pu être calculée : elle n’entre pas dans ce
          rapprochement.
        </p>
      )}
    </section>
  );
}
