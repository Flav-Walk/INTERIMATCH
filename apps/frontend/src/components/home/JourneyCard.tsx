import { CalendarCheck, Check, Sparkles, UserRound } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

/*
 * Carte « parcours » de l'accueil, à la place de Matchy.
 * Trois étapes qui s'allument l'une après l'autre, reliées par un trait qui
 * se remplit. Ce n'est pas une donnée réelle : c'est une illustration du
 * parcours décrit plus bas dans la page (« Trois étapes, sans détour »).
 */

const STEPS = [
  {
    icon: UserRound,
    title: "Profil complété",
    desc: "Métier, compétences et disponibilités",
  },
  {
    icon: Sparkles,
    title: "Missions proposées",
    desc: "Rapprochées de votre zone",
  },
  {
    icon: CalendarCheck,
    title: "Mission confirmée",
    desc: "Par l’établissement",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// La carte, puis ses étapes une par une (stagger).
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: EASE,
      delay: 0.3,
      delayChildren: 0.7,
      staggerChildren: 0.45,
    },
  },
};

const stepVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
};

// La coche apparaît juste après son étape, avec un petit rebond.
const checkVariants: Variants = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 15, delay: 0.25 },
  },
};

export function JourneyCard() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="journey-card"
      variants={cardVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <p className="journey-card__head">
        <strong>InteriMatch vous accompagne</strong>
        <span>Du profil jusqu’à la mission confirmée.</span>
      </p>

      <ol className="journey-card__steps">
        {/* Trait vertical qui se remplit de haut en bas derrière les étapes. */}
        <motion.span
          className="journey-card__rail"
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.4, delay: 0.9, ease: "easeInOut" }}
        />
        {STEPS.map(({ icon: Icon, title, desc }) => (
          <motion.li key={title} className="journey-card__step" variants={stepVariants}>
            <span className="journey-card__icon" aria-hidden="true">
              <Icon size={18} />
              <motion.span className="journey-card__check" variants={checkVariants}>
                <Check size={11} strokeWidth={3} />
              </motion.span>
            </span>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}
