import { Link } from "react-router-dom";
import { Repeat } from "lucide-react";
import type { Mission } from "../../services/missions";
import { formatPay, toHHMM } from "./MissionCard";

/**
 * « Relancer un besoin » : les services déjà pourvus, à republier en un geste.
 * Le formulaire de création reprend leurs informations (voir republishedForm).
 */
export function RepublishList({ missions }: { missions: Mission[] }) {
  if (missions.length === 0) return null;
  return (
    <section aria-labelledby="rebook-title">
      <div className="dashboard-section-head">
        <h2 id="rebook-title">Relancer un besoin</h2>
      </div>
      <ul className="rebook-list">
        {missions.map((m) => {
          const pay = formatPay(m.pay_amount, m.pay_unit);
          return (
            <li key={m.id} className="rebook-row">
              <div>
                <p className="rebook-title">{m.title}</p>
                <p className="rebook-meta">
                  {[
                    m.city,
                    `${toHHMM(new Date(m.starts_at))} – ${toHHMM(new Date(m.ends_at))}`,
                    pay,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Link
                className="rebook-action"
                to={`/company/missions/new?from=${encodeURIComponent(m.id)}`}
                aria-label={`Republier ${m.title}`}
              >
                <Repeat size={14} aria-hidden="true" />
                Republier
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
