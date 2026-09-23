import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import type { MissionMedia } from "../../services/missions";
import { UnsplashCredit } from "../mission/MissionPhotoField";
import { EASE } from "../../lib/motion";

interface Chip {
  icon: ReactNode;
  label: string;
}

/*
 * Grande photo d'une section de l'accueil (salle, cuisine…), à côté du texte.
 *
 * Motion :
 * 1. Quand elle entre à l'écran, la photo se dévoile de bas en haut
 *    (clip-path) tout en dézoomant légèrement.
 * 2. Au scroll, l'image glisse un peu moins vite que son cadre (parallaxe).
 * 3. Deux pastilles en verre arrivent ensuite, puis flottent doucement.
 *
 * C'est une photo d'illustration (bibliothèque Unsplash) : le crédit du
 * photographe est affiché dessous, comme partout ailleurs sur le site.
 */
export function PathPhoto({
  photo,
  chips,
  tone = "forest",
}: {
  photo: MissionMedia;
  chips: Chip[];
  tone?: "forest" | "orange";
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Parallaxe : de -6 % à +6 % pendant que la photo traverse l'écran.
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  const inView = reduceMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, margin: "0px 0px -80px 0px" },
      };

  return (
    <motion.figure
      ref={ref}
      className={`path-photo path-photo--${tone}`}
      {...inView}
    >
      <motion.div
        className="path-photo__frame"
        variants={{
          hidden: { clipPath: "inset(100% 0% 0% 0% round 24px)" },
          visible: {
            clipPath: "inset(0% 0% 0% 0% round 24px)",
            transition: { duration: 1.1, ease: EASE },
          },
        }}
      >
        <motion.img
          src={photo.url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ y: reduceMotion ? 0 : y }}
          variants={{
            hidden: { scale: 1.15 },
            visible: { scale: 1, transition: { duration: 1.6, ease: EASE } },
          }}
        />
      </motion.div>

      {/* Pastilles en verre : arrivent après la photo, puis flottent. */}
      {chips.map((chip, index) => (
        <motion.span
          key={chip.label}
          className={`path-photo__chip path-photo__chip--${index + 1}`}
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.6, ease: EASE, delay: 0.7 + index * 0.2 },
            },
          }}
        >
          <motion.span
            className="path-photo__chip-inner"
            animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
            transition={{
              duration: 4 + index,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5 + index * 0.4,
            }}
          >
            {chip.icon}
            {chip.label}
          </motion.span>
        </motion.span>
      ))}

      <figcaption>
        <UnsplashCredit media={photo} />
      </figcaption>
    </motion.figure>
  );
}
