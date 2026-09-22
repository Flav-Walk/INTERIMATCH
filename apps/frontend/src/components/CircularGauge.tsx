import { useEffect, useState, type CSSProperties } from "react";
import { AnimatedCircularProgressBar } from "./ui/animated-circular-progress-bar";

interface CircularGaugeProps {
  value: number;
  label: string;
  subtitle?: string;
  size?: number;
  variant?: "forest" | "on-dark";
}

/** Couleurs de l'anneau pour chaque fond : la valeur, puis le reste du tour. */
const GAUGE_COLORS = {
  forest: {
    primary: "var(--forest)",
    secondary: "oklch(0.32 0.065 165 / 0.14)",
  },
  "on-dark": {
    primary: "oklch(0.75 0.12 158)",
    secondary: "oklch(1 0 0 / 0.18)",
  },
} as const;

/**
 * Indicateur purement visuel : sa valeur vient toujours de la donnée appelante.
 *
 * L'anneau est l'« Animated Circular Progress Bar » de Magic UI. Il s'anime
 * quand sa valeur change : on lui donne donc 0 au premier affichage, puis la
 * vraie valeur à l'image suivante, pour qu'il se remplisse sous les yeux.
 * L'étiquette accessible, elle, annonce directement la valeur finale.
 */
export function CircularGauge({
  value,
  label,
  subtitle,
  size = 78,
  variant = "forest",
}: CircularGaugeProps) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percentage));
    return () => cancelAnimationFrame(frame);
  }, [percentage]);

  const colors = GAUGE_COLORS[variant];

  return (
    <div
      className={`completion-gauge completion-gauge--${variant}`}
      role="img"
      aria-label={`${label} : ${percentage} %${subtitle ? `. ${subtitle}` : ""}`}
      style={{ "--gauge-size": `${size}px` } as CSSProperties}
    >
      <AnimatedCircularProgressBar
        className="completion-gauge__magic"
        value={shown}
        gaugePrimaryColor={colors.primary}
        gaugeSecondaryColor={colors.secondary}
      />
      <span className="completion-gauge__copy">
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
