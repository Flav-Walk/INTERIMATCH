import type { CSSProperties } from "react";
import { ScoreGauge } from "./da/ScoreGauge";

interface CircularGaugeProps {
  value: number;
  label: string;
  subtitle?: string;
  size?: number;
  variant?: "forest" | "on-dark";
}

/**
 * Jauge de complétion du profil (bandeau du tableau de bord et du profil).
 *
 * Avant : l'anneau « Animated Circular Progress Bar » de Magic UI. Son arc
 * dépendait de variables CSS calculées et d'un requestAnimationFrame pour
 * démarrer à 0 : selon le navigateur, il restait vide ou s'affichait mal.
 *
 * Maintenant : la jauge en fer à cheval Gauge Chart d'Animata (via
 * da/ScoreGauge), calculée en nombres dans le SVG. Elle se remplit toute
 * seule 250 ms après l'affichage, et le chiffre est écrit au centre.
 * Le lecteur d'écran lit la phrase complète (aria-label).
 */
export function CircularGauge({
  value,
  label,
  subtitle,
  size = 78,
  variant = "forest",
}: CircularGaugeProps) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      className={`completion-gauge completion-gauge--${variant}`}
      role="img"
      aria-label={`${label} : ${percentage} %${subtitle ? `. ${subtitle}` : ""}`}
      // Je passe la taille en variable CSS, reprise dans motion.css.
      style={{ "--gauge-size": `${size}px` } as CSSProperties}
    >
      <ScoreGauge
        value={percentage}
        size={size}
        tone={variant === "on-dark" ? "on-dark" : "forest"}
      />
      <span className="completion-gauge__copy">
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
