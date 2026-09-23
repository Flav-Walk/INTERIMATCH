import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { FALLBACK_HERO_IMAGE } from "../lib/hero-images";

interface PhotoBackdropProps {
  /** Chemin de la photo (dossier public/). */
  src: string;
  /** Cadrage CSS (object-position), pour garder le sujet visible. */
  position?: string;
  /**
   * Sens du voile vert :
   * - "left"   : dense à gauche, sous un texte aligné à gauche (bandeaux) ;
   * - "bottom" : dense en bas, sous un texte posé en bas (page de connexion).
   */
  veil?: "left" | "bottom";
  /** Parallaxe au scroll (inutile dans un panneau qui ne défile pas). */
  parallax?: boolean;
}

/*
 * Fond photo partagé : bandeau des pages internes, connexion, accueil.
 * À placer dans un parent en position: relative + isolation: isolate.
 *
 * Couches, du fond vers l'avant :
 * 1. la photo, avec un zoom lent à l'arrivée (effet « Ken Burns ») et, si
 *    parallax, un décalage vertical plus lent que la page au scroll ;
 * 2. une teinte verte en « soft-light » : toutes les photos prennent la même
 *    couleur, quelle que soit leur source ;
 * 3. un voile vert foncé pour la lisibilité du texte, et un grain léger.
 *
 * Si la photo n'existe pas encore, on bascule sur la photo provisoire.
 * « Réduire les animations » : photo fixe, sans zoom ni parallaxe.
 */
export function PhotoBackdrop({
  src,
  position,
  veil = "left",
  parallax = true,
}: PhotoBackdropProps) {
  const reduceMotion = useReducedMotion();
  const [imageSrc, setImageSrc] = useState(src);

  // Parallaxe : on suit le scroll de la zone, de « haut de l'écran » jusqu'à
  // « complètement sortie par le haut », et on décale la photo de 0 à 18 %.
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const animated = !reduceMotion;

  return (
    <>
      <div ref={ref} className="photo-backdrop" aria-hidden="true">
        <motion.img
          src={imageSrc}
          alt=""
          decoding="async"
          onError={() => setImageSrc(FALLBACK_HERO_IMAGE)}
          style={{ y: animated && parallax ? y : 0, objectPosition: position }}
          initial={animated ? { scale: 1.12 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: 14, ease: "easeOut" }}
        />
      </div>
      <div
        className={`photo-backdrop__veil photo-backdrop__veil--${veil}`}
        aria-hidden="true"
      />
    </>
  );
}
