import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  ConciergeBell,
  GlassWater,
  MapPin,
  Users,
  Utensils,
} from "lucide-react";
import type { Mission, MissionStatus } from "../../services/missions";

/**
 * Carte mission de la maquette : bloc média, badge de statut en surimpression,
 * titre, lieu, créneau, puis pied avec l'effectif et la flèche circulaire.
 */

const statusLabels: Record<MissionStatus, string> = {
  draft: "Brouillon",
  open: "À pourvoir",
  filled: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const statusClass: Record<MissionStatus, string> = {
  draft: "is-draft",
  open: "is-open",
  filled: "is-running",
  completed: "is-done",
  cancelled: "is-done",
};

/**
 * Glyphe du métier. Il occupe la place d'une photographie : la maquette prévoit
 * une image, que nous n'avons pas encore. Le cadrage et les proportions sont
 * conservés pour qu'un média réel puisse s'y substituer sans toucher au layout.
 */
function JobGlyph({ job }: { job: string }) {
  if (job.includes("cuisin") || job.includes("chef_de_partie"))
    return <ChefHat aria-hidden="true" />;
  if (job === "barman") return <GlassWater aria-hidden="true" />;
  if (job === "receptionniste" || job === "hote_accueil")
    return <ConciergeBell aria-hidden="true" />;
  if (job === "employe_etage") return <Users aria-hidden="true" />;
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

/**
 * `basePath` : la même carte sert les deux espaces, qui n'ouvrent simplement
 * pas le même détail. Dupliquer le composant pour cette seule différence
 * ferait diverger deux fois la maquette.
 */
export function MissionCard({
  mission,
  basePath = "/company/missions",
}: {
  mission: Mission;
  basePath?: string;
}) {
  const seats = Array.from({ length: Math.min(mission.headcount, 3) });
  return (
    <Link className="mission-card" to={`${basePath}/${mission.id}`}>
      <div className="mission-media">
        <JobGlyph job={mission.job} />
        <span className={"mission-status " + statusClass[mission.status]}>
          {statusLabels[mission.status]}
        </span>
      </div>
      <div className="mission-body">
        <h3 className="mission-title">{mission.title}</h3>
        <p className="mission-meta">
          <MapPin size={14} aria-hidden="true" />
          {mission.city}
        </p>
        <p className="mission-meta">
          <CalendarDays size={14} aria-hidden="true" />
          {missionSchedule(mission)}
        </p>
      </div>
      <div className="mission-foot">
        <span className="avatar-stack" aria-hidden="true">
          {seats.map((_, index) => (
            <span key={index} />
          ))}
        </span>
        {mission.headcount > 1 ? `${mission.headcount} postes` : "1 poste"}
        <span className="circle-button" aria-hidden="true">
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}

export { statusLabels };
