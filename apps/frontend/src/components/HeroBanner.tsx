import type { ReactNode } from "react";
import { MatchyMascot } from "./MatchyMascot";

interface HeroBannerProps {
  eyeline?: string;
  title: string;
  subtitle?: string;
  mascotPose?: "dashboard" | "missions" | "profile";
  action?: ReactNode;
  gauge?: ReactNode;
  compact?: boolean;
}

/** Habillage de page sans donnée métier ni navigation implicite. */
export function HeroBanner({
  eyeline,
  title,
  subtitle,
  mascotPose = "dashboard",
  action,
  gauge,
  compact = false,
}: HeroBannerProps) {
  return (
    <section className={`brand-hero${compact ? " brand-hero--compact" : ""}`}>
      <div className="brand-hero__decoration" aria-hidden="true" />
      <div className="brand-hero__copy">
        {eyeline && <span className="brand-hero__eyeline">{eyeline}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {action && <div className="brand-hero__action">{action}</div>}
      </div>
      {gauge && <div className="brand-hero__gauge">{gauge}</div>}
      <MatchyMascot
        className="brand-hero__mascot"
        pose={mascotPose}
        size={compact ? 128 : 158}
      />
    </section>
  );
}
