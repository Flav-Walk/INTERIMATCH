interface LogoProps {
  variant?: "light" | "dark" | "forest";
  className?: string;
}

/** Wordmark volontairement seul : aucun monogramme « M » redondant. */
export function Logo({ variant = "forest", className = "" }: LogoProps) {
  return (
    <span
      className={`brand-wordmark brand-wordmark--${variant} ${className}`.trim()}
    >
      InteriMatch
    </span>
  );
}
