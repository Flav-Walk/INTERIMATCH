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

// --- Formatage rémunération ---
function formatPay(amount: string | null, unit: string | null): string | null {
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

function toHHMM(d: Date): string {
  const m = d.getMinutes();
  const h = String(d.getHours()).padStart(2, "0");
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function missionSchedule(mission: Mission): string {
  const start = new Date(mission.starts_at);
  return `${dateFmt.format(start)} · ${toHHMM(start)} – ${toHHMM(new Date(mission.ends_at))}`;
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
  const { label, cls, closed } = STATUS_CONFIG[mission.status];
  const pay = formatPay(mission.pay_amount, mission.pay_unit);
  const seats = Array.from({ length: Math.min(mission.headcount, 3) });

  return (
    <Link
      className={`mission-card${closed ? " is-closed" : ""}`}
      to={`${basePath}/${mission.id}`}
    >
      <div className="mission-media">
        <JobGlyph job={mission.job} />
        <span className={`mission-status ${cls}`}>{label}</span>
        {pendingApplications > 0 && (
          <span className="mission-pending">
            {pendingApplications}
            <span className="sr-only">
              {" "}candidature{pendingApplications > 1 ? "s" : ""} en attente
            </span>
          </span>
        )}
      </div>

      <div className="mission-body">
        <h3 className="mission-title">{mission.title}</h3>
        <p className="mission-meta">{mission.city}</p>
        <p className="mission-meta">{missionSchedule(mission)}</p>
      </div>

      <div className="mission-foot">
        <span className="avatar-stack" aria-hidden="true">
          {seats.map((_, i) => (
            <span key={i} />
          ))}
        </span>
        <span className="mission-pay">
          {score !== undefined ? (
            <MatchBadge score={score} />
          ) : pay !== null ? (
            pay
          ) : mission.headcount > 1 ? (
            `${mission.headcount} postes`
          ) : (
            "1 poste"
          )}
        </span>
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
