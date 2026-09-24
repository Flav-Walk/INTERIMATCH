import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  MapPin,
  PencilLine,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import {
  formatSlot,
  requirementLabels,
  upcomingAvailabilities,
} from "../services/profile";
import { errorMessage, type CompletionRule } from "../services/session";
import { MissionCard } from "../components/mission/MissionCard";
import {
  explainEmpty,
  listOpenMissions,
  missionTemporalState,
  type Exclusions,
  type OpenMission,
} from "../services/missions";
import {
  awaitingReply,
  listMyApplications,
  upcomingEngagements,
  type WorkerApplication,
} from "../services/applications";
import { ConfirmedMissions } from "../components/applications/ConfirmedMissions";
import {
  EmptyState,
  PageBody,
  PageHeader,
} from "../components/ui/PageHeader";
import { RuleRing } from "../components/ui/RuleRing";
import { Reveal } from "../components/ui/Reveal";
import { cn } from "../lib/cn";

/**
 * Tableau de bord intérimaire.
 *
 * CE QUI N'ALLAIT PAS. Un bandeau à mascotte, puis une succession de blocs
 * blancs de même poids : « complétez votre profil », « vos prochaines
 * missions », « missions disponibles », et une colonne latérale de trois
 * panneaux identiques. Rien ne disait quoi regarder en premier. Un tableau de
 * bord qui traite tout à égalité ne hiérarchise rien — il fait juste une liste
 * verticale de tout ce que le produit sait faire.
 *
 * CE QUI LE REMPLACE. Une seule question gouverne la page : « suis-je prêt à
 * recevoir des missions ? »
 *
 *  — Si NON, c'est la seule chose qui compte. L'anneau de complétion passe en
 *    tête, avec la liste exacte de ce qui manque et un lien par règle. Tout le
 *    reste descend.
 *  — Si OUI, l'anneau se réduit à une confirmation discrète dans l'en-tête, et
 *    la page donne la priorité à ce qui appelle une action : les missions
 *    confirmées à venir, puis les propositions.
 *
 * La colonne latérale ne porte plus que des RAPPELS — disponibilités,
 * mobilité, candidatures en attente — et le dit par sa forme : pas de cartes
 * blanches empilées, mais des blocs séparés par des filets, comme une fiche.
 *
 * LES REPÈRES DE VISITE GUIDÉE (`data-tour`) sont conservés à l'identique :
 * `profile-status`, `missions`, `availability`. La visite pointe des zones de
 * cet écran, et les déplacer sans les renommer casserait le pointage.
 */

/** Règles de complétion, dans l'ordre du parcours, telles que le serveur les nomme. */
const RULES = (Object.keys(requirementLabels) as CompletionRule[]).map(
  (key) => ({ key, label: requirementLabels[key] }),
);

/** Un bloc de la colonne latérale. Filet haut, pas de carte. */
function RailBlock({
  icon,
  title,
  children,
  tour,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tour?: string;
}) {
  return (
    <section
      data-tour={tour}
      className="border-rule border-t pt-5 first:border-t-0 first:pt-0"
    >
      {/* PAS DE `uppercase` ICI. Le titre de ce bloc peut être un nom propre —
          la ville de l'utilisateur — et les navigateurs appliquent
          `text-transform` au calcul du nom accessible. « Lyon » deviendrait
          « LYON » pour une synthèse vocale comme pour la recette. L'effet de
          titre courant passe donc par la graisse et l'interlettrage. */}
      <h2 className="flex items-center gap-2 font-sans font-semibold text-[0.8125rem] text-ink tracking-[0.01em]">
        <span aria-hidden="true" className="text-sage-deep">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Dashboard() {
  const { user, revision } = useAuth();
  const isWorker = user?.role === "worker";
  usePageSeo({
    title: isWorker
      ? "Tableau de bord intérimaire · InteriMatch"
      : "Tableau de bord entreprise · InteriMatch",
    description: isWorker
      ? "Espace personnel intérimaire InteriMatch."
      : "Espace établissement entreprise InteriMatch.",
    robots: "noindex,nofollow",
  });
  const [open, setOpen] = useState<OpenMission[]>([]);
  const [excluded, setExcluded] = useState<Exclusions>();
  const [mine, setMine] = useState<WorkerApplication[]>([]);
  const [missionsError, setMissionsError] = useState("");
  const [applicationsError, setApplicationsError] = useState("");
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(true);

  useEffect(() => {
    if (!isWorker) return;
    let live = true;
    setMissionsLoading(true);
    setApplicationsLoading(true);
    setMissionsError("");
    setApplicationsError("");
    // Une panne du catalogue ne doit pas masquer une mission déjà acceptée,
    // et inversement : chaque réponse reste exploitable indépendamment.
    void Promise.allSettled([listOpenMissions(), listMyApplications()])
      .then(([missionsResult, applicationsResult]) => {
        if (!live) return;
        if (missionsResult.status === "fulfilled") {
          setOpen(missionsResult.value.missions);
          setExcluded(missionsResult.value.excluded);
        } else {
          setMissionsError(errorMessage(missionsResult.reason));
        }
        if (applicationsResult.status === "fulfilled") {
          setMine(applicationsResult.value.applications);
        } else {
          setApplicationsError(errorMessage(applicationsResult.reason));
        }
      })
      .finally(() => {
        if (!live) return;
        setMissionsLoading(false);
        setApplicationsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [isWorker, revision]);

  if (!user || user.role !== "worker") return null;
  const p = user.profile,
    upcoming = upcomingAvailabilities(p.availabilities);
  const reason = explainEmpty(excluded);
  const engagements = upcomingEngagements(mine);
  const hasRunningEngagement = engagements.some(
    (application) => missionTemporalState(application.mission) === "running",
  );
  const waiting = awaitingReply(mine);
  const missing = user.missing_requirements ?? [];
  const ready = missing.length === 0;

  return (
    <>
      {user.demo && (
        <p className="demo-label im-page">
          DEVELOPMENT / DEMO DATA · Profil fictif
        </p>
      )}

      <PageHeader
        eyebrow="Espace intérimaire"
        title={user.first_name ? `Bonjour ${user.first_name},` : "Bienvenue,"}
        lead={
          ready
            ? "Vos prérequis sont réunis : les missions compatibles avec vos disponibilités vous sont proposées ci-dessous."
            : "Il reste quelques informations à renseigner avant que des missions puissent vous être proposées."
        }
        actions={
          ready && (
            <Link
              className="im-btn im-btn--outline im-btn--sm"
              to="/worker/profile"
              data-tour="profile-status"
            >
              <Check size={15} aria-hidden="true" />
              Prérequis réunis · Modifier
            </Link>
          )
        }
        aside={
          // Profil complet : l'anneau n'est qu'une confirmation, il tient dans
          // l'en-tête. Profil incomplet : il devient le sujet de la page et
          // descend dans le corps, accompagné de ce qui manque.
          ready && (
            <RuleRing rules={RULES} missing={missing} size={92} />
          )
        }
      />

      <PageBody className="space-y-10">
        {!ready && (
          <Reveal>
            <section
              data-tour="profile-status"
              aria-labelledby="completion-title"
              className="flex flex-col gap-7 rounded-panel border border-sage bg-sage-tint/50 p-6 sm:flex-row sm:items-center lg:p-8"
            >
              <RuleRing rules={RULES} missing={missing} size={128} />
              <div className="min-w-0 flex-1">
                <h2 id="completion-title" className="text-ink">
                  Il reste {missing.length} information
                  {missing.length > 1 ? "s" : ""} à renseigner
                </h2>
                <p className="mt-2 max-w-xl text-[0.9375rem] text-ink-soft leading-relaxed">
                  Ces informations décident des missions qui vous seront
                  proposées. Sans elles, aucune proposition ne peut vous
                  parvenir.
                </p>
                {/* Chaque règle manquante mène à SA section du profil. La liste
                    disait jusqu'ici quoi faire, sans dire où : il fallait
                    parcourir six blocs pour retrouver le bon. */}
                <ul className="im-bare mt-5 flex flex-wrap gap-2">
                  {missing.map((rule) => (
                    <li key={rule}>
                      <Link
                        to={`/worker/profile#${rule}`}
                        className="inline-flex items-center gap-1.5 rounded-[7px] border border-rule-strong border-dashed bg-surface px-2.5 py-1.5 font-medium text-[0.8125rem] text-ink no-underline transition-colors hover:border-forest hover:text-forest"
                      >
                        <PencilLine
                          size={12}
                          aria-hidden="true"
                          className="text-ink-faint"
                        />
                        {requirementLabels[rule]}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  className="im-btn im-btn--primary mt-6"
                  to="/worker/profile"
                >
                  Compléter mon profil
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </section>
          </Reveal>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
          {/* ── Colonne principale ───────────────────────────────────── */}
          <div className="min-w-0 space-y-10">
            {(applicationsLoading ||
              applicationsError ||
              engagements.length > 0) && (
              <section
                aria-labelledby="confirmed-missions-title"
                className="rounded-panel border border-sage bg-sage-tint/30 p-5 lg:p-6"
              >
                <h2
                  id="confirmed-missions-title"
                  className="im-rule mb-4 text-ink"
                >
                  {hasRunningEngagement
                    ? "En cours et à venir"
                    : "Vos prochaines missions"}
                </h2>
                {applicationsLoading ? (
                  <p className="text-[0.875rem] text-ink-faint" role="status">
                    Chargement de vos missions confirmées…
                  </p>
                ) : applicationsError ? (
                  <p className="form-error" role="alert">
                    {applicationsError}
                  </p>
                ) : (
                  <>
                    <ConfirmedMissions applications={engagements} />
                    {engagements.length > 0 && (
                      <p className="mt-3 text-[0.8125rem] text-ink-faint leading-relaxed">
                        Les offres sur ces créneaux ne vous sont plus proposées.
                        Vos disponibilités déclarées restent inchangées.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <section data-tour="missions" aria-labelledby="open-missions-title">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="open-missions-title" className="im-rule flex-1 text-ink">
                  Missions disponibles
                </h2>
                <Link
                  className="shrink-0 font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
                  to="/worker/missions"
                >
                  Tout voir
                </Link>
              </div>

              {missionsError && (
                <p className="form-error" role="alert">
                  {missionsError}
                </p>
              )}
              {!missionsError &&
                (missionsLoading ? (
                  <p className="text-[0.875rem] text-ink-faint" role="status">
                    Chargement des missions disponibles…
                  </p>
                ) : open.length > 0 ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {open.slice(0, 2).map((mission, index) => (
                      <Reveal
                        key={mission.id}
                        delay={index * 0.05}
                        className="h-full"
                      >
                        <MissionCard
                          mission={mission}
                          basePath="/worker/missions"
                          establishment={mission.company.establishment_name}
                          score={mission.match.score}
                          band={mission.match.band}
                          bandLabel={mission.match.band_label}
                        />
                      </Reveal>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BriefcaseBusiness size={20} />}
                    title={
                      reason?.title ?? "Aucune mission disponible pour le moment"
                    }
                  >
                    {reason?.detail ??
                      "Dès qu’un établissement publie une mission qui vous correspond, elle apparaît ici."}
                  </EmptyState>
                ))}
            </section>
          </div>

          {/* ── Rappels ──────────────────────────────────────────────── */}
          <aside className="space-y-5 lg:border-rule lg:border-l lg:pl-8">
            {waiting.length > 0 && (
              <RailBlock
                icon={<ClipboardList size={14} />}
                title="En attente de réponse"
              >
                <p className="font-display font-semibold text-[1.75rem] text-ink leading-none tabular-nums">
                  {waiting.length}
                </p>
                <p className="mt-1.5 text-[0.8125rem] text-ink-faint leading-relaxed">
                  {waiting.length > 1
                    ? "Les établissements doivent encore vous répondre."
                    : "L’établissement doit encore vous répondre."}
                </p>
                <Link
                  className="mt-2.5 inline-block font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
                  to="/worker/applications"
                >
                  Voir mes candidatures
                </Link>
              </RailBlock>
            )}

            <RailBlock
              icon={<CalendarDays size={14} />}
              title="Vos disponibilités"
              tour="availability"
            >
              {upcoming.length ? (
                <>
                  <p className="font-display font-semibold text-[1.75rem] text-ink leading-none tabular-nums">
                    {/* L'espace est explicite : sans lui, les deux nœuds de
                        texte se touchent et la phrase devient « 1créneau ». */}
                    {upcoming.length}{" "}
                    <span className="font-sans font-medium text-[0.8125rem] text-ink-faint">
                      créneau{upcoming.length > 1 ? "x" : ""} à venir
                    </span>
                  </p>
                  <ul className="im-bare mt-3 space-y-1.5">
                    {upcoming.slice(0, 3).map((slot) => (
                      <li
                        key={slot.id}
                        className="flex gap-2 text-[0.8125rem] text-ink-soft"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage"
                        />
                        {formatSlot(slot)}
                      </li>
                    ))}
                  </ul>
                  {/* Un profil complet n'exige qu'un créneau à venir ; une
                      mission, elle, doit tenir entièrement dans l'un d'eux. Le
                      dire ici évite de lire « profil complété » comme une
                      promesse de propositions. */}
                  <p className="mt-3 text-[0.8125rem] text-ink-faint leading-relaxed">
                    Une mission ne vous est proposée que si l’un de ces créneaux
                    la couvre entièrement.
                  </p>
                  <Link
                    className="mt-2.5 inline-block font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
                    to="/worker/profile#disponibilites"
                  >
                    {upcoming.length > 3
                      ? `Voir et modifier les ${upcoming.length} créneaux`
                      : "Modifier mes disponibilités"}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[0.875rem] text-ink-soft leading-relaxed">
                    Aucun créneau enregistré. Sans disponibilité, aucune mission
                    ne peut vous être proposée.
                  </p>
                  <Link
                    className="mt-2.5 inline-block font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
                    to="/worker/profile#disponibilites"
                  >
                    Ajouter un créneau
                  </Link>
                </>
              )}
            </RailBlock>

            <RailBlock
              icon={<MapPin size={14} />}
              title={p.city ?? "Votre mobilité"}
            >
              {p.city && p.mobility_radius_km != null ? (
                <>
                  <p className="text-[0.8125rem] text-ink-soft">
                    {p.postal_code} · jusqu’à {p.mobility_radius_km} km autour de
                    chez vous
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-[0.8125rem]",
                      p.open_to_missions === false
                        ? "font-medium text-clay-ink"
                        : "text-ink-faint",
                    )}
                  >
                    {p.has_vehicle
                      ? "Permis et véhicule"
                      : p.has_driving_licence
                        ? "Permis, sans véhicule"
                        : "Sans permis"}
                    {p.open_to_missions === false && " · recherche en pause"}
                  </p>
                </>
              ) : (
                <p className="text-[0.875rem] text-ink-soft leading-relaxed">
                  Votre ville et votre rayon de mobilité restent à renseigner.
                </p>
              )}
            </RailBlock>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
