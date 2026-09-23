import { Link } from "react-router-dom";
import { Building2, MapPin, Clock, ArrowRight, ExternalLink } from "lucide-react";
import type { PublicJobOffer } from "../../services/publicOffers";
import { MagicCard } from "../ui/magic-card";
import { MAGIC_CARD_COLORS } from "../../lib/brand";
import { offerIllustrationFor } from "../../lib/job-photos";

interface PublicOfferCardProps {
  offer: PublicJobOffer;
  basePath?: string;
}

/*
 * Carte allégée : on ne garde que ce qui aide à choisir en 3 secondes.
 *   1. Quoi : la source, le contrat, l'intitulé et l'établissement.
 *   2. Où et quand : la ville et le temps de travail, sur une seule ligne.
 *   3. Combien : le salaire, mis en avant dans le pied de carte.
 * Les compétences, l'expérience demandée et le code ROME restent sur la page
 * de détail (bouton « Voir l'offre »). Avant, on avait jusqu'à 10 pastilles
 * par carte, et les compétences longues débordaient de la carte.
 *
 * Couverture : France Travail ne fournit aucune image. On affiche une photo
 * d'OBJETS du métier (couverts, couteau et planche, ustensiles de bar,
 * cloche et clés), jamais un lieu ni une personne : elle ne peut pas être
 * prise pour une photo de l'établissement (voir lib/job-photos,
 * offerIllustrationFor). Toujours signalée « Illustration ». Le fond vert
 * de la couverture reste visible pendant le chargement de l'image.
 */

/*
 * La ville arrive sous la forme « 69 - LYON 07 » ou « 69 - Lyon 3e
 * Arrondissement ». On retire le numéro de département du début et on
 * repasse les MAJUSCULES en casse normale : « Lyon 07 ».
 */
function formatCity(city: string): string {
  const clean = city.replace(/^\d{2,3}\s*-\s*/, "").trim();
  if (clean !== clean.toUpperCase()) return clean;
  return clean.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
}

export function PublicOfferCard({
  offer,
  basePath = "/worker/public-offers",
}: PublicOfferCardProps) {
  const href = `${basePath}/${offer.id}`;

  return (
    <article
      className="public-offer-card"
      aria-labelledby={`offer-${offer.id}`}
    >
      {/* Même Magic Card que les cartes mission, pour que toutes les cartes
          du site réagissent pareil au survol. */}
      <MagicCard className="card-surface" {...MAGIC_CARD_COLORS}>
        {/* Couverture : photo d'objets du métier, badges en verre par-dessus
            et mention « Illustration ». Image décorative (alt vide). */}
        <div className="public-offer-card__cover">
          <img
            className="public-offer-card__photo"
            src={offerIllustrationFor(offer.title, offer.id).thumb_url}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="photo-illustration-tag">Illustration</span>
          <div className="public-offer-card__badges">
            <span className="badge badge--france-travail">
              <ExternalLink size={12} aria-hidden="true" />
              France Travail
            </span>
            <span className="badge badge--contract">{offer.contract_label}</span>
          </div>
        </div>
        <div className="public-offer-card__header">
          <h2 id={`offer-${offer.id}`} className="public-offer-card__title">
            <Link to={href}>{offer.title}</Link>
          </h2>
          <div className="public-offer-card__company">
            <Building2 size={15} aria-hidden="true" />
            <span>{offer.company_name || "Établissement non communiqué"}</span>
          </div>
        </div>

        {/* Où et quand, en texte simple : plus de pastilles ici. */}
        <p className="public-offer-card__facts">
          <span>
            <MapPin size={14} aria-hidden="true" />
            {formatCity(offer.city)}
          </span>
          {offer.working_time && (
            <span>
              <Clock size={14} aria-hidden="true" />
              {offer.working_time}
            </span>
          )}
        </p>

        <div className="public-offer-card__footer">
          {offer.salary_label ? (
            <span
              className="public-offer-card__salary"
              title={offer.salary_label}
            >
              {offer.salary_label}
            </span>
          ) : (
            <span className="public-offer-card__salary public-offer-card__salary--none">
              Salaire non précisé
            </span>
          )}
          <Link className="public-offer-card__cta" to={href}>
            Consulter l’offre
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </MagicCard>
    </article>
  );
}
