interface CircularGaugeProps {
  value: number;
  label: string;
  subtitle?: string;
  size?: number;
  variant?: "forest" | "on-dark";
}

/** Indicateur purement visuel : sa valeur vient toujours de la donnée appelante. */
export function CircularGauge({
  value,
  label,
  subtitle,
  size = 78,
  variant = "forest",
}: CircularGaugeProps) {
  const percentage = Math.min(100, Math.max(0, Math.round(value)));
  const radius = 31;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  return (
    <div
      className={`completion-gauge completion-gauge--${variant}`}
      role="img"
      aria-label={`${label} : ${percentage} %${subtitle ? `. ${subtitle}` : ""}`}
    >
      <span
        className="completion-gauge__ring"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle
            className="completion-gauge__track"
            cx="36"
            cy="36"
            r={radius}
          />
          <circle
            className="completion-gauge__value"
            cx="36"
            cy="36"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <strong>{percentage}%</strong>
      </span>
      <span className="completion-gauge__copy">
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
