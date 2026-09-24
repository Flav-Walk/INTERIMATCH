import { cn } from "../../lib/cn";

/**
 * Portrait d'un compte.
 *
 * Deux états seulement, et le second n'est pas un pis-aller : les initiales sur
 * un aplat sauge sont un repli ASSUMÉ, pas une silhouette grise. Une icône de
 * bonhomme anonyme répétée sur toute une liste de candidats donne le sentiment
 * que le produit ne connaît personne.
 *
 * `alt=""` sur la photo est délibéré. Le portrait accompagne toujours un nom
 * écrit à côté ; le doubler d'un « Photo de Marie Dupont » ferait entendre deux
 * fois la même personne à une synthèse vocale. Quand le portrait est seul —
 * dans le menu du compte — c'est le conteneur qui porte le libellé.
 */
export function Avatar({
  src,
  initials,
  size = 40,
  tone = "sage",
  className,
}: {
  src?: string | null;
  initials: string;
  size?: number;
  /** `light` : posé sur le bandeau vert, où un aplat sauge disparaîtrait. */
  tone?: "sage" | "light" | "forest";
  className?: string;
}) {
  const tones = {
    sage: "bg-sage-tint text-forest ring-rule",
    light: "bg-white/15 text-white ring-white/25",
    forest: "bg-forest text-white ring-forest-mid",
  };

  return (
    <span
      className={cn(
        "avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1",
        tones[tone],
        className,
      )}
      style={{
        width: size,
        height: size,
        // La taille du texte suit celle du cercle : un ratio fixe évite d'avoir
        // à déclarer une classe par dimension utilisée dans le produit.
        fontSize: Math.round(size * 0.38),
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className="leading-none">
          {initials}
        </span>
      )}
    </span>
  );
}
