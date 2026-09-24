import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarX2, MapPin, Users, Utensils } from "lucide-react";
import { useCompanyData } from "../hooks/CompanyData";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  applicationCandidateName,
  applicationLabels,
  type ApplicationStatus,
  type CompanyApplication,
} from "../services/applications";
import { HeroBanner } from "../components/HeroBanner";
import { Avatar } from "../components/ui/Avatar";
import { ApplicationStatusMark } from "../components/ui/Status";
import { EmptyState, PageBody } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Reveal } from "../components/ui/Reveal";
import { cn } from "../lib/cn";

const when = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Filter = "pending" | ApplicationStatus | "all";

const filters: { key: Filter; label: string }[] = [
  { key: "pending", label: "À traiter" },
  { key: "accepted", label: applicationLabels.accepted + "s" },
  { key: "rejected", label: applicationLabels.rejected + "s" },
  { key: "all", label: "Toutes" },
];

/** Initiales de repli, quand la personne n'a pas encore de photo. */
const initialsOf = (first: string, last: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

/**
 * Une candidature reçue.
 *
 * CE QUI N'ALLAIT PAS. Un rectangle, un nom en gras, une gélule jaune, deux
 * lignes grises et un lien. L'entreprise décide ici d'engager QUELQU'UN pour un
 * service, et l'écran ne montrait pas cette personne — alors même que la photo
 * de profil est devenue obligatoire précisément pour cela (voir D14).
 *
 * CE QUI LE REMPLACE. Le portrait ouvre la carte, le nom et le métier suivent,
 * et l'état prend la forme du système de statuts — la même marque que partout
 * ailleurs dans le produit. La mission concernée reste en dessous, parce
 * qu'elle situe la candidature sans en être le sujet.
 */
/**
 * Classes de l'élément de liste.
 *
 * Elles vivent ici plutôt que dans `Card` pour que l'élément `<li>` soit rendu
 * à UN SEUL endroit. La version précédente enveloppait un composant qui rendait
 * lui-même un `<li>` : deux éléments de liste imbriqués, ce que React signale
 * comme un balisage invalide et qui fausse tout décompte d'éléments de liste.
 */
function cardClassName(application: CompanyApplication) {
  const blocked = application.conflict && application.status === "pending";
  return cn(
    "application-card flex h-full flex-col gap-4 rounded-panel border bg-surface p-5 transition-all duration-300",
    blocked ? "border-caution-ink/30" : "border-rule",
    "hover:-translate-y-0.5 hover:border-sage hover:shadow-raise",
  );
}

function Card({ application }: { application: CompanyApplication }) {
  const { mission, worker } = application;
  const blocked = application.conflict && application.status === "pending";

  return (
    <>
      <div className="application-card-head flex items-start gap-3">
        <Avatar
          src={worker.avatar_url}
          initials={initialsOf(worker.first_name, worker.last_name)}
          size={46}
        />
        <div className="min-w-0 flex-1">
          <strong className="block truncate font-display font-semibold text-[1.0625rem] text-ink">
            {applicationCandidateName(application)}
          </strong>
          <p className="truncate text-[0.8125rem] text-ink-faint">
            {[worker.main_job, worker.city].filter(Boolean).join(" · ") ||
              "Profil en cours de complétion"}
          </p>
        </div>
        <ApplicationStatusMark status={application.status} />
      </div>

      {/* La mission situe la candidature : filet au-dessus, encre plus douce. */}
      <div className="border-rule border-t pt-3.5">
        <p className="application-card-mission flex items-center gap-2 text-[0.875rem]">
          <Utensils
            size={14}
            aria-hidden="true"
            className="shrink-0 text-ink-faint"
          />
          <Link
            className="min-w-0 truncate font-medium text-ink no-underline hover:underline"
            to={`/company/missions/${mission.id}`}
          >
            {mission.title}
          </Link>
        </p>
        <p className="application-card-meta mt-1.5 flex items-center gap-2 text-[0.8125rem] text-ink-faint">
          <MapPin size={13} aria-hidden="true" className="shrink-0" />
          {mission.city}
          {" · "}
          {when.format(new Date(mission.starts_at))}
        </p>
      </div>

      {blocked && (
        <p className="application-conflict flex items-start gap-2 rounded-[8px] bg-caution-tint px-3 py-2 text-[0.8125rem] text-caution-ink leading-relaxed">
          <CalendarX2 size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          Déjà engagée sur un autre créneau : cette candidature ne peut plus
          être acceptée.
        </p>
      )}

      <Link
        className="link-more mt-auto inline-flex items-center gap-1 font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
        to={`/company/missions/${mission.id}`}
      >
        {application.status === "pending"
          ? "Examiner la candidature"
          : "Voir la mission"}
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </>
  );
}

/**
 * Toutes les candidatures reçues, missions confondues.
 *
 * Cet écran s'appelait « Candidats » et ne montrait rien : il décrivait un
 * moteur de matching à venir, livré depuis. Il montre désormais exactement ce
 * que son nom annonce — des personnes qui ont postulé, et rien d'autre.
 *
 * Les profils suggérés par le rapprochement n'y figurent pas : l'entreprise ne
 * traite que les personnes qui ont réellement choisi de postuler.
 */
export function CompanyApplicationsPage() {
  usePageSeo({
    title: "Candidatures reçues · InteriMatch",
    description: "Consultation des candidatures pour vos missions.",
    robots: "noindex,nofollow",
  });
  const { applications, counts, loading, error } = useCompanyData();
  const [filter, setFilter] = useState<Filter>("pending");

  const shown = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((one) => one.status === filter),
    [applications, filter],
  );

  const tally: Record<Filter, number> = {
    pending: counts.pending,
    accepted: counts.accepted,
    rejected: counts.rejected,
    all: counts.total,
  };

  return (
    <section className="page-wide">
      <HeroBanner
        compact
        eyeline="Espace entreprise"
        title="Candidatures"
        subtitle="Les intérimaires qui ont postulé à vos missions. Chaque candidature se traite depuis la mission concernée."
        mascotPose="profile"
      />

      <PageBody className="space-y-6">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {/* Des FILTRES, pas des onglets : on restreint la même liste. */}
        <Segmented
          mode="filters"
          variant="switch"
          label="Filtrer les candidatures"
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
          items={filters.map((entry) => ({
            id: entry.key,
            label: entry.label,
            count: tally[entry.key],
          }))}
        />

        {loading && applications.length === 0 ? (
          <ul
            className="application-cards im-bare grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-hidden="true"
          >
            {[0, 1, 2].map((n) => (
              <li
                className="application-card rounded-panel border border-rule bg-surface p-5"
                key={n}
              >
                <div className="flex items-center gap-3">
                  <span className="size-[46px] shrink-0 animate-pulse rounded-full bg-paper-deep" />
                  <span className="h-4 flex-1 animate-pulse rounded bg-paper-deep" />
                </div>
                <span className="mt-4 block h-3 w-2/3 animate-pulse rounded bg-paper-deep" />
              </li>
            ))}
          </ul>
        ) : shown.length > 0 ? (
          <ul className="application-cards im-bare grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((application, index) => (
              <Reveal
                as="li"
                key={application.id}
                delay={Math.min(index, 5) * 0.04}
                className={cardClassName(application)}
              >
                <Card application={application} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title={
              counts.total === 0
                ? "Aucune candidature reçue"
                : "Rien dans ce filtre"
            }
            action={
              counts.total === 0 && (
                <Link className="im-btn im-btn--primary" to="/company/missions/new">
                  Créer une mission
                </Link>
              )
            }
          >
            {counts.total === 0
              ? "Publiez une mission : dès qu’un intérimaire y postule, sa candidature apparaît ici."
              : "Aucune candidature ne porte ce statut pour l’instant."}
          </EmptyState>
        )}
      </PageBody>
    </section>
  );
}
