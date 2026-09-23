import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Coins,
  MapPin,
  ChefHat,
  ConciergeBell,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import {
  missionStatePresentation,
  type Mission,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";
import { MagicCard } from "../ui/magic-card";
import { MAGIC_CARD_COLORS } from "../../lib/brand";
import { jobFamily } from "../../lib/job-photos";

/**
 * Carte mission : bloc média, badge d'état en surimpression, titre, lieu,
 * créneau, puis pied avec l'effectif et la flèche circulaire.
 *
 * J'ai mis tout le contenu dans une Magic Card (Magic UI) : quand la souris
 * passe dessus, la bordure s'allume en orange → vert là où est le curseur.
 * Le lien, les données et le texte de la carte n'ont pas changé.
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

/** Rémunération lisible, ou `null` quand le montant et son unité manquent. */
export function missionPay(amount: string | null, unit: string | null) {
  if (!amount || !unit) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const suffix = unit === "hour" ? "€/h" : unit === "day" ? "€/j" : "€";
  return `${value.toFixed(2).replace(".", ",")} ${suffix}`;
}

/**
 * `basePath` : la même carte sert les deux espaces, qui n'ouvrent simplement
 * pas le même détail. Dupliquer le composant pour cette seule différence
 * ferait diverger deux fois la maquette.
 */
/*
 * Sans photo, la fiche affiche un visuel de marque plutôt qu'un cadre vide :
 * dégradé vert, trame de points et une icône choisie d'après l'intitulé du
 * poste. Ce n'est pas une image « d'illustration » : elle ne prétend montrer
 * aucun établissement.
 */
export function jobIcon(title: string) {
  const props = { size: 30, strokeWidth: 1.6 };
  // Même détection du métier que les photos d'illustration (lib/job-photos).
  switch (jobFamily(title)) {
    case "reception":
      return <ConciergeBell {...props} />;
    case "bar":
      return <Wine {...props} />;
    case "cuisine":
      return <ChefHat {...props} />;
    default:
      return <UtensilsCrossed {...props} />;
  }
}

export function MissionCard({
  mission,
  basePath = "/company/missions",
  score,
  band,
  bandLabel,
  pendingApplications = 0,
}: {
  mission: Mission;
  basePath?: string;
  /** Compatibilité, côté intérimaire uniquement : une entreprise voit ses
   *  propres missions, pour lesquelles un score n'aurait pas de sens. */
  score?: number;
  /**
   * Palier métier servi par le backend. Il accompagne toujours le score : la
   * pastille ne doit pas le redéduire d'un nombre arrondi.
   */
  band?: number | null;
  /** Intitulé du palier, servi par le serveur avec lui. */
  bandLabel?: string | null;
  /**
   * Candidatures en attente, côté entreprise. Uniquement de vraies
   * candidatures : un profil suggéré par le rapprochement n'a rien demandé et
   * n'a donc rien à compter ici.
   */
  pendingApplications?: number;
}) {
  // L'état affiché vient de la fonction commune, qui croise le statut écrit,
  // les dates et la capacité servie par le serveur.
  const status = missionStatePresentation(mission);
  // Le cycle est clos : la carte s'estompe et la flèche devient une coche.
  const closed =
    status.temporal === "cancelled" || status.temporal === "completed";
  const pay = missionPay(mission.pay_amount, mission.pay_unit);

  return (
    <Link
      className={`mission-card${closed ? " is-closed" : ""}`}
      to={`${basePath}/${mission.id}`}
    >
      <MagicCard className="card-surface" {...MAGIC_CARD_COLORS}>
        <div className="mission-media">
          {/* La photo choisie par l'établissement, et rien d'autre. Les
              anciennes missions sans média gardent le visuel de marque :
              aucune photo générique ne prétend montrer leur établissement. */}
          <span className="mission-media__placeholder" aria-hidden="true">
            {jobIcon(mission.title)}
          </span>
          {mission.media && (
            <img
              className="job-visual"
              src={mission.media.url}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
          {/* key = l'état de la mission. Si l'état change (ex. « À pourvoir »
              → « Pourvue »), React recrée le badge et il refait son petit
              zoom d'apparition : on remarque le changement. */}
          <motion.span
            key={status.className}
            className={`mission-status ${status.className}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
          >
            {status.label}
          </motion.span>
          {pendingApplications > 0 && (
            <span className="mission-pending">
              {pendingApplications}
              <span className="sr-only">
                {" "}
                candidature{pendingApplications > 1 ? "s" : ""} en attente
              </span>
            </span>
          )}
        </div>
        <div className="mission-body">
          <div className="mission-title-line">
            <h3 className="mission-title">{mission.title}</h3>
            {status.temporal === "upcoming" && mission.status !== "draft" && (
              <span className="mission-timing">À venir</span>
            )}
          </div>
          <p className="mission-meta">
            <MapPin size={14} aria-hidden="true" />
            {mission.city}
          </p>
          <p className="mission-meta">
            <CalendarDays size={14} aria-hidden="true" />
            {missionSchedule(mission)}
          </p>
          {pay && (
            <p className="mission-meta mission-meta--pay">
              <Coins size={14} aria-hidden="true" />
              {pay}
            </p>
          )}
        </div>
        <div className="mission-foot">
          {score === undefined ? (
            mission.capacity ? (
              mission.capacity.full ? (
                "Tous les postes sont pourvus"
              ) : (
                `${mission.capacity.filled}/${mission.capacity.headcount} poste${mission.capacity.headcount > 1 ? "s" : ""} pourvu${mission.capacity.filled > 1 ? "s" : ""}`
              )
            ) : mission.headcount > 1 ? (
              `${mission.headcount} postes`
            ) : (
              "1 poste"
            )
          ) : (
            <MatchBadge score={score} band={band} bandLabel={bandLabel} />
          )}
          <span className="circle-button" aria-hidden="true">
            {closed ? (
              <Check size={14} strokeWidth={2.5} />
            ) : (
              <ArrowRight size={15} />
            )}
          </span>
        </div>
      </MagicCard>
    </Link>
  );
}
