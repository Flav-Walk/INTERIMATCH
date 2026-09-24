import type { MouseEvent, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { heroImageFor } from "../lib/hero-images";
import { PhotoBackdrop } from "./PhotoBackdrop";

interface HeroBannerProps {
  eyeline?: string;
  title: string;
  subtitle?: string;
  /** Conservé pour ne pas modifier les pages : Matchy n'est plus affiché
   *  dans le bandeau. */
  mascotPose?: "dashboard" | "missions" | "profile";
  action?: ReactNode;
  gauge?: ReactNode;
  compact?: boolean;
}

/*
 * Bandeau en haut des pages (utilisé sur 8 pages, AUCUNE n'a été modifiée :
 * les props restent les mêmes).
 *
 * Ce qui bouge, dans l'ordre d'apparition :
 * 1. La photo de fond (composant PhotoBackdrop) arrive avec un zoom lent,
 *    puis descend un peu moins vite que la page au scroll (parallaxe).
 * 2. Le titre apparaît mot par mot, chaque mot sortant d'un flou (même
 *    principe que le Blur Fade de Magic UI, appliqué mot à mot).
 * 3. Le sous-titre, le bouton et la jauge suivent en fondu.
 * 4. Sur le grand bandeau (pas en mode compact), le slogan manuscrit se
 *    dévoile de gauche à droite, puis son trait de soulignement se dessine.
 * 5. Un halo lumineux suit la souris sur tout le bandeau (même idée que le
 *    Spotlight d'Aceternity UI), sans re-render React : on met à jour deux
 *    variables CSS (--mx, --my) lues par un dégradé dans brand.css.
 *
 * Matchy n'est plus dans le bandeau : le bandeau photo se suffit à lui-même.
 *
 * « Réduire les animations » activé : tout est affiché directement, fixe.
 */

// Courbe d'accélération douce utilisée partout dans le bandeau.
const EASE = [0.22, 1, 0.36, 1] as const;

// Le titre : un conteneur qui lance ses mots l'un après l'autre (stagger).
const titleVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

// Chaque mot : flou et un peu plus bas au départ, net et à sa place à la fin.
const wordVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE },
  },
};

export function HeroBanner({
  eyeline,
  title,
  subtitle,
  action,
  gauge,
  compact = false,
}: HeroBannerProps) {
  const reduceMotion = useReducedMotion();
  const { pathname } = useLocation();
  const image = heroImageFor(pathname);

  // Petit utilitaire : fondu qui démarre après `delay` secondes.
  const fadeIn = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        };

  // 5. Halo qui suit la souris : on écrit la position dans deux variables CSS.
  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const words = title.split(" ");
  const afterTitle = 0.2 + words.length * 0.06;

  return (
    <section
      onMouseMove={handleMouseMove}
      className={`brand-hero brand-hero--photo${compact ? " brand-hero--compact" : ""}`}
    >
      {/* 1. Photo de fond + voile vert (décoratifs). La clé force une
          nouvelle photo quand on change de rubrique. */}
      <PhotoBackdrop key={image.src} src={image.src} position={image.position} />

      <div className="brand-hero__copy">
        {/* Étiquette : un trait orange puis le texte (voir brand.css). Plus de
            pilule ni de pastille qui pulse : retour de revue « trop IA ». */}
        {eyeline && (
          <motion.span className="brand-hero__eyeline" {...fadeIn(0)}>
            {eyeline}
          </motion.span>
        )}

        {/* 2. Titre mot par mot. aria-label garde une phrase entière pour
            les lecteurs d'écran, les mots découpés sont masqués. */}
        <motion.h1
          aria-label={title}
          variants={titleVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              aria-hidden="true"
              className="brand-hero__word"
              variants={wordVariants}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </motion.h1>

        {/* 3. Le reste suit le titre. */}
        {subtitle && <motion.p {...fadeIn(afterTitle)}>{subtitle}</motion.p>}
        {action && (
          <motion.div className="brand-hero__action" {...fadeIn(afterTitle + 0.1)}>
            {action}
          </motion.div>
        )}
      </div>

      {gauge && (
        <motion.div className="brand-hero__gauge" {...fadeIn(afterTitle + 0.15)}>
          {gauge}
        </motion.div>
      )}

      {/* 4. Slogan manuscrit, seulement sur le grand bandeau. */}
      {!compact && (
        <div className="brand-hero__slogan" aria-hidden="true">
          <motion.span
            initial={reduceMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 1.4, delay: 0.7, ease: "easeInOut" }}
          >
            Les bonnes personnes,
            <br />
            au bon moment.
          </motion.span>
          <svg viewBox="0 0 120 14" className="brand-hero__swoosh">
            <motion.path
              d="M2 10 C 30 3, 70 2, 118 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 2.1, ease: "easeOut" }}
            />
          </svg>
        </div>
      )}
    </section>
  );
}
