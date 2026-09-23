import { useEffect, useState, type CSSProperties } from "react";
import { AnimatedCircularProgressBar } from "./ui/animated-circular-progress-bar";

interface CircularGaugeProps {
  value: number;
  label: string;
  subtitle?: string;
  size?: number;
  variant?: "forest" | "on-dark";
}

// Couleurs de l'anneau selon le fond où la jauge est posée.
// primary = la partie remplie, secondary = le reste du cercle.
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
 * Jauge de complétion du profil.
 *
 * L'anneau vient de Magic UI (« Animated Circular Progress Bar »). Il ne
 * s'anime que quand sa valeur CHANGE. Mon astuce : je lui donne 0 au premier
 * affichage, puis la vraie valeur juste après. Résultat : l'anneau se remplit
 * sous les yeux de l'utilisateur au lieu d'apparaître déjà plein.
 * Le lecteur d'écran, lui, lit directement la vraie valeur (aria-label).
 */
export function CircularGauge({
  value,
  label,
  subtitle,
  size = 78,
  variant = "forest",
}: CircularGaugeProps) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));
  // Valeur réellement affichée par l'anneau : 0 au départ.
  const [shown, setShown] = useState(0);

  // requestAnimationFrame = « à la prochaine image ». Le navigateur dessine
  // d'abord l'anneau vide, puis on passe à la vraie valeur : ça déclenche
  // l'animation de remplissage.
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
      // Je passe la taille en variable CSS, reprise dans motion.css.
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
