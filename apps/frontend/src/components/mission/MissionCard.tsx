import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Clock3, ImageOff, MapPin } from "lucide-react";
import {
  missionStatePresentation,
  type Mission,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";
import { MissionStatus, CapacityMeter } from "../ui/Status";
import { cn } from "../../lib/cn";

/**
 * Carte d'une mission.
 *
 * CE QUI N'ALLAIT PAS. Un bandeau photo, un titre, trois lignes « icône +
 * texte » de même graisse, et un pied. Rien ne hiérarchisait : la ville, la
 * date et la rémunération avaient le même poids visuel, alors que ce ne sont
 * pas les mêmes décisions. Le résultat se lisait de haut en bas, ligne par
 * ligne, alors qu'une carte doit se lire d'un coup d'œil.
 *
 * CE QUI LE REMPLACE — quatre registres typographiques, pas un de plus.
 *
 *   surtitre   l'établissement, en capitales espacées. C'est le contexte : on
 *              le lit si l'on veut, on le saute sinon.
 *   titre      le poste, en Playfair. C'est ce qu'on cherche, donc c'est ce qui
 *              est gros.
 *   repères    lieu, date, horaires : même famille, même graisse, en gris. Ils
 *              se parcourent ensemble, comme une seule ligne d'information.
 *   chiffre    la rémunération, seule donnée qui décide, donc seule à être
 *              mise en avant — en Inter tabulaire et en encre pleine.
 *
 * LA PHOTO. Elle porte un dégradé bas et une légère montée au survol. Quand la
 * mission n'en a pas — les missions publiées avant que la photo ne devienne
 * obligatoire — le cadre affiche un aplat sauge tramé, PAS une image générique
 * qui prétendrait montrer un établissement qu'elle ne connaît pas.
 *
 * L'ÉTAT n'est plus une gélule posée sur la photo : c'est le système de
 * statuts, avec ses cinq formes. Voir `components/ui/Status.tsx`.
 */

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Notation de la maquette : « 18h » à l'heure pile, « 18h30 » sinon. */
const frenchHour = (date: Date) => {
  const minutes = date.getMinutes();
  const hours = String(date.getHours()).padStart(2, "0");
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
};

/** Une fin sur un autre jour est toujours datée : l'omettre masque la durée. */
export function missionSchedule(mission: Mission) {
  const start = new Date(mission.starts_at);
  const end = new Date(mission.ends_at);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return sameDay
    ? `${dayMonth.format(start)} · ${frenchHour(start)} – ${frenchHour(end)}`
    : `${dayMonth.format(start)} · ${frenchHour(start)} – ${dayMonth.format(end)} · ${frenchHour(end)}`;
}

/**
 * Date et horaires, séparés.
 *
 * `missionSchedule` reste la source unique de la chaîne complète, et ses tests
 * avec elle. La carte, elle, a besoin de poser la date et l'heure sur deux
 * repères distincts : les deux se lisent à des moments différents — « est-ce
 * que je suis libre ce jour-là », puis « est-ce que ces horaires me vont ».
 */
function scheduleParts(mission: Mission) {
  const start = new Date(mission.starts_at);
  const end = new Date(mission.ends_at);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return {
    date: sameDay
      ? dayMonth.format(start)
      : `${dayMonth.format(start)} → ${dayMonth.format(end)}`,
    hours: `${frenchHour(start)} – ${frenchHour(end)}`,
  };
}

/** Rémunération lisible, ou `null` quand le montant et son unité manquent. */
export function missionPay(amount: string | null, unit: string | null) {
  if (!amount || !unit) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const suffix = unit === "hour" ? "€/h" : unit === "day" ? "€/j" : "€";
  return `${value.toFixed(2).replace(".", ",")} ${suffix}`;
}

export function MissionCard({
  mission,
  basePath = "/company/missions",
  score,
  band,
  bandLabel,
  pendingApplications = 0,
  establishment,
}: {
  mission: Mission;
  /** La même carte sert les deux espaces, qui n'ouvrent pas le même détail. */
  basePath?: string;
  /** Côté intérimaire uniquement : une entreprise voit ses propres missions. */
  score?: number;
  /** Palier métier servi par le backend, jamais redéduit du score arrondi. */
  band?: number | null;
  bandLabel?: string | null;
  /** Candidatures réellement en attente, côté entreprise. */
  pendingApplications?: number;
  /** Établissement, côté intérimaire. Absent côté entreprise : c'est le sien. */
  establishment?: string | null;
}) {
  // L'état affiché vient de la fonction commune, qui croise le statut écrit,
  // les dates et la capacité servie par le serveur.
  const status = missionStatePresentation(mission);
  const closed =
    status.temporal === "cancelled" || status.temporal === "completed";
  const pay = missionPay(mission.pay_amount, mission.pay_unit);
  const { date, hours } = scheduleParts(mission);

  return (
    <Link
      className={cn(
        "mission-card group relative flex h-full flex-col overflow-hidden rounded-panel border border-rule bg-surface no-underline",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:border-sage hover:shadow-raise",
        closed && "is-closed opacity-72 hover:opacity-100",
      )}
      to={`${basePath}/${mission.id}`}
    >
      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-sage-tint">
        {mission.media ? (
          <img
            className={cn(
              "job-visual size-full object-cover transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]",
              // Une mission terminée ou annulée reste consultable, mais elle
              // n'a plus à attirer l'œil dans une grille où d'autres sont
              // ouvertes. La photo se retire, elle ne disparaît pas.
              closed && "grayscale group-hover:grayscale-0",
            )}
            src={mission.media.url}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          /* Aucune photo : un aplat de marque, pas une image d'illustration.
             Une photo générique laisserait croire que c'est l'établissement. */
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center bg-[repeating-linear-gradient(135deg,var(--color-sage-tint)_0_10px,var(--color-paper-deep)_10px_20px)] text-sage-deep"
          >
            <ImageOff size={22} />
          </span>
        )}
        {/* Voile bas : sans lui, un statut clair posé sur une photo claire
            devient illisible, et cela dépend de la photo — donc de personne. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,oklch(0.235_0.018_160/0.42),transparent)]"
        />
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <MissionStatus
            state={status}
            className="mission-status bg-surface/92 shadow-lift backdrop-blur-sm"
          />
          {/* « Pourvue » et « À pourvoir » ne disent pas QUAND. Une mission
              complète mais pas encore commencée et une mission complète déjà
              passée portent le même état, et ce n'est pas la même chose pour
              qui la consulte. Le repère temporel reste donc distinct de
              l'état, et ne s'affiche que là où il ajoute quelque chose. */}
          {status.temporal === "upcoming" && mission.status !== "draft" && (
            <span className="mission-timing inline-flex items-center rounded-full bg-surface/92 px-2 py-1 font-semibold text-[0.6875rem] text-ink-soft shadow-lift backdrop-blur-sm">
              À venir
            </span>
          )}
        </div>
        {pendingApplications > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-clay-ink px-2 py-1 font-bold text-[0.6875rem] text-white shadow-lift tabular-nums">
            {pendingApplications}
            <span className="sr-only">
              {" "}
              candidature{pendingApplications > 1 ? "s" : ""} en attente
            </span>
          </span>
        )}
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          {establishment && (
            <p className="truncate font-semibold text-[0.6875rem] text-ink-faint uppercase tracking-[0.1em]">
              {establishment}
            </p>
          )}
          <h3 className={cn("mission-title", closed && "text-ink-faint")}>
            {mission.title}
          </h3>
        </div>

        {/* Les trois repères partagent une graisse et une couleur : ils se
            parcourent d'un bloc, sans qu'aucun ne réclame l'attention. */}
        <ul className="im-bare space-y-1.5 text-[0.8125rem] text-ink-soft">
          <li className="flex items-center gap-2">
            <MapPin size={14} aria-hidden="true" className="shrink-0 text-ink-faint" />
            <span className="truncate">
              {mission.city}
              {mission.postal_code ? ` · ${mission.postal_code}` : ""}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays
              size={14}
              aria-hidden="true"
              className="shrink-0 text-ink-faint"
            />
            <span className="truncate">{date}</span>
          </li>
          <li className="flex items-center gap-2">
            <Clock3 size={14} aria-hidden="true" className="shrink-0 text-ink-faint" />
            <span className="truncate tabular-nums">{hours}</span>
          </li>
        </ul>

        {/* La rémunération est la seule donnée à changer de registre : c'est
            elle qui décide, et elle doit se trouver sans être cherchée. */}
        {pay && (
          <p className="font-semibold text-[1.0625rem] text-ink tabular-nums">
            {pay}
          </p>
        )}

        {/* ── Pied ────────────────────────────────────────────────────── */}
        <div className="mt-auto flex items-end justify-between gap-3 border-rule border-t pt-3.5">
          <div className="min-w-0">
            {score === undefined ? (
              mission.capacity ? (
                <CapacityMeter
                  filled={mission.capacity.filled}
                  headcount={mission.capacity.headcount}
                />
              ) : (
                <span className="text-[0.75rem] font-semibold text-ink-soft">
                  {mission.headcount > 1
                    ? `${mission.headcount} postes`
                    : "1 poste"}
                </span>
              )
            ) : (
              <MatchBadge score={score} band={band} bandLabel={bandLabel} />
            )}
          </div>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-rule text-ink-faint transition-all duration-300 group-hover:border-forest group-hover:bg-forest group-hover:text-white"
          >
            <ArrowUpRight size={15} strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
