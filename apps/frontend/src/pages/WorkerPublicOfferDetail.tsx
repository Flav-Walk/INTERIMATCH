import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { cascade, revealOnScroll, rise } from "../lib/motion";
import { offerIllustrationFor } from "../lib/job-photos";
import { UnsplashCredit } from "../components/mission/MissionPhotoField";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import {
  getPublicOffer,
  safeExternalUrl,
  type PublicJobOffer,
} from "../services/publicOffers";
import { usePageSeo } from "../hooks/usePageSeo";

function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden="true">
      <div className="detail-skeleton__hero" />
      <div className="detail-skeleton__body">
        <div className="detail-skeleton__main">
          <div className="detail-skeleton__card" />
          <div className="detail-skeleton__card" />
        </div>
        <div className="detail-skeleton__rail" />
      </div>
    </div>
  );
}

export function WorkerPublicOfferDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  // Avant les « return » anticipés : un hook est toujours appelé.
  const reduceMotion = useReducedMotion();
  const [offer, setOffer] = useState<PublicJobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Titre d'onglet propre à la page (RGAA 8.6) ; espace privé non indexé.
  usePageSeo({
    title: `${offer?.title ?? "Offre"} · Offre France Travail · InteriMatch`,
    description: "Détail d’une offre publique France Travail.",
    robots: "noindex,nofollow",
  });
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");

    void getPublicOffer(id)
      .then((res) => {
        if (!live) return;
        setOffer(res);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [id]);

  if (!user || user.role !== "worker") return null;

  if (loading) {
    return (
      <>
        <p role="status" className="sr-only">
          Chargement de l'offre France Travail…
        </p>
        <DetailSkeleton />
      </>
    );
  }

  if (error || !offer) {
    return (
      <div className="detail-error-wrap">
        <div className="detail-error-card">
          <p className="form-error" role="alert">
            {error || "Cette offre France Travail n’est plus disponible."}
          </p>
          <Link className="button-ghost" to="/worker/public-offers">
            <ArrowLeft size={15} aria-hidden="true" />
            Revenir aux offres France Travail
          </Link>
        </div>
      </div>
    );
  }

  const requiredSkills = offer.skills.filter((s) => s.required);
  const desiredSkills = offer.skills.filter((s) => !s.required);
  const sourceUrl = safeExternalUrl(offer.source_url);
  // France Travail ne fournit pas d'image : photo d'OBJETS du métier, jamais
  // un lieu ni une personne, toujours signalée « Photo d'illustration » et
  // créditée (voir lib/job-photos, offerIllustrationFor).
  const media = offerIllustrationFor(offer.title, offer.id);
  // « Réduire les animations » : tout s'affiche directement.
  const reveal = reduceMotion ? {} : revealOnScroll;

  return (
    <div className="detail-page">
      <div className="detail-hero detail-hero--offer">
        {/* Photo d'objets du métier en fond, avec un zoom lent à l'arrivée. */}
        <figure className="detail-hero__photo">
          <motion.img
            src={media.url}
            alt=""
            decoding="async"
            initial={reduceMotion ? false : { scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 14, ease: "easeOut" }}
          />
          <figcaption>
            <span className="photo-illustration-tag is-inline">
              Photo d’illustration
            </span>
            <UnsplashCredit media={media} />
          </figcaption>
        </figure>
        {/* Le contenu arrive en cascade : retour, titre, infos. */}
        <motion.div
          className="detail-hero__inner"
          variants={cascade}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.div variants={rise}>
            <Link className="detail-back" to="/worker/public-offers">
              <ArrowLeft size={15} aria-hidden="true" />
              Offres France Travail
            </Link>
          </motion.div>

          <motion.div className="detail-hero__head" variants={rise}>
            <div className="detail-hero__title-wrap">
              <div className="public-offer-external-banner">
                <ExternalLink size={14} aria-hidden="true" />
                <span>Offre externe France Travail · Réseau public</span>
              </div>
              <h1 className="detail-hero__title">{offer.title}</h1>
              <p className="detail-hero__company">
                <span>
                  {offer.company_name || "Établissement non communiqué"}
                </span>
                <span className="detail-hero__sector">
                  {" "}
                  · ROME {offer.rome_code} ({offer.rome_label})
                </span>
              </p>
            </div>
          </motion.div>

          <motion.div className="detail-hero__meta detail-grid" variants={rise}>
            <span className="detail-meta-chip">
              {offer.postal_code ? `${offer.postal_code} ` : ""}
              {offer.city}
            </span>
            <span className="detail-meta-chip">{offer.contract_label}</span>
            {offer.working_time && (
              <span className="detail-meta-chip">{offer.working_time}</span>
            )}
            {offer.salary_label && (
              <span className="detail-meta-chip detail-meta-chip--pay">
                {offer.salary_label}
              </span>
            )}
            {offer.experience_label && (
              <span className="detail-meta-chip">{offer.experience_label}</span>
            )}
            {offer.positions > 1 && (
              <span className="detail-meta-chip">{offer.positions} postes</span>
            )}
          </motion.div>
        </motion.div>
      </div>

      <div className="detail-body">
        <div className="detail-layout">
          <div className="detail-main">
            {offer.description && (
              <motion.section
                className="detail-card"
                aria-labelledby="desc-title"
                variants={rise}
                {...reveal}
              >
                <h2 id="desc-title" className="detail-card__title">
                  Description du poste
                </h2>
                <div className="public-offer-description-text">
                  {offer.description}
                </div>
              </motion.section>
            )}

            <section className="detail-card" aria-labelledby="skills-title">
              <h2 id="skills-title" className="detail-card__title">
                Compétences mentionnées
              </h2>

              {requiredSkills.length > 0 && (
                <div className="detail-skills-group">
                  <p className="detail-skills-label">
                    Exigées
                    <span className="detail-skills-sub">
                      {" "}
                      — mentionnées comme indispensables sur l'offre
                    </span>
                  </p>
                  <div className="skill-options">
                    {requiredSkills.map((s) => (
                      <span className="badge badge--required" key={s.name}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {desiredSkills.length > 0 && (
                <div className="detail-skills-group">
                  <p className="detail-skills-label">
                    Souhaitées
                    <span className="detail-skills-sub">
                      {" "}
                      — appréciées pour le poste
                    </span>
                  </p>
                  <div className="skill-options">
                    {desiredSkills.map((s) => (
                      <span className="badge" key={s.name}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {offer.skills.length === 0 && (
                <p className="quiet">
                  Aucune compétence spécifique n’a été listée sur cette offre.
                </p>
              )}
            </section>

            {offer.professional_qualities &&
              offer.professional_qualities.length > 0 && (
                <section
                  className="detail-card"
                  aria-labelledby="qualities-title"
                >
                  <h2 id="qualities-title" className="detail-card__title">
                    Qualités professionnelles recherchées
                  </h2>
                  <div className="steps-list">
                    {offer.professional_qualities.map((q) => (
                      <div
                        key={`${q.label}\u0000${q.description ?? ""}`}
                        style={{ marginBottom: "12px" }}
                      >
                        <strong>{q.label}</strong>
                        {q.description && (
                          <p
                            className="quiet"
                            style={{ margin: "4px 0 0 0", fontSize: "13px" }}
                          >
                            {q.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </div>

          <aside className="detail-rail" aria-label="Origine de l'offre">
            <section className="detail-card" aria-labelledby="origin-title">
              <h2 id="origin-title" className="detail-card__title">
                Origine de l'offre
              </h2>

              <p className="quiet" style={{ lineHeight: 1.5 }}>
                Cette offre est diffusée par le service public de l'emploi{" "}
                <strong>France Travail</strong> (identifiant :{" "}
                {offer.external_id}
                ).
              </p>

              <div
                className="public-offers-disclaimer"
                style={{ margin: "16px 0", padding: "12px" }}
              >
                <div>
                  Les candidatures et prises de contact s'effectuent directement
                  sur la plateforme d'origine. Cette offre ne fait pas l'objet
                  d'une attribution InteriMatch.
                </div>
              </div>

              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--primary public-offer-rail-cta"
                >
                  <span>
                    Postuler sur France Travail
                    <span className="sr-only"> (nouvelle fenêtre)</span>
                  </span>
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ) : (
                <p className="quiet" style={{ fontStyle: "italic" }}>
                  Lien web direct non communiqué sur cette fiche.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
