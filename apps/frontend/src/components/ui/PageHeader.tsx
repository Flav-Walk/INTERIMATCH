import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * En-tête d'un écran applicatif.
 *
 * CE QU'IL REMPLACE. Chaque page posait son propre bandeau : l'une avec une
 * mascotte et un dégradé, l'autre avec un simple `<h1>`, une troisième avec un
 * encart teinté. Trois hauteurs, trois gouttières, trois échelles de titre.
 * D'un écran à l'autre, le contenu sautait — le défaut qu'on ne sait pas
 * nommer mais qui fait « pas fini ».
 *
 * CE QU'IL EST. Une seule composition : surtitre, titre, accroche, actions, et
 * un filet de clôture. Rien d'autre. Pas d'illustration, pas de dégradé, pas de
 * carte : un en-tête n'a rien à montrer, il a une place à tenir.
 *
 * POURQUOI PAS DE MASCOTTE ICI. Elle reste dans le produit — c'est l'identité —
 * mais en tête de CHAQUE écran, un personnage souriant transforme un outil de
 * travail en application grand public. Elle garde sa place là où elle aide
 * vraiment : les écrans vides, où il y a quelque chose à dédramatiser.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  aside,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  /** Actions principales de l'écran, alignées à droite sur grand écran. */
  actions?: ReactNode;
  /** Complément d'information : un décompte, un état, une jauge. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("im-page border-rule border-b bg-surface", className)}>
      <div className="im-shell im-shell--wide py-8 lg:py-11">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            {eyebrow && <p className="im-eyebrow">{eyebrow}</p>}
            <h1
              className={cn(
                "text-ink",
                // L'échelle globale des h1 est faite pour une page d'accueil.
                // Dans l'application, un titre de 3,25 rem écraserait l'écran
                // qu'il annonce : il reste grand, mais il laisse la place.
                "text-[clamp(1.625rem,1.3rem+1.3vw,2.25rem)]",
                eyebrow && "mt-3",
              )}
            >
              {title}
            </h1>
            {lead && (
              <p className="mt-3 text-[0.9375rem] text-ink-soft leading-relaxed">
                {lead}
              </p>
            )}
          </div>

          {(actions || aside) && (
            <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
              {actions && (
                <div className="flex flex-wrap items-center gap-2">
                  {actions}
                </div>
              )}
              {aside}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Corps d'un écran applicatif.
 *
 * Il existe pour une seule raison : garantir que TOUS les écrans partagent la
 * même gouttière et le même rythme vertical que leur en-tête. Une page qui
 * choisit son propre `padding` finit toujours par se décaler de quelques
 * pixels, et c'est ce décalage — invisible page par page, flagrant en
 * navigation — qui trahit un assemblage.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("im-page im-shell im-shell--wide py-8 lg:py-10", className)}>
      {children}
    </div>
  );
}

/**
 * Écran vide.
 *
 * UN ÉTAT VIDE N'EST PAS UNE ERREUR. Il en disait jusqu'ici autant qu'un
 * message d'échec : une grande icône grise, un titre, une phrase. Or c'est
 * souvent le PREMIER écran qu'un nouvel utilisateur voit, et il a exactement
 * une chose à faire — dire ce qui manque et ce qu'on peut y faire.
 *
 * D'où la forme retenue : un cadre tireté, qui signale l'attente plutôt que
 * l'échec, un titre, une explication, et l'action quand il y en a une. Le
 * tireté reprend la forme du statut `draft` : dans les deux cas, il dit
 * « rien n'est encore là », et c'est une cohérence que l'œil enregistre sans
 * qu'on la lui explique.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "empty flex flex-col items-center rounded-panel border border-rule-strong border-dashed bg-surface/60 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="mb-4 flex size-11 items-center justify-center rounded-full bg-sage-tint text-forest"
        >
          {icon}
        </span>
      )}
      <h2 className="text-[1.25rem] text-ink">{title}</h2>
      {children && (
        <div className="mt-2.5 max-w-md text-[0.9375rem] text-ink-faint leading-relaxed">
          {children}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
