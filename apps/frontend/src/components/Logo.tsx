// Logo ALP'EMPLOI : repère (sommet + soleil) et mot-symbole en minuscules.
//
// Le repère a deux versions, selon la taille :
//   - "flat"  : aplat d'une couleur, pour moins de 48 px (en-tête, pied de page)
//   - "rich"  : sommet en duotone avec un reflet, en attendant la photo
// Le mot-symbole souligne l'apostrophe d'un surligneur en or. Voir CLAUDE.md,
// section « Logo ». SVG inline : aucune image externe (RGESN).

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  variant?: "flat" | "rich";
}

// Sommet aux angles adoucis, en coordonnées d'une boîte 40 × 40.
const PEAK =
  "M20 1 C22.4 1 24 4 26.4 8.8 L38.8 34.4 C40 37.2 38.8 40 36 40 L4 40 " +
  "C1.2 40 0 37.2 1.2 34.4 L13.6 8.8 C16 4 17.6 1 20 1 Z";

export function LogoMark({ size = 32, variant = "flat" }: LogoMarkProps) {
  const id = useId();
  return (
    <svg
      className="logo__mark"
      width={size * 1.2}
      height={size}
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {variant === "rich" && (
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="oklch(0.42 0.05 178)" />
            <stop offset="0.55" stopColor="oklch(0.287 0.034 180)" />
            <stop offset="1" stopColor="oklch(0.162 0.024 175)" />
          </linearGradient>
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.3" stopColor="oklch(0.9 0 90)" stopOpacity="0" />
            <stop offset="0.48" stopColor="oklch(0.9 0 90)" stopOpacity="0.55" />
            <stop offset="0.66" stopColor="oklch(0.9 0 90)" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <path
        d={PEAK}
        fill={variant === "rich" ? `url(#${id}-fill)` : "currentColor"}
      />
      {variant === "rich" && <path d={PEAK} fill={`url(#${id}-beam)`} />}
      <circle cx="41" cy="6.5" r="5.5" fill="var(--accent)" />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  variant?: "flat" | "rich";
  /** Masque le mot-symbole (favicon, très petits espaces) */
  markOnly?: boolean;
}

export function Logo({ size = 32, variant = "flat", markOnly = false }: LogoProps) {
  return (
    <span className="logo">
      <LogoMark size={size} variant={variant} />
      {!markOnly && (
        <span className="logo__word">
          alp<span className="logo__apos">'</span>emploi
        </span>
      )}
    </span>
  );
}
