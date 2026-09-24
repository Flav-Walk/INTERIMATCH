import GaugeChart from "../ui/gauge-chart";
import { cn } from "../../lib/utils";

/*
 * Jauge de score, partout où un pourcentage s'affiche en cercle :
 * compatibilité d'une mission (MatchBadge) et prérequis du profil dans le
 * bandeau (CircularGauge).
 *
 * Composant utilisé : Gauge Chart d'Animata (components/ui/gauge-chart.tsx).
 * Il remplace l'Animated Circular Progress Bar de Magic UI, dont l'arc
 * dépendait de variables CSS calculées (calc, transform-origin en px) : en
 * petit format, l'arc se dessinait mal ou pas du tout, et le chiffre était
 * masqué. Ici :
 * - fer à cheval ouvert en bas (gap) : on lit tout de suite « presque plein »
 *   ou « à moitié » ;
 * - le chiffre est TOUJOURS écrit au centre, en Fraunces ;
 * - la couleur suit le ton donné (palier du serveur pour la compatibilité).
 *
 * Décorative (aria-hidden) : le texte à côté porte l'information.
 */

type Tone = "forest" | "mid" | "muted" | "on-dark";

// Couleur de l'arc et de la piste pour chaque ton (Tailwind text-*, l'arc
// utilise currentColor).
const TONES: Record<Tone, { arc: string; track: string; value: string }> = {
  forest: { arc: "text-forest", track: "text-forest/12", value: "text-forest" },
  mid: { arc: "text-forest-mid", track: "text-forest/12", value: "text-forest-mid" },
  muted: { arc: "text-muted-foreground", track: "text-forest/10", value: "text-muted-foreground" },
  "on-dark": { arc: "text-[oklch(0.8_0.12_158)]", track: "text-white/15", value: "text-white" },
};

export function ScoreGauge({
  value,
  size = 44,
  tone = "forest",
  className,
}: {
  value: number;
  size?: number;
  tone?: Tone;
  className?: string;
}) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const colors = TONES[tone];
  // Épaisseur proportionnelle à la taille : ~11 % du diamètre.
  const stroke = Math.max(3, Math.round(size * 0.11));
  return (
    <span className={cn("inline-flex shrink-0", className)} aria-hidden="true">
      <GaugeChart
        size={size}
        progress={score}
        // Ouverture en bas : ~22 % du périmètre, comme un compteur.
        gap={Math.round(Math.PI * size * 0.22)}
        circleWidth={stroke}
        progressWidth={stroke}
        trackClassName={colors.track}
        progressClassName={colors.arc}
      >
        {/* Le chiffre est écrit par le CSS (::after + attr(data-value)) et
            non en texte : il n'entre pas dans le textContent du badge, que
            les tests e2e comparent mot pour mot (« Compatible à 92 % … »). */}
        <span
          data-value={score}
          className={cn(
            "absolute inset-0 flex items-center justify-center font-brand leading-none font-semibold tabular-nums after:content-[attr(data-value)]",
            colors.value,
          )}
          style={{ fontSize: Math.round(size * (score === 100 ? 0.24 : 0.3)) }}
        />
      </GaugeChart>
    </span>
  );
}
