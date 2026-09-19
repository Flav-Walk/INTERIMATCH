import { useEffect, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  ExternalLink,
  Globe,
  Info,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/session";
import {
  listPublicOffers,
  type PublicJobOffer,
} from "../services/publicOffers";
import { PublicOfferCard } from "../components/public-offers/PublicOfferCard";

function SkeletonGrid() {
  return (
    <div className="mission-grid is-wide" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}

export function WorkerPublicOffers() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<PublicJobOffer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeLocation, setActiveLocation] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");

    void listPublicOffers({
      search: activeSearch || undefined,
      location: activeLocation || undefined,
      page,
      limit: 12,
    })
      .then((res) => {
        if (!live) return;
        setOffers(res.offers);
        setTotal(res.total);
        setTotalPages(res.total_pages);
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
  }, [activeSearch, activeLocation, page]);

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
    setActiveLocation(location.trim());
  }

  function handleReset() {
    setSearch("");
    setLocation("");
    setActiveSearch("");
    setActiveLocation("");
    setPage(1);
  }

  if (!user || user.role !== "worker") return null;

  return (
    <div className="missions-page">
      <div className="page-hero">
        <div className="page-hero__inner">
          <span className="eyeline">
            Espace intérimaire · Données publiques
          </span>
          <h1>Offres France Travail</h1>
          <p className="page-hero__lead">
            Opportunités externes dans l'hôtellerie-restauration issues du
            réseau public France Travail, consultables en complément de vos
            missions InteriMatch.
          </p>
        </div>
      </div>

      <div className="missions-page__body">
        <div className="public-offers-disclaimer" role="note">
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>Source publique externe :</strong> Ces offres proviennent du
            référentiel public France Travail. Elles sont présentées à titre
            informatif et ne font pas l'objet d'un matching automatique, d'une
            candidature directe ni d'une attribution au sein d'InteriMatch.
          </div>
        </div>

        <form className="public-offers-toolbar" onSubmit={handleFilterSubmit}>
          <div className="public-offers-toolbar__search">
            <div className="public-offers-toolbar__input-wrap">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Rechercher par métier, intitulé ou entreprise"
                placeholder="Métier, intitulé, entreprise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="public-offers-toolbar__input-wrap">
              <Globe size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Filtrer par ville ou code postal"
                placeholder="Ville ou code postal (ex. Lyon, 69002)…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <button type="submit" className="button button-small">
              Rechercher
            </button>
            {(activeSearch || activeLocation) && (
              <button
                type="button"
                className="button-ghost button-small"
                onClick={handleReset}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Effacer
              </button>
            )}
          </div>

          {!loading && !error && (
            <div className="public-offers-toolbar__count" role="status">
              <ExternalLink size={14} aria-hidden="true" />
              <span>
                <strong>{total}</strong> offre{total > 1 ? "s" : ""} France
                Travail
              </span>
            </div>
          )}
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!error &&
          (loading ? (
            <>
              <p role="status" className="sr-only">
                Chargement des offres France Travail…
              </p>
              <SkeletonGrid />
            </>
          ) : offers.length > 0 ? (
            <>
              <div className="mission-grid is-wide">
                {offers.map((offer) => (
                  <PublicOfferCard key={offer.id} offer={offer} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  className="public-offers-pagination"
                  aria-label="Pagination des offres"
                >
                  <button
                    type="button"
                    className="button-ghost button-small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </button>
                  <span aria-current="page">
                    Page {page} sur {totalPages}
                  </span>
                  <button
                    type="button"
                    className="button-ghost button-small"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Suivant
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty">
              <BriefcaseBusiness aria-hidden="true" />
              <h2>Aucune offre France Travail ne correspond à vos critères</h2>
              <p>
                {activeSearch || activeLocation
                  ? "Essayez d'élargir votre recherche ou de réinitialiser les filtres."
                  : "Aucune offre externe n'est disponible pour le moment."}
              </p>
              {(activeSearch || activeLocation) && (
                <button type="button" className="button" onClick={handleReset}>
                  Voir toutes les offres France Travail
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
