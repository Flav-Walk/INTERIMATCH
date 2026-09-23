import { Link } from "react-router-dom";
import { Building2, MapPin, Clock, ArrowRight, ExternalLink } from "lucide-react";
import type { PublicJobOffer } from "../../services/publicOffers";
import { MagicCard } from "../ui/magic-card";
import { MAGIC_CARD_COLORS } from "../../lib/brand";

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
 */

/*
 * France Travail envoie le salaire en texte brut : « Horaire de 12.31 Euros »,
 * « Mensuel de 1800.00 Euros sur 12 mois ». On le raccourcit en
 * « 12,31 € / h » ou « 1 800 € / mois ». Si le format est inconnu, on
 * affiche le texte d'origine plutôt que de risquer une valeur fausse.
 */
function formatSalary(label: string): string {
  const match = label.match(/^(Horaire|Mensuel|Annuel) de ([\d.,]+) Euros/i);
  if (!match) return label;
  const amount = Number(match[2].replace(",", "."));
  if (Number.isNaN(amount)) return label;
  const unit = { horaire: "h", mensuel: "mois", annuel: "an" }[
    match[1].toLowerCase() as "horaire" | "mensuel" | "annuel"
  ];
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} € / ${unit}`;
}

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
        {/* AUCUNE IMAGE. Une offre France Travail n'en transporte pas, et lui en
            donner une laisserait croire qu'elle vient de l'établissement. */}
        <div className="public-offer-card__header">
          <div className="public-offer-card__badges">
            <span className="badge badge--france-travail">
              <ExternalLink size={12} aria-hidden="true" />
              France Travail
            </span>
            <span className="badge badge--contract">{offer.contract_label}</span>
          </div>
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
              {formatSalary(offer.salary_label)}
            </span>
          ) : (
            <span className="public-offer-card__salary public-offer-card__salary--none">
              Salaire non précisé
            </span>
          )}
          <Link
            to={href}
            className="public-offer-card__cta"
            aria-label={`Voir l’offre : ${offer.title}`}
          >
            Voir l’offre
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </MagicCard>
    </article>
  );
}
