import { Link } from "react-router-dom";
import { Building2, ArrowRight, ExternalLink } from "lucide-react";
import type { PublicJobOffer } from "../../services/publicOffers";

interface PublicOfferCardProps {
  offer: PublicJobOffer;
  basePath?: string;
}

/**
 * Carte d'offre France Travail.
 *
 * Refonte : on choisit une offre en trois secondes. La carte répond dans
 * l'ordre à « quoi » (source, contrat, intitulé, établissement), « où et
 * quand » (sur une seule ligne) et « combien » (en pied de carte). Les
 * compétences et le code ROME détaillé restent sur la fiche : jusqu'à huit
 * pastilles par carte rendaient la liste illisible.
 */
export function PublicOfferCard({
  offer,
  basePath = "/worker/public-offers",
}: PublicOfferCardProps) {
  const place = [offer.postal_code, offer.city].filter(Boolean).join(" ");
  const facts = [place, offer.working_time].filter(Boolean);

  return (
    <article
      className="public-offer-card"
      aria-labelledby={`offer-${offer.id}`}
    >
      {/* AUCUNE IMAGE. Une offre France Travail n'en transporte pas, et lui en
          donner une — locale ou Unsplash — laisserait croire qu'elle vient de
          l'établissement ou de la source. La carte se tient par son badge, son
          intitulé et ses informations. */}
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

      <p className="public-offer-card__company">
        <Building2 size={15} aria-hidden="true" />
        <span>{offer.company_name || "Établissement non communiqué"}</span>
      </p>

      {facts.length > 0 && (
        <p className="public-offer-card__facts">
          {facts.map((fact, index) => (
            <span key={fact}>
              {index > 0 && (
                <span className="public-offer-card__sep" aria-hidden="true">
                  ·
                </span>
              )}
              {fact}
            </span>
          ))}
        </p>
      )}

      {offer.experience_label && (
        <p className="public-offer-card__experience">
          {offer.experience_label}
        </p>
      )}

      <div className="public-offer-card__footer">
        <p className="public-offer-card__salary">
          {offer.salary_label ?? (
            <span className="quiet">Salaire non communiqué</span>
          )}
        </p>
        <Link
          to={`${basePath}/${offer.id}`}
          className="public-offer-card__cta"
        >
          Consulter l’offre
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
