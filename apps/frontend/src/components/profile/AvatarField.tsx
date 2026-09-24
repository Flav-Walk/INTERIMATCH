import { useRef, useState, type DragEvent } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  ACCEPTED_AVATAR_TYPES,
  avatarRejectionReason,
  removeAvatar,
  uploadAvatar,
} from "../../services/profile";
import { errorMessage, type User } from "../../services/session";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/cn";

/**
 * Photo de profil : dépôt, aperçu, remplacement, retrait.
 *
 * SOURCE : Aceternity UI — `file-upload`
 * (https://ui.aceternity.com/components/file-upload), récupéré depuis
 * https://ui.aceternity.com/registry/file-upload.json.
 * On en reprend les deux idées qui font la qualité de ce composant : la ZONE
 * ENTIÈRE est une cible de dépôt — pas seulement un petit rectangle tireté — et
 * le survol soulève l'aperçu d'un ressort, ce qui rend la cible évidente avant
 * même de commencer à glisser.
 *
 * CE QUI A ÉTÉ ADAPTÉ, ET POURQUOI C'EST BEAUCOUP.
 * - `react-dropzone` est une dépendance de 15 ko pour trois gestionnaires
 *   d'événements. Le glisser-déposer natif les remplace, et le champ `input`
 *   reste la vraie commande — c'est lui qui rend le dépôt accessible au clavier
 *   et aux technologies d'assistance, ce que la source laisse de côté.
 * - La trame de 451 `<div>` qui sert de fond dans l'original est supprimée. Sur
 *   un portrait de 128 px, c'est 451 nœuds pour une texture invisible.
 * - L'original accumule les fichiers déposés dans une liste. Un profil a UNE
 *   photo : déposer remplace, et l'ancienne disparaît du stockage côté serveur.
 * - L'aperçu est circulaire et montre la photo RÉELLE une fois déposée, pas une
 *   fiche « nom · taille · date de modification ». Ce qu'on vérifie en
 *   déposant un portrait, c'est le cadrage.
 *
 * ÉTATS COUVERTS : vide, survol, glissé en cours, envoi, succès, erreur,
 * remplacement, suppression. C'est la liste exacte que réclame un champ de
 * fichier, et celle que presque aucun champ maison ne tient.
 */
export function AvatarField({
  user,
  onChange,
}: {
  user: User;
  /** Profil renvoyé par le serveur après l'écriture. Jamais recomposé ici. */
  onChange: (updated: User) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const still = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const url = user.profile.avatar_url ?? null;
  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email.slice(0, 2).toUpperCase();

  async function send(file: File | undefined) {
    if (!file) return;
    setError("");
    setDone(false);
    const refusal = avatarRejectionReason(file);
    if (refusal) return setError(refusal);
    setBusy("upload");
    try {
      onChange(await uploadAvatar(file));
      setDone(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
      // Le champ est remis à zéro : sans cela, redéposer le MÊME fichier après
      // une erreur ne déclenche aucun `change`, et l'écran paraît figé.
      if (input.current) input.current.value = "";
    }
  }

  async function clear() {
    setError("");
    setDone(false);
    setBusy("remove");
    try {
      onChange(await removeAvatar());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void send(event.dataTransfer.files[0]);
  }

  return (
    <div
      className={cn(
        "avatar-field group flex flex-col items-center gap-5 rounded-panel border border-dashed p-6 transition-colors sm:flex-row sm:items-center sm:p-7",
        dragging
          ? "border-forest bg-sage-tint"
          : "border-rule-strong bg-paper hover:border-sage",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* ── Aperçu ──────────────────────────────────────────────────────── */}
      <motion.div
        className="avatar-field__preview relative shrink-0"
        animate={
          still ? undefined : { y: dragging ? -6 : 0, scale: dragging ? 1.04 : 1 }
        }
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        <Avatar
          src={url}
          initials={initials}
          size={104}
          className={cn(
            "shadow-raise ring-2",
            url ? "ring-surface" : "ring-rule",
            busy === "upload" && "opacity-60",
          )}
        />
        {busy === "upload" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2
              size={26}
              aria-hidden="true"
              className="animate-spin text-forest"
            />
          </span>
        )}
        {!url && !busy && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-paper bg-forest text-white"
          >
            <Camera size={15} />
          </span>
        )}
      </motion.div>

      {/* ── Commandes ───────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-semibold text-[0.9375rem] text-ink">
          {url ? "Votre photo de profil" : "Ajoutez une photo de profil"}
        </p>
        <p className="mt-1 text-[0.8125rem] text-ink-faint leading-relaxed">
          {url
            ? "Glissez une nouvelle image pour la remplacer."
            : "Glissez une image ici, ou choisissez un fichier. JPEG, PNG ou WebP, 2 Mo maximum."}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          {/*
           * Le `label` COMMANDE le champ, et le champ n'est pas caché par
           * `display: none` mais par `sr-only`. La différence n'est pas
           * théorique : un champ en `display: none` sort de l'ordre de
           * tabulation, et le dépôt devient inatteignable au clavier.
           */}
          <label
            className={cn(
              "im-btn im-btn--sm",
              url ? "im-btn--outline" : "im-btn--primary",
              busy && "pointer-events-none opacity-55",
            )}
          >
            <Upload size={14} aria-hidden="true" />
            {url ? "Remplacer" : "Choisir une photo"}
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept={ACCEPTED_AVATAR_TYPES.join(",")}
              disabled={Boolean(busy)}
              onChange={(event) => void send(event.target.files?.[0])}
            />
          </label>

          {url && (
            <button
              type="button"
              className="im-btn im-btn--sm im-btn--danger"
              disabled={Boolean(busy)}
              onClick={() => void clear()}
            >
              {busy === "remove" ? (
                <Loader2 size={14} aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 size={14} aria-hidden="true" />
              )}
              Retirer
            </button>
          )}
        </div>

        {/* `role="status"` et non `alert` pour le succès : une confirmation
            n'interrompt pas, elle se signale quand le lecteur y arrive. */}
        {error ? (
          <p className="im-error field-error mt-3 justify-center sm:justify-start">
            {error}
          </p>
        ) : done ? (
          <p
            role="status"
            className="form-success mt-3 text-[0.8125rem] font-medium text-forest"
          >
            Photo enregistrée.
          </p>
        ) : (
          <p className="mt-3 text-[0.75rem] text-ink-faint">
            Obligatoire pour postuler : l’établissement décide sur une personne,
            pas sur une ligne de tableau.
          </p>
        )}
      </div>
    </div>
  );
}
