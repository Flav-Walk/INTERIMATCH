import { Check, Slash, Circle, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Système de statuts InteriMatch.
 *
 * CE QUI NE VA PAS AVEC UNE PASTILLE PAR STATUT.
 * Le produit affichait jusqu'ici la même gélule arrondie pour tout : « À
 * pourvoir », « Acceptée », « Annulée », « Brouillon ». Seule la teinte
 * changeait. Trois conséquences, et aucune n'est cosmétique.
 *
 * 1. Rien ne hiérarchise. « Brouillon » est une note de travail, « Annulée »
 *    ferme un dossier, « À pourvoir » appelle une candidature : sur un écran
 *    qui en aligne quinze, ces trois-là pèsent exactement pareil.
 * 2. L'information tient à la couleur seule. Le libellé est là, mais la forme
 *    ne dit rien : en niveaux de gris — ou pour 8 % des hommes — la grille
 *    devient une suite de gélules identiques.
 * 3. C'est le motif le plus reconnaissable d'une interface produite vite.
 *
 * CE QUE FAIT CELUI-CI.
 * Cinq FORMES distinctes, choisies selon le poids de l'état, pas selon sa
 * teinte. La couleur ne fait que confirmer ce que la forme a déjà dit.
 *
 *   live   — un point qui bat sous un halo. L'état est en mouvement et
 *            quelqu'un peut encore agir dessus : « À pourvoir », « En cours »,
 *            « En attente ». C'est le seul qui s'anime, donc le seul qui
 *            attire l'œil sur une page dense.
 *   seal   — un pavé plein, coche incrustée. Une décision est prise et elle
 *            tient : « Acceptée », « Pourvue », « Mission confirmée ». Le
 *            poids visuel traduit le caractère acquis.
 *   struck — un contour barré. Le dossier est clos par la négative : « Non
 *            retenue », « Annulée ». Jamais de fond plein : un refus n'a pas
 *            à peser autant qu'un accord.
 *   draft  — un contour tireté. Rien n'est publié, donc rien n'est ferme :
 *            « Brouillon ». Le tireté dit « inachevé » sans un mot.
 *   quiet  — un point plein, sans cadre ni fond. L'état est révolu et ne
 *            demande rien : « Terminée », « Brouillon expiré ». Il doit
 *            s'effacer, pas se signaler.
 *
 * ACCESSIBILITÉ. Chaque forme porte un glyphe ou une géométrie propre en plus
 * de sa teinte, et toujours son libellé en toutes lettres. L'animation de
 * `live` passe par `prefers-reduced-motion`, déclaré globalement.
 */

export type StatusForm = "live" | "seal" | "struck" | "draft" | "quiet";
export type StatusTone = "forest" | "clay" | "sage" | "alert" | "neutral";

const toneVars: Record<StatusTone, string> = {
  forest:
    "[--st-ink:var(--color-forest)] [--st-fill:var(--color-forest)] [--st-tint:var(--color-sage-tint)] [--st-edge:color-mix(in_oklch,var(--color-forest)_30%,transparent)]",
  clay: "[--st-ink:var(--color-clay-ink)] [--st-fill:var(--color-clay)] [--st-tint:var(--color-clay-tint)] [--st-edge:color-mix(in_oklch,var(--color-clay)_32%,transparent)]",
  sage: "[--st-ink:var(--color-forest-mid)] [--st-fill:var(--color-sage-deep)] [--st-tint:var(--color-sage-tint)] [--st-edge:color-mix(in_oklch,var(--color-sage-deep)_32%,transparent)]",
  alert:
    "[--st-ink:var(--color-alert)] [--st-fill:var(--color-alert)] [--st-tint:var(--color-alert-tint)] [--st-edge:color-mix(in_oklch,var(--color-alert)_30%,transparent)]",
  neutral:
    "[--st-ink:var(--color-ink-faint)] [--st-fill:var(--color-ink-faint)] [--st-tint:var(--color-paper-deep)] [--st-edge:var(--color-rule-strong)]",
};

const shell =
  "inline-flex items-center gap-1.5 align-middle text-[0.75rem] font-semibold leading-none whitespace-nowrap";

export function StatusMark({
  form,
  tone = "neutral",
  children,
  className,
  title,
}: {
  form: StatusForm;
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  /** Précision destinée au survol ; jamais la seule porteuse du sens. */
  title?: string;
}) {
  const base = cn(shell, toneVars[tone], className);

  if (form === "live")
    return (
      <span
        className={cn(
          base,
          "rounded-full bg-(--st-tint) py-1 pr-2.5 pl-2 text-(--st-ink)",
        )}
        title={title}
      >
        {/* Le halo bat, le noyau reste net : un point qui grossit tout entier
            se lit comme un défaut d'affichage, pas comme une pulsation. */}
        <span className="relative flex size-2 shrink-0 items-center justify-center">
          <span className="absolute inline-flex size-2 animate-ping rounded-full bg-(--st-fill) opacity-60 [animation-duration:2.4s]" />
          <span className="relative inline-flex size-1.5 rounded-full bg-(--st-fill)" />
        </span>
        {children}
      </span>
    );

  if (form === "seal")
    return (
      <span
        className={cn(
          base,
          "rounded-[6px] bg-(--st-fill) py-1 pr-2.5 pl-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]",
        )}
        title={title}
      >
        <Check size={13} strokeWidth={3} aria-hidden="true" />
        {children}
      </span>
    );

  if (form === "struck")
    return (
      <span
        className={cn(
          base,
          "rounded-[6px] border border-(--st-edge) py-1 pr-2.5 pl-1.5 font-medium text-(--st-ink)",
        )}
        title={title}
      >
        <Slash size={12} strokeWidth={2.5} aria-hidden="true" />
        {children}
      </span>
    );

  if (form === "draft")
    return (
      <span
        className={cn(
          base,
          "rounded-[6px] border border-(--color-rule-strong) border-dashed py-1 pr-2.5 pl-1.5 font-medium text-(--color-ink-soft)",
        )}
        title={title}
      >
        <PencilLine size={12} strokeWidth={2.2} aria-hidden="true" />
        {children}
      </span>
    );

  return (
    <span className={cn(base, "font-medium text-(--st-ink)")} title={title}>
      <Circle size={7} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Traduction des clés métier en formes.
 *
 * ELLE NE DÉCIDE RIEN. `missionStatePresentation` reste seule propriétaire de
 * l'état affiché, côté service, avec ses règles et ses tests. Cette table ne
 * fait que dire comment DESSINER une clé déjà décidée — et c'est précisément
 * ce qui permet de refondre l'apparence sans toucher au métier.
 */
const missionForms: Record<string, { form: StatusForm; tone: StatusTone }> = {
  open: { form: "live", tone: "forest" },
  running: { form: "live", tone: "clay" },
  filled: { form: "seal", tone: "forest" },
  draft: { form: "draft", tone: "neutral" },
  completed: { form: "quiet", tone: "neutral" },
  cancelled: { form: "struck", tone: "alert" },
};

export function MissionStatus({
  state,
  className,
}: {
  /** Tel que le sert `missionStatePresentation` : clé + libellé, sans copie. */
  state: { key: string; label: string };
  className?: string;
}) {
  const shape = missionForms[state.key] ?? {
    form: "quiet" as const,
    tone: "neutral" as const,
  };
  // « Brouillon expiré » partage la clé `draft` mais n'est plus modifiable :
  // le serveur le dit dans le libellé, la forme doit le dire aussi.
  const expiredDraft = state.key === "draft" && state.label !== "Brouillon";
  return (
    <StatusMark
      form={expiredDraft ? "quiet" : shape.form}
      tone={shape.tone}
      className={className}
    >
      {state.label}
    </StatusMark>
  );
}

const applicationForms = {
  pending: { form: "live" as const, tone: "sage" as const, label: "En attente" },
  accepted: {
    form: "seal" as const,
    tone: "forest" as const,
    label: "Acceptée",
  },
  rejected: {
    form: "struck" as const,
    tone: "neutral" as const,
    label: "Non retenue",
  },
};

export function ApplicationStatusMark({
  status,
  className,
}: {
  status: "pending" | "accepted" | "rejected";
  className?: string;
}) {
  const shape = applicationForms[status];
  return (
    <StatusMark form={shape.form} tone={shape.tone} className={className}>
      {shape.label}
    </StatusMark>
  );
}

/**
 * Remplissage des postes.
 *
 * « 3/5 postes pourvus » écrit dans une gélule oblige à lire pour comprendre
 * où en est le recrutement. Des segments le montrent d'un coup d'œil, et le
 * texte reste là pour les lecteurs d'écran et pour la précision.
 *
 * Le nombre de segments suit l'effectif réel, jusqu'à huit. Au-delà, des
 * traits d'un pixel ne se distinguent plus : on retombe sur une barre
 * continue, qui reste honnête.
 */
export function CapacityMeter({
  filled,
  headcount,
  className,
}: {
  filled: number;
  headcount: number;
  className?: string;
}) {
  const complete = headcount > 0 && filled >= headcount;
  // « 1/3 postes pourvu » accordait le nom sur l'effectif et le participe sur
  // le remplissage : la phrase était fautive dès qu'ils divergeaient. La forme
  // longue accorde les deux sur le même nombre, et se lit d'une traite.
  const label = complete
    ? "Tous les postes sont pourvus"
    : `${filled} poste${filled > 1 ? "s" : ""} pourvu${filled > 1 ? "s" : ""} sur ${headcount}`;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="flex items-center gap-[3px]">
        {headcount <= 8 ? (
          Array.from({ length: headcount }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] w-3 rounded-full transition-colors duration-300",
                i < filled ? "bg-forest" : "bg-rule-strong",
              )}
            />
          ))
        ) : (
          <span className="relative h-[3px] w-20 overflow-hidden rounded-full bg-rule-strong">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-forest"
              style={{
                width: `${Math.min(100, (filled / headcount) * 100)}%`,
              }}
            />
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-[0.75rem] font-semibold",
          complete ? "text-forest" : "text-ink-soft",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * État d'un document contractuel.
 *
 * Même principe que les missions et les candidatures : la FORME dit le poids de
 * l'état, la couleur ne fait que confirmer.
 *
 *   `draft` / `awaiting_finalization` — en préparation, rien n'est ferme : le
 *       contour tireté, comme un brouillon de mission ;
 *   `awaiting_*_signature` — quelqu'un doit agir, et c'est souvent la personne
 *       qui regarde l'écran : la marque vivante, la seule qui bat ;
 *   `completed` — décision acquise et signée : le pavé plein ;
 *   `cancelled` — dossier clos par la négative : le contour barré.
 *
 * Le LIBELLÉ n'est pas décidé ici : `documentStatus` le compose déjà selon le
 * rôle qui regarde — « À valider » pour qui doit signer, « En attente de
 * l'intérimaire » pour l'autre partie. Ce composant ne fait que le dessiner.
 */
const documentForms: Record<string, { form: StatusForm; tone: StatusTone }> = {
  draft: { form: "draft", tone: "neutral" },
  awaiting_finalization: { form: "draft", tone: "neutral" },
  awaiting_worker_signature: { form: "live", tone: "sage" },
  awaiting_company_signature: { form: "live", tone: "sage" },
  completed: { form: "seal", tone: "forest" },
  cancelled: { form: "struck", tone: "alert" },
};

export function DocumentStatusMark({
  status,
  label,
  className,
}: {
  status: string;
  /** Libellé déjà composé selon le rôle qui regarde. */
  label: string;
  className?: string;
}) {
  const shape = documentForms[status] ?? {
    form: "quiet" as const,
    tone: "neutral" as const,
  };
  return (
    <StatusMark form={shape.form} tone={shape.tone} className={className}>
      {label}
    </StatusMark>
  );
}
