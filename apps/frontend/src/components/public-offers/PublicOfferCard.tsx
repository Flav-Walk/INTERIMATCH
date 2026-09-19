import { Link } from "react-router-dom";
import {
  Building2,
  MapPin,
  Coins,
  GraduationCap,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { PublicJobOffer } from "../../services/publicOffers";

interface PublicOfferCardProps {
  offer: PublicJobOffer;
  basePath?: string;
}

export function PublicOfferCard({
  offer,
  basePath = "/worker/public-offers",
}: PublicOfferCardProps) {
  const visibleSkills = offer.skills.slice(0, 3);
  const remainingSkills = offer.skills.length - visibleSkills.length;

  return (
    <article
      className="public-offer-card"
      aria-labelledby={`offer-${offer.id}`}
    >
      <div className="public-offer-card__header">
        <div className="public-offer-card__badges">
          <span className="badge badge--france-travail">
            <ExternalLink size={12} aria-hidden="true" />
            France Travail
          </span>
          <span className="badge badge--contract">{offer.contract_label}</span>
        </div>
        <h2 id={`offer-${offer.id}`} className="public-offer-card__title">
          <Link to={`${basePath}/${offer.id}`}>{offer.title}</Link>
        </h2>
        <div className="public-offer-card__company">
          <Building2 size={15} aria-hidden="true" />
          <span>{offer.company_name || "Établissement non communiqué"}</span>
        </div>
      </div>

      <div className="public-offer-card__meta">
        <span className="public-offer-meta-chip">
          <MapPin size={13} aria-hidden="true" />
          {offer.postal_code ? `${offer.postal_code} ` : ""}
          {offer.city}
        </span>
        {offer.working_time && (
          <span className="public-offer-meta-chip">
            <Clock size={13} aria-hidden="true" />
            {offer.working_time}
          </span>
        )}
        {offer.salary_label && (
          <span className="public-offer-meta-chip public-offer-meta-chip--salary">
            <Coins size={13} aria-hidden="true" />
            {offer.salary_label}
          </span>
        )}
        {offer.experience_label && (
          <span className="public-offer-meta-chip">
            <GraduationCap size={13} aria-hidden="true" />
            {offer.experience_label}
          </span>
        )}
      </div>

      {visibleSkills.length > 0 && (
        <div className="public-offer-card__skills" aria-label="Compétences">
          {visibleSkills.map((s) => (
            <span
              key={s.name}
              className={`badge ${s.required ? "badge--required" : ""}`}
            >
              {s.name}
            </span>
          ))}
          {remainingSkills > 0 && (
            <span className="badge badge--more">+{remainingSkills}</span>
          )}
        </div>
      )}

      <div className="public-offer-card__footer">
        <span className="public-offer-card__rome quiet">
          ROME {offer.rome_code} · {offer.rome_label}
        </span>
        <Link
          to={`${basePath}/${offer.id}`}
          className="button-ghost button-small public-offer-card__cta"
        >
          Consulter l’offre
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
