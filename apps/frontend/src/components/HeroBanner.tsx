import type { ReactNode } from "react";
import { MatchyMascot } from "./MatchyMascot";
import { cn } from "../lib/cn";

/**
 * En-tête d'accueil d'un espace.
 *
 * CE QU'IL ÉTAIT. Un pavé vert à coins très arrondis, avec un dégradé radial,
 * un anneau décoratif de 390 px positionné en négatif — qui débordait la page
 * sur mobile — et une mascotte de 158 px. Il cohabitait avec `PageHeader` sur
 * les écrans repris : deux en-têtes pour un même produit, deux hauteurs, deux
 * échelles de titre.
 *
 * CE QU'IL EST. La MÊME composition que `PageHeader` — surtitre, titre,
 * accroche, actions, filet de clôture — avec la mascotte ramenée au rang de
 * signature, à droite et en petit. Les deux en-têtes du produit sont désormais
 * le même objet, à un détail près, et ce détail a une raison : c'est l'ACCUEIL
 * d'un espace, le seul écran où souhaiter la bienvenue a du sens.
 *
 * LES CLASSES SONT CONSERVÉES. `brand-hero`, `brand-hero__eyeline` et
 * `brand-hero__mascot` sont interrogées par la recette navigateur — l'intitulé
 * de l'établissement, la présence d'une seule mascotte. Elles ne portent plus
 * aucun style : la couche `components` neutralise l'ancien habillage, et la
 * mise en forme passe par les utilitaires posés ici.
 */
export function HeroBanner({
  eyeline,
  title,
  subtitle,
  mascotPose = "dashboard",
  action,
  gauge,
  compact = false,
}: {
  eyeline?: string;
  title: string;
  subtitle?: string;
  mascotPose?: "dashboard" | "missions" | "profile";
  action?: ReactNode;
  gauge?: ReactNode;
  /** Écran de liste : mêmes proportions, mascotte un cran plus discrète. */
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "brand-hero im-page border-rule border-b bg-surface",
        compact && "brand-hero--compact",
      )}
    >
      <div className="im-shell im-shell--wide flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:py-11">
        <div className="brand-hero__copy min-w-0 max-w-2xl">
          {eyeline && <p className="brand-hero__eyeline im-eyebrow">{eyeline}</p>}
          <h1
            className={cn(
              "text-ink text-[clamp(1.625rem,1.3rem+1.3vw,2.25rem)]",
              eyeline && "mt-3",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[0.9375rem] text-ink-soft leading-relaxed">
              {subtitle}
            </p>
          )}
          {action && (
            <div className="brand-hero__action mt-6 flex flex-wrap gap-2">
              {action}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-6 self-start lg:self-center">
          {gauge && <div className="brand-hero__gauge">{gauge}</div>}
          {/*
           * Matchy reste, et reste petit. Sur l'accueil d'un espace de travail,
           * un personnage de 158 px décide du registre de l'écran ; à 96 px, il
           * accompagne sans parler plus fort que le titre. Il est présent sur
           * tous les écrans d'espace — c'est l'identité du produit, et la
           * recette navigateur vérifie qu'il y en a exactement un.
           */}
          <MatchyMascot
            className="brand-hero__mascot hidden shrink-0 sm:block"
            pose={mascotPose}
            size={compact ? 80 : 96}
          />
        </div>
      </div>
    </header>
  );
}
