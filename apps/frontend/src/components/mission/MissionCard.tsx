import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChefHat,
  ConciergeBell,
  GlassWater,
  Users,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import type { Mission, MissionStatus } from "../../services/missions";
import { MatchBadge } from "./MatchBadge";
import { StatusBadge } from "../ui/StatusBadge";

type StatusEntry = { label: string; cls: string; closed: boolean };

const STATUS_CONFIG: Record<MissionStatus, StatusEntry> = {
  draft:     { label: "Brouillon", cls: "is-draft",  closed: false },
  open:      { label: "OPEN",      cls: "is-open",   closed: false },
  filled:    { label: "FILLED",    cls: "is-filled", closed: true  },
  completed: { label: "Terminée",  cls: "is-done",   closed: true  },
  cancelled: { label: "Annulée",   cls: "is-done",   closed: true  },
};

// Alias rétrocompatible — utilisé par CompanyMissionDetail
export const statusLabels: Record<MissionStatus, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])
) as Record<MissionStatus, string>;

// --- Glyphe métier ---
function JobGlyph({ job }: { job: string }) {
  const j = job.toLowerCase();
  if (j.includes("chef") || j.includes("cuisin") || j.includes("partie"))
    return <ChefHat aria-hidden="true" />;
  if (j.includes("bar"))
    return <GlassWater aria-hidden="true" />;
  if (j.includes("accueil") || j === "receptionniste")
    return <ConciergeBell aria-hidden="true" />;
  if (j.includes("etage"))
    return <Users aria-hidden="true" />;
  if (j.includes("plongeur"))
    return <UtensilsCrossed aria-hidden="true" />;
  return <Utensils aria-hidden="true" />;
}

// Métier → teinte de la vignette (voir .mission-media--* dans shell.css)
function jobTone(job: string): string {
  const j = job.toLowerCase();
  if (j.includes("chef") || j.includes("cuisin") || j.includes("partie")) return "chef";
  if (j.includes("bar")) return "barman";
  if (j.includes("accueil") || j === "receptionniste") return "reception";
  if (j.includes("plongeur")) return "plongeur";
  if (j.includes("serveur") || j.includes("serveuse")) return "serveur";
  return "default";
}

// --- Formatage rémunération ---
export function formatPay(amount: string | null, unit: string | null): string | null {
  if (!amount || !unit) return null;
  const n = parseFloat(amount);
  if (isNaN(n)) return null;
  const suffix = unit === "hour" ? "€/h" : unit === "day" ? "€/j" : "€";
  return `${n.toFixed(2).replace(".", ",")} ${suffix}`;
}

// --- Formatage planning ---
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

export function toHHMM(d: Date): string {
  const m = d.getMinutes();
  const h = String(d.getHours()).padStart(2, "0");
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function missionSchedule(mission: Mission): string {
  const start = new Date(mission.starts_at);
  return `${dateFmt.format(start)} · ${toHHMM(start)} – ${toHHMM(new Date(mission.ends_at))}`;
}

// --- Moment de la journée ---
// Un service se lit d'abord par son moment (midi, soir, nuit) : la carte le
// dit en toutes lettres, la couleur ne fait que le redire.
export type DayPart = "matin" | "midi" | "soir" | "nuit";

const DAY_PART_LABEL: Record<DayPart, string> = {
  matin: "matin",
  midi: "midi",
  soir: "soir",
  nuit: "nuit",
};

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return "matin";
  if (hour >= 11 && hour < 15) return "midi";
  if (hour >= 15 && hour < 22) return "soir";
  return "nuit";
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(start: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return dayFmt.format(start);
}

const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

/** Portions de la barre de 24 h occupées par le service, en % (deux si le service passe minuit). */
export function shiftSegments(start: Date, end: Date): { left: number; width: number }[] {
  const from = hourOf(start);
  const to = hourOf(end);
  const pct = (h: number) => (h / 24) * 100;
  if (to > from) return [{ left: pct(from), width: pct(to - from) }];
  return [
    { left: pct(from), width: pct(24 - from) },
    { left: 0, width: pct(to) },
  ];
}

export function durationLabel(start: Date, end: Date): string {
  const h = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 2) / 2;
  return `${String(h).replace(".", ",")} h`;
}

// --- Composant ---
export function MissionCard({
  mission,
  basePath = "/company/missions",
  score,
  pendingApplications = 0,
}: {
  mission: Mission;
  basePath?: string;
  score?: number;
  pendingApplications?: number;
}) {
  const { closed } = STATUS_CONFIG[mission.status];
  const pay = formatPay(mission.pay_amount, mission.pay_unit);
  const start = new Date(mission.starts_at);
  const end = new Date(mission.ends_at);
  const part = dayPart(start.getHours());
  const hours = `${toHHMM(start)} – ${toHHMM(end)}`;

  return (
    <Link
      className={`mission-card mission-card--${part}${closed ? " is-closed" : ""}`}
      to={`${basePath}/${mission.id}`}
    >
      <div className="mission-card__top">
        <span className="mission-when">
          {dayLabel(start)} · {DAY_PART_LABEL[part]}
        </span>
        {score !== undefined ? (
          <MatchBadge score={score} />
        ) : (
          <StatusBadge status={mission.status} />
        )}
      </div>

      <div>
        <p className="mission-time">
          {hours}
          <span className="mission-duration">{durationLabel(start, end)}</span>
        </p>
        <div className="shift-bar" role="img" aria-label={`Service de ${hours}`}>
          {shiftSegments(start, end).map((seg, i) => (
            <span
              key={i}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mission-body">
        <span className={`mission-job mission-job--${jobTone(mission.job)}`}>
          <JobGlyph job={mission.job} />
        </span>
        <div>
          <h3 className="mission-title">{mission.title}</h3>
          <p className="mission-meta">
            {mission.city}
            {mission.headcount > 1 && ` · ${mission.headcount} postes`}
          </p>
        </div>
      </div>

      <div className="mission-foot">
        <span className="mission-pay">{pay ?? "Tarif à définir"}</span>
        {pendingApplications > 0 && (
          <span
            className="mission-pending"
            aria-label={`${pendingApplications} candidature${pendingApplications > 1 ? "s" : ""} en attente`}
          >
            {pendingApplications} à traiter
          </span>
        )}
        <span className="circle-button" aria-hidden="true">
          {closed
            ? <Check size={14} strokeWidth={2.5} />
            : <ArrowRight size={15} />
          }
        </span>
      </div>
    </Link>
  );
}

export { STATUS_CONFIG };
