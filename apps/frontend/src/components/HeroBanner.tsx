import type { ReactNode } from "react";

interface HeroBannerProps {
  eyeline?: string;
  title: string;
  subtitle?: string;
  /**
   * Conservé pour ne pas casser les appels existants : la mascotte Matchy a
   * été retirée des bandeaux (ton jugé enfantin pour un outil de contrats).
   * La valeur n'a plus d'effet visuel.
   */
  mascotPose?: "dashboard" | "missions" | "profile";
  action?: ReactNode;
  gauge?: ReactNode;
  compact?: boolean;
}

/**
 * Bandeau d'en-tête des espaces connectés.
 *
 * Référence : le grand bandeau de image.png — fond vert forêt, titre Fraunces
 * blanc, action orange, et la signature « Les bonnes personnes, au bon
 * moment. » écrite à la main sur la droite.
 *
 * - La signature est décorative (`aria-hidden`) : le slogan est déjà lu dans
 *   le pied de page, inutile de le répéter aux lecteurs d'écran à chaque page.
 * - Aucune donnée métier, aucune navigation implicite : le bandeau n'affiche
 *   que ce que la page lui passe.
 */
export function HeroBanner({
  eyeline,
  title,
  subtitle,
  action,
  gauge,
  compact = false,
}: HeroBannerProps) {
  return (
    <section
      className={`brand-hero${compact ? " brand-hero--compact" : ""}${
        gauge ? " brand-hero--with-gauge" : ""
      }`}
    >
      <div className="brand-hero__copy">
        {eyeline && <span className="brand-hero__eyeline">{eyeline}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {action && <div className="brand-hero__action">{action}</div>}
      </div>
      {gauge ? (
        <div className="brand-hero__gauge">{gauge}</div>
      ) : (
        <p className="brand-hero__signature" aria-hidden="true">
          Les bonnes personnes,
          <br />
          au bon moment.
          <svg viewBox="0 0 120 14" focusable="false">
            <path d="M2 10 C 30 2, 70 2, 118 7" />
          </svg>
        </p>
      )}
    </section>
  );
}
