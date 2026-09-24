import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react";
import { errorMessage } from "../services/session";
import {
  listMyApplications,
  workerMissionContext,
  type WorkerApplication,
} from "../services/applications";
import { missionTemporalState } from "../services/missions";
import { workerApplicationSchedule } from "../components/applications/ConfirmedMissions";
import {
  ApplicationTrack,
  type TrackStep,
} from "../components/applications/ApplicationTrack";
import { ApplicationStatusMark } from "../components/ui/Status";
import {
  EmptyState,
  PageBody,
  PageHeader,
} from "../components/ui/PageHeader";
import { Reveal } from "../components/ui/Reveal";
import { cn } from "../lib/cn";
import { usePageSeo } from "../hooks/usePageSeo";

/**
 * Mes candidatures.
 *
 * CE QUI N'ALLAIT PAS. Une liste de grands rectangles : le texte à gauche, une
 * pastille d'état à droite. L'écran répondait à « où en est cette candidature »
 * par un seul mot — « En attente » — sans jamais dire ce qui s'était déjà passé
 * ni ce qui devait encore arriver. Et il mélangeait dans la même pile une
 * candidature envoyée hier et une mission terminée il y a six mois.
 *
 * CE QUI LE REMPLACE.
 *
 * 1. UNE FRISE par candidature, qui montre le cycle entier : envoi, réponse de
 *    l'établissement, mission. On y lit d'un coup d'œil ce qui est fait, ce
 *    qu'on attend, et ce qui s'est arrêté. Voir `ApplicationTrack`.
 *
 * 2. DEUX GROUPES. « En cours » réunit ce qui bouge encore — en attente,
 *    confirmée, en cours. « Historique » reçoit ce qui est clos — terminée,
 *    non retenue, annulée. Le tri est celui du produit, pas une préférence :
 *    une candidature close ne demande plus rien, elle se consulte.
 */

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

/**
 * Les trois jalons d'une candidature, dérivés de l'état servi par le serveur.
 *
 * LES LIBELLÉS SONT CONSTANTS — « Envoi », « Réponse », « Mission » — et
 * l'issue vit dans la précision. L'écran affiche déjà l'état en toutes lettres
 * deux fois : la marque de statut et le libellé de contexte. Une frise qui
 * répétait ces mêmes mots ne les rendait pas plus clairs, elle les faisait
 * seulement lire trois fois.
 *
 * AUCUNE RÈGLE MÉTIER N'EST REJOUÉE ICI. `application.status` vient du serveur,
 * `missionTemporalState` lit les bornes de la mission, et
 * `workerMissionContext` en a déjà tiré le libellé qui s'affiche à côté. Cette
 * fonction ne fait que répartir cette conclusion sur trois jalons.
 */
export function workerApplicationTrack(
  application: WorkerApplication,
  now = Date.now(),
): TrackStep[] {
  const temporal = missionTemporalState(application.mission, now);
  const on = (value: string) => shortDate.format(new Date(value));
  const sent: TrackStep = {
    label: "Envoi",
    detail: on(application.created_at),
    state: "done",
  };

  if (application.status === "rejected")
    return [
      sent,
      { label: "Réponse", detail: "non retenue", state: "failed" },
      // La mission a bien lieu, mais plus avec cette personne. L'étape reste
      // affichée — sinon la frise raccourcirait et les lignes cesseraient de
      // s'aligner d'une candidature à l'autre — et reste grise.
      { label: "Mission", state: "todo" },
    ];

  if (temporal === "cancelled")
    return [
      sent,
      application.status === "accepted"
        ? { label: "Réponse", detail: "acceptée", state: "done" }
        : { label: "Réponse", detail: "sans suite", state: "todo" },
      { label: "Mission", detail: "annulée", state: "failed" },
    ];

  if (application.status === "pending")
    return [
      sent,
      {
        label: "Réponse",
        detail:
          application.mission.recruiting_blocked === "full"
            ? "postes pourvus"
            : "attendue",
        state: "current",
      },
      { label: "Mission", state: "todo" },
    ];

  // Acceptée : reste la mission elle-même.
  const answered: TrackStep = {
    label: "Réponse",
    detail: `acceptée le ${on(application.updated_at)}`,
    state: "done",
  };
  if (temporal === "completed")
    return [sent, answered, { label: "Mission", detail: "terminée", state: "done" }];
  if (temporal === "running")
    return [
      sent,
      answered,
      { label: "Mission", detail: "en cours", state: "current" },
    ];
  return [
    sent,
    answered,
    {
      label: "Mission",
      detail: `le ${on(application.mission.starts_at)}`,
      state: "todo",
    },
  ];
}

export function workerApplicationContext(application: WorkerApplication) {
  return workerMissionContext(application).label;
}

/**
 * Classes de l'élément de liste.
 *
 * `is-confirmed` et `is-inactive` sont conservées : la recette navigateur s'en
 * sert pour distinguer une candidature confirmée d'une candidature close, et
 * c'est une distinction réelle du produit, pas un reste de l'ancienne feuille
 * de style.
 */
function rowClassName(application: WorkerApplication) {
  const key = workerMissionContext(application).key;
  const closed = key === "cancelled" || key === "completed" || key === "filled";
  const confirmed = key === "confirmed" || key === "running";
  return cn(
    confirmed ? "is-confirmed" : closed ? "is-inactive" : undefined,
    "block rounded-panel border bg-surface p-5 transition-colors sm:p-6",
    confirmed ? "border-sage bg-sage-tint/30" : "border-rule",
    closed && "opacity-75 hover:opacity-100",
  );
}

/** Contenu d'une candidature, du contexte jusqu'à la frise. */
function ApplicationRow({ application }: { application: WorkerApplication }) {
  const context = workerMissionContext(application);
  const closed =
    context.key === "cancelled" ||
    context.key === "completed" ||
    context.key === "filled";
  const confirmed = context.key === "confirmed" || context.key === "running";
  const location = [application.mission.postal_code, application.mission.city]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[0.6875rem] text-ink-faint uppercase tracking-[0.1em]">
            {application.company.establishment_name ?? "Établissement"}
          </p>
          <h2 className="mt-1 font-display font-semibold text-[1.0625rem] text-ink leading-snug">
            {application.mission.title}
          </h2>
        </div>
        <ApplicationStatusMark status={application.status} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} aria-hidden="true" className="text-ink-faint" />
          {location || "Lieu à confirmer"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={13} aria-hidden="true" className="text-ink-faint" />
          {workerApplicationSchedule(application)}
        </span>
      </div>

      <ApplicationTrack
        steps={workerApplicationTrack(application)}
        className="mt-6"
      />

      <div className="mt-5 flex items-center justify-between gap-3 border-rule border-t pt-4">
        {/* Le libellé de contexte reste la phrase de référence du produit, et
            la recette navigateur la vérifie mot pour mot. */}
        <strong
          className={cn(
            `application-context is-${context.key}`,
            "font-semibold text-[0.8125rem]",
            confirmed
              ? "text-forest"
              : closed
                ? "text-ink-faint"
                : "text-ink-soft",
          )}
        >
          {context.label}
        </strong>
        <Link
          className="inline-flex shrink-0 items-center gap-1 font-semibold text-[0.8125rem] text-forest no-underline hover:underline"
          to={`/worker/missions/${application.mission_id}`}
        >
          Voir la mission
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

export function WorkerApplicationList({
  applications,
}: {
  applications: WorkerApplication[];
}) {
  // Les deux groupes sont calculés une fois, et l'ordre d'arrivée du serveur
  // est conservé à l'intérieur de chacun.
  const [live, history] = useMemo(() => {
    const open: WorkerApplication[] = [];
    const past: WorkerApplication[] = [];
    for (const application of applications) {
      const key = workerMissionContext(application).key;
      (key === "completed" || key === "cancelled" || key === "rejected"
        ? past
        : open
      ).push(application);
    }
    return [open, past];
  }, [applications]);

  if (!applications.length)
    return (
      <EmptyState
        icon={<BriefcaseBusiness size={20} />}
        title="Vous n’avez pas encore postulé"
        action={
          <Link className="im-btn im-btn--primary" to="/worker/missions">
            Voir les missions
          </Link>
        }
      >
        Consultez les missions disponibles et ouvrez celle qui vous intéresse.
      </EmptyState>
    );

  return (
    <div className="space-y-10">
      {live.length > 0 && (
        <section aria-labelledby="live-applications">
          <h2 id="live-applications" className="im-rule mb-4 text-ink">
            En cours · {live.length}
          </h2>
          <ul className="worker-application-list im-bare space-y-4">
            {live.map((application, index) => (
              <Reveal
                as="li"
                key={application.id}
                delay={Math.min(index, 4) * 0.04}
                className={rowClassName(application)}
              >
                <ApplicationRow application={application} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="past-applications">
          <h2 id="past-applications" className="im-rule mb-4 text-ink">
            Historique · {history.length}
          </h2>
          <ul className="worker-application-list im-bare space-y-4">
            {history.map((application) => (
              <li key={application.id} className={rowClassName(application)}>
                <ApplicationRow application={application} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function WorkerApplications() {
  usePageSeo({
    title: "Mes candidatures · InteriMatch",
    description: "Suivi de mes candidatures InteriMatch.",
    robots: "noindex,nofollow",
  });
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void listMyApplications()
      .then((result) => {
        if (live) setApplications(result.applications);
      })
      .catch((cause) => {
        if (live) setError(errorMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <>
      <PageHeader
        eyebrow="Espace intérimaire"
        title="Mes candidatures"
        lead="Chaque candidature, de son envoi jusqu’à la décision de l’établissement — puis jusqu’à la mission."
      />
      <PageBody>
        {error ? (
          <div className="flex flex-col items-start gap-3">
            <p className="form-error" role="alert">
              {error}
            </p>
            <button
              className="im-btn im-btn--outline"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <p className="text-[0.875rem] text-ink-faint" role="status">
            Chargement de vos candidatures…
          </p>
        ) : (
          <WorkerApplicationList applications={applications} />
        )}
      </PageBody>
    </>
  );
}
