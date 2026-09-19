import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  Coins,
  ConciergeBell,
  GlassWater,
  MapPin,
  Users,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import {
  missionStatePresentation,
  type Mission,
} from "../../services/missions";
import { MatchBadge } from "./MatchBadge";

/**
 * Carte mission : bloc média, badge d'état en surimpression, titre, lieu,
 * créneau, puis pied avec l'effectif et la flèche circulaire.
 */

/**
 * Glyphe du métier. Il occupe la place d'une photographie, que nous n'avons pas
 * encore. Le cadrage et les proportions sont conservés pour qu'un média réel
 * puisse s'y substituer sans toucher au layout.
 */
function JobGlyph({ job }: { job: string }) {
  const value = job.toLowerCase();
  if (value.includes("cuisin") || value.includes("chef"))
    return <ChefHat aria-hidden="true" />;
  if (value.includes("bar")) return <GlassWater aria-hidden="true" />;
  if (value.includes("reception") || value.includes("accueil"))
    return <ConciergeBell aria-hidden="true" />;
  if (value.includes("etage")) return <Users aria-hidden="true" />;
  if (value.includes("plongeur")) return <UtensilsCrossed aria-hidden="true" />;
  return <Utensils aria-hidden="true" />;
}

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

/** « 12 oct. 2026 · 18h – 02h » */
export function missionSchedule(mission: Mission) {
  const start = new Date(mission.starts_at);
  return `${dayMonth.format(start)} · ${frenchHour(start)} – ${frenchHour(new Date(mission.ends_at))}`;
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
  const seats = Array.from({ length: Math.min(mission.headcount, 3) });
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
      <div className="mission-media">
        <JobGlyph job={mission.job} />
        <span className={`mission-status ${status.className}`}>
          {status.label}
        </span>
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
        <span className="avatar-stack" aria-hidden="true">
          {seats.map((_, index) => (
            <span key={index} />
          ))}
        </span>
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
    </Link>
  );
}
