import { cn } from "../../lib/cn";

/**
 * Avancement d'un profil, règle par règle.
 *
 * SOURCE de la technique : Magic UI — `animated-circular-progress-bar`
 * (https://magicui.design/r/animated-circular-progress-bar.json, licence MIT).
 * On en reprend l'idée centrale : un arc dessiné en `stroke-dasharray` avec un
 * intervalle réservé, animé par transition CSS et non par JavaScript.
 *
 * CE QUI A ÉTÉ CHANGÉ, ET POURQUOI ÇA COMPTE.
 * L'original — comme la jauge maison qu'il remplace — affiche UN pourcentage.
 * « 67 % » ne dit pas quoi faire. L'utilisateur voit qu'il lui manque quelque
 * chose, sans savoir quoi, et doit parcourir la page pour le deviner.
 *
 * Ici l'anneau est SEGMENTÉ : un arc par règle de complétion servie par le
 * serveur. Un arc plein est une règle satisfaite, un arc pâle une règle
 * manquante. La position du trou désigne l'étape, et la légende la nomme. La
 * même surface d'écran répond à « où j'en suis » ET à « que dois-je faire ».
 *
 * AUCUNE RÈGLE N'EST DÉCIDÉE ICI. `missing_requirements` vient de
 * `completion.ts`, côté serveur, qui reste seul juge de `onboarding_completed`.
 * Le composant reçoit la liste des règles et celles qui manquent, rien de plus.
 */
export function RuleRing({
  rules,
  missing,
  size = 128,
  className,
}: {
  /** Toutes les règles, dans l'ordre du parcours, avec leur intitulé. */
  rules: { key: string; label: string }[];
  /** Celles qui ne sont pas satisfaites, telles que le serveur les nomme. */
  missing: string[];
  size?: number;
  className?: string;
}) {
  const total = rules.length;
  const done = total - missing.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  // Un intervalle de 4 unités entre les arcs : assez pour que la segmentation
  // se voie, trop peu pour qu'elle hache l'anneau sur six règles.
  const gap = 4;
  const arc = circumference / total - gap;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        missing.length === 0
          ? "Profil complet : les six règles sont satisfaites."
          : `Profil complété à ${percent} %. Il reste : ${missing
              .map((k) => rules.find((r) => r.key === k)?.label ?? k)
              .join(", ")}.`
      }
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        {rules.map((rule, index) => {
          const satisfied = !missing.includes(rule.key);
          return (
            <circle
              key={rule.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              // Un seul arc visible par cercle : sa longueur, puis un vide qui
              // couvre tout le reste. `strokeDashoffset` le fait tourner à sa
              // place. Six cercles superposés dessinent six segments.
              strokeDasharray={`${arc} ${circumference - arc}`}
              strokeDashoffset={-(index * (circumference / total)) - gap / 2}
              className={cn(
                "transition-[stroke] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                satisfied ? "stroke-forest" : "stroke-rule-strong",
              )}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold text-[1.75rem] text-ink leading-none tabular-nums">
          {percent}
          <span className="text-[0.875rem] text-ink-faint">%</span>
        </span>
        <span className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}
