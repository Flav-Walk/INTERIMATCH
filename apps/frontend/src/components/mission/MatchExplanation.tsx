import { Check, Info, X } from "lucide-react";
import type {
  BlockerCode,
  DimensionTone,
  MatchDimension,
  MatchResult,
} from "../../services/missions";

/**
 * Pourquoi ce rapprochement — écrit pour celui qui le lit.
 *
 * Deux lecteurs, deux points de vue, une seule règle. L'intérimaire lit sa
 * propre situation (« vous n'êtes pas disponible »), l'entreprise lit celle
 * d'un candidat (« cette personne n'est pas disponible »). Les mots diffèrent
 * donc, mais ce qu'ils qualifient — point fort, point limitant — vient du
 * serveur et de lui seul : `tone` est calculé par le moteur, jamais ici.
 *
 * C'est ce qui empêche l'explication de contredire le score qu'elle commente.
 * Une interface qui déciderait elle-même qu'un ratio de 0,5 « est positif »
 * finirait, au premier ajustement des pondérations, par féliciter un candidat
 * que le moteur pénalise.
 *
 * Aucun pourcentage par dimension dans ces phrases, aucun nom de critère
 * technique : une explication se lit, elle ne se déchiffre pas.
 */

export type ExplanationAudience = "worker" | "company";

const blockerText: Record<ExplanationAudience, Record<BlockerCode, string>> = {
  worker: {
    paused:
      "Votre recherche est en pause. Réactivez-la depuis votre profil pour recevoir des missions.",
    missing_required_skills:
      "Il vous manque une compétence exigée pour cette mission.",
    unavailable:
      "Vous n’êtes pas disponible sur toute la durée de cette mission.",
    out_of_range: "Cette mission est au-delà de votre rayon de déplacement.",
    engaged:
      "Vous avez déjà accepté une mission sur ce créneau. Vos disponibilités restent inchangées.",
  },
  company: {
    paused: "Cette personne a mis sa recherche de missions en pause.",
    missing_required_skills:
      "Il lui manque une compétence que vous avez rendue obligatoire.",
    unavailable:
      "Elle n’est pas disponible sur toute la durée de cette mission.",
    out_of_range:
      "Le lieu de la mission dépasse le rayon de déplacement qu’elle a déclaré.",
    engaged: "Elle a déjà accepté une autre mission sur ce créneau.",
  },
};

/** Formulation d'une dimension, du point de vue de celui qui la lit. */
function dimensionText(
  audience: ExplanationAudience,
  key: MatchDimension["key"],
  ratio: number,
  distance: number | null,
): string | null {
  const worker = audience === "worker";
  switch (key) {
    case "job":
      return ratio === 1
        ? worker
          ? "C’est votre métier principal."
          : "Le poste correspond à son métier principal."
        : ratio > 0
          ? worker
            ? "C’est l’un de vos métiers secondaires."
            : "Le poste fait partie de ses métiers secondaires."
          : worker
            ? "Ce métier n’est pas dans votre profil."
            : "Ce métier ne figure pas dans son profil.";
    case "desired_skills":
      return ratio === 1
        ? worker
          ? "Vous avez toutes les compétences appréciées pour ce poste."
          : "Elle possède toutes les compétences appréciées pour ce poste."
        : ratio > 0
          ? worker
            ? "Vous avez une partie des compétences appréciées pour ce poste."
            : "Elle possède une partie des compétences appréciées pour ce poste."
          : worker
            ? "Vous n’avez aucune des compétences appréciées pour ce poste."
            : "Elle n’a aucune des compétences appréciées pour ce poste.";
    case "proximity":
      // Sans distance calculée, aucune phrase : inventer « proche » ou
      // « éloigné » affirmerait une géographie que le serveur n'a pas établie.
      return distance === null
        ? null
        : distance <= 1
          ? worker
            ? "La mission est à moins d’un kilomètre de chez vous."
            : "Elle se trouve à moins d’un kilomètre du lieu de mission."
          : worker
            ? `La mission est à environ ${distance} km de chez vous.`
            : `Elle se trouve à environ ${distance} km du lieu de mission.`;
    case "experience":
      return ratio === 1
        ? worker
          ? "Vous avez l’expérience demandée."
          : "Son expérience atteint ce que vous demandez."
        : worker
          ? "L’expérience demandée est supérieure à celle de votre profil."
          : "Son expérience reste en deçà de ce que vous demandez.";
  }
}

export interface ExplanationLine {
  key: MatchDimension["key"];
  tone: DimensionTone;
  text: string;
}

/**
 * Les raisons d'un score, ordonnées par ce qu'elles pèsent réellement.
 *
 * Les points forts d'abord, du plus rapporteur au moins rapporteur ; les points
 * limitants ensuite, du plus coûteux au moins coûteux. `points` et `lost`
 * viennent du serveur : l'ordre est donc celui de l'impact réel sur le score,
 * pas celui, arbitraire, dans lequel les dimensions ont été calculées.
 */
export function matchExplanationLines(
  match: Pick<MatchResult, "dimensions" | "distance_km">,
  audience: ExplanationAudience,
): ExplanationLine[] {
  const rank: Record<DimensionTone, number> = {
    strength: 0,
    neutral: 1,
    limitation: 2,
  };
  return (match.dimensions ?? [])
    .map((d) => ({
      key: d.key,
      tone: d.tone,
      points: d.points,
      lost: d.lost,
      text: dimensionText(audience, d.key, d.ratio, match.distance_km),
    }))
    .filter(
      (line): line is typeof line & { text: string } => line.text !== null,
    )
    .sort(
      (a, b) =>
        rank[a.tone] - rank[b.tone] ||
        (a.tone === "limitation" ? b.lost - a.lost : b.points - a.points),
    )
    .map(({ key, tone, text }) => ({ key, tone, text }));
}

/** Les motifs qui rendent le rapprochement impossible, dits au bon lecteur. */
export function matchBlockerLines(
  match: Pick<MatchResult, "blockers">,
  audience: ExplanationAudience,
): { code: BlockerCode; text: string }[] {
  return (match.blockers ?? []).map((code) => ({
    code,
    text: blockerText[audience][code],
  }));
}

/** Marqueur visuel d'une ligne : coche, point, triangle. */
export function ExplanationIcon({ tone }: { tone: DimensionTone }) {
  if (tone === "strength") return <Check size={15} aria-hidden="true" />;
  return <span className="match-dot" aria-hidden="true" />;
}

export function MatchExplanation({ match }: { match: MatchResult }) {
  const lines = matchExplanationLines(match, "worker");
  const blocked = matchBlockerLines(match, "worker");

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
          {blocked.map((line) => (
            <li className="is-blocked" key={line.code}>
              <X size={15} aria-hidden="true" />
              {line.text}
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <ul className="match-list" aria-label="Détail du rapprochement">
          {lines.map((line) => (
            <li
              className={line.tone === "strength" ? "is-good" : ""}
              key={line.key}
            >
              <ExplanationIcon tone={line.tone} />
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
