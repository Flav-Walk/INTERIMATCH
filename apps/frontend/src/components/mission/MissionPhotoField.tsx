import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Images, RefreshCw, Search, Upload, X } from "lucide-react";
import { errorMessage } from "../../services/session";
import {
  ACCEPT_ATTRIBUTE,
  rejectionReason,
  searchUnsplash,
  unsplashUnavailable,
  uploadMissionPhoto,
  UNSPLASH_HOME,
  type UnsplashPhoto,
} from "../../services/missionMedia";
import type { MissionMedia } from "../../services/missions";

/**
 * Crédit d'une photo Unsplash.
 *
 * Leurs conditions demandent « Photo by <auteur> on Unsplash », l'auteur et
 * Unsplash étant tous deux cliquables et porteurs des paramètres de
 * référencement. Le lien de l'auteur arrive déjà complété par le serveur ; la
 * mention n'est donc pas décorative, elle fait partie du droit d'usage.
 */
export function UnsplashCredit({
  media,
  className = "photo-credit",
}: {
  media: MissionMedia;
  className?: string;
}) {
  if (media.provider !== "unsplash") return null;
  return (
    <p className={className}>
      Photo par{" "}
      <a href={media.author_url} target="_blank" rel="noopener noreferrer">
        {media.author_name}
      </a>{" "}
      sur{" "}
      <a href={UNSPLASH_HOME} target="_blank" rel="noopener noreferrer">
        Unsplash
      </a>
    </p>
  );
}

/** Suggestions d'un secteur où l'on ne cherche pas « photo » mais un poste. */
const SUGGESTIONS = [
  "restaurant",
  "waiter",
  "professional kitchen",
  "bartender",
  "hotel reception",
  "hospitality",
];

function UnsplashLibrary({
  onPick,
  onClose,
}: {
  onPick: (photo: UnsplashPhoto) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("restaurant");
  const [submitted, setSubmitted] = useState("restaurant");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  // `<dialog>` natif : le piège du focus, Échap et l'inertie de la page sont
  // alors tenus par le navigateur, sans gestionnaire de touches à maintenir.
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void searchUnsplash(submitted)
      .then((found) => {
        if (!live) return;
        setPhotos(found.results);
        setUnavailable(false);
      })
      .catch((e) => {
        if (!live) return;
        setPhotos([]);
        setUnavailable(unsplashUnavailable(e));
        setError(errorMessage(e));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [submitted]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value) setSubmitted(value);
  }

  /**
   * Rendu à la racine du document, et non là où le composant est écrit.
   *
   * Le champ photo vit à l'intérieur du formulaire de la mission. Un `<form>`
   * de recherche posé là serait un formulaire imbriqué — interdit par HTML, et
   * signalé comme tel par React. Le portail sort le dialogue de cet arbre ;
   * `<dialog>` étant modal, sa position dans le document ne change rien à son
   * affichage, à son piège de focus ni à son comportement au clavier.
   */
  return createPortal(
    <dialog
      className="photo-library"
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="photo-library__head">
        <h2 id={titleId}>Bibliothèque de photos</h2>
        <button
          type="button"
          className="photo-library__close"
          onClick={() => dialog.current?.close()}
        >
          <X size={16} aria-hidden="true" />
          Fermer
        </button>
      </div>

      <form className="photo-library__search" onSubmit={submit} role="search">
        <label htmlFor="unsplash-query" className="sr-only">
          Rechercher une photo
        </label>
        <div className="photo-library__input">
          <Search size={16} aria-hidden="true" />
          <input
            id="unsplash-query"
            type="search"
            value={query}
            placeholder="restaurant, cuisine, réception…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button type="submit" className="button button-small">
          Rechercher
        </button>
      </form>

      <div className="photo-library__suggestions">
        {SUGGESTIONS.map((term) => (
          <button
            key={term}
            type="button"
            className="photo-chip"
            aria-pressed={submitted === term}
            onClick={() => {
              setQuery(term);
              setSubmitted(term);
            }}
          >
            {term}
          </button>
        ))}
      </div>

      {loading && (
        <p role="status" className="quiet">
          Recherche en cours…
        </p>
      )}

      {!loading && error && (
        <div className="photo-library__error" role="alert">
          <p>{error}</p>
          {unavailable && (
            <p className="quiet">
              Vous pouvez importer une photo depuis votre ordinateur : fermez
              cette fenêtre et choisissez « Importer une photo ».
            </p>
          )}
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <p className="quiet" role="status">
          Aucune photo pour « {submitted} ». Essayez un autre mot, en anglais de
          préférence.
        </p>
      )}

      {photos.length > 0 && (
        <ul className="photo-grid">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                className="photo-grid__pick"
                onClick={() => {
                  onPick(photo);
                  dialog.current?.close();
                }}
              >
                {/* URL d'Unsplash, servie telle quelle : leurs conditions
                    imposent d'afficher l'image depuis leur CDN. */}
                <img src={photo.thumb_url} alt="" loading="lazy" />
                <span className="photo-grid__label">
                  Choisir la photo de {photo.author_name}
                  {photo.alt ? ` — ${photo.alt}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="photo-library__legal quiet">
        Photos fournies par{" "}
        <a href={UNSPLASH_HOME} target="_blank" rel="noopener noreferrer">
          Unsplash
        </a>
        . L’auteur est crédité sur la mission.
      </p>
    </dialog>,
    document.body,
  );
}

/**
 * Photo de la mission : import depuis l'ordinateur, ou choix dans la
 * bibliothèque. Aucune troisième voie, et aucune sélection automatique —
 * l'établissement décide de l'image qui le représente.
 */
export function MissionPhotoField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: MissionMedia | null;
  onChange: (media: MissionMedia | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const errorId = useId();
  const message = uploadError || error;

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const refused = rejectionReason(file);
    if (refused) {
      setUploadError(refused);
      return;
    }
    setUploadError("");
    setBusy(true);
    try {
      onChange(await uploadMissionPhoto(file));
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setBusy(false);
      // Réinitialisé pour que reprendre le MÊME fichier après une erreur
      // relance bien un changement.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="photo-field">
      {/* Pas de titre ici : la légende du bloc le porte déjà, et le répéter
          ferait lire deux fois la même chose à un lecteur d'écran. */}
      <p className="quiet photo-field__hint">
        Elle illustre votre annonce auprès des intérimaires. Importez la vôtre,
        ou choisissez-en une dans la bibliothèque.
      </p>

      {value ? (
        <figure className="photo-field__preview">
          <img
            src={value.url}
            alt={value.alt ?? "Photo choisie pour cette mission"}
          />
          <figcaption>
            <UnsplashCredit media={value} />
            <span className="quiet">
              {value.provider === "upload"
                ? "Photo importée par votre établissement."
                : "Photo de la bibliothèque Unsplash."}
            </span>
          </figcaption>
        </figure>
      ) : (
        <p className="photo-field__empty quiet">
          <ImagePlus size={18} aria-hidden="true" />
          Aucune photo pour l’instant.
        </p>
      )}

      {message && (
        <p className="form-error" role="alert" id={errorId}>
          {message}
        </p>
      )}

      <div className="photo-field__actions">
        <label className="secondary-button photo-field__upload">
          {value ? (
            <RefreshCw size={15} aria-hidden="true" />
          ) : (
            <Upload size={15} aria-hidden="true" />
          )}
          {busy
            ? "Envoi en cours…"
            : value
              ? "Remplacer par un fichier"
              : "Importer une photo"}
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept={ACCEPT_ATTRIBUTE}
            disabled={disabled || busy}
            aria-describedby={message ? errorId : undefined}
            onChange={(event) => void pickFile(event.target.files?.[0])}
          />
        </label>

        <button
          type="button"
          className="secondary-button"
          disabled={disabled || busy}
          onClick={() => setLibraryOpen(true)}
        >
          <Images size={15} aria-hidden="true" />
          {value ? "Choisir une autre photo" : "Choisir dans la bibliothèque"}
        </button>
      </div>

      {libraryOpen && (
        <UnsplashLibrary
          onClose={() => setLibraryOpen(false)}
          onPick={(photo) => {
            // Seul l'identifiant part : le serveur résout la photo chez
            // Unsplash, déclenche le comptage d'usage exigé par leurs
            // conditions, et en rapporte l'attribution.
            onChange({
              provider: "unsplash",
              external_id: photo.id,
              url: photo.preview_url,
              thumb_url: photo.thumb_url,
              author_name: photo.author_name,
              author_url: photo.author_url,
              ...(photo.alt ? { alt: photo.alt } : {}),
            });
            setUploadError("");
          }}
        />
      )}
    </div>
  );
}
