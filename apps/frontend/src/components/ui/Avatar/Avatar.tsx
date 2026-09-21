/* ══════════════════════════════════════════════════════════════
   INTERIMATCH — Avatar
   Photo ou initiales, tailles sm / md / lg.
   • Sans `src` (ou si l'image échoue) : initiales sur une couleur
     déterministe (--c-avatar-1…4) dérivée du nom
   • Image en loading="lazy" (éco-conception / RGESN)
   • Nom accessible = `name`. Si le nom est déjà écrit à côté, passer
     `decorative` pour ne pas le faire lire deux fois.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import './Avatar.css';

type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Nom complet — sert aux initiales et au nom accessible */
  name:        string;
  /** URL de la photo (WebP recommandé) */
  src?:        string;
  size?:       AvatarSize;
  /** Le nom est déjà affiché à côté : masque l'avatar aux lecteurs d'écran */
  decorative?: boolean;
  className?:  string;
}

const VARIANTS = 4;

/** « Marie Dupont » → « MD » ; « Cher » → « C » ; « » → « ? » */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] ?? '';
  const last  = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

/** 1 à 4 — même nom, même couleur, à chaque rendu */
function getVariant(name: string): number {
  const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (hash % VARIANTS) + 1;
}

export function Avatar({
  name,
  src,
  size = 'md',
  decorative = false,
  className = '',
}: AvatarProps) {
  /* Mémorise l'URL en échec (et non un simple booléen) : si `src` change,
     on retente automatiquement la nouvelle image. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      className={['im-avatar', `im-avatar--${size}`, `im-avatar--v${getVariant(name)}`, className]
        .filter(Boolean)
        .join(' ')}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': name })}
    >
      {showImage ? (
        <img
          className="im-avatar__img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span className="im-avatar__initials" aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}
