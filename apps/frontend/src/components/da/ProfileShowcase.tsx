import type { MouseEvent } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Check } from "lucide-react";
import { useLocation } from "react-router-dom";
import { heroImageFor } from "../../lib/hero-images";
import { MAGIC_CARD_COLORS } from "../../lib/brand";
import { PhotoBackdrop } from "../PhotoBackdrop";
import { BorderBeam } from "../ui/border-beam";
import { MagicCard } from "../ui/magic-card";
import { NumberTicker } from "../ui/number-ticker";
import { levelFromPercent } from "../../lib/levels";

/*
 * Haut de la page Profil : « effet waouh » dès le premier regard.
 *
 * Avant : une bannière photo générique + un titre. Maintenant, l'intérimaire
 * voit tout de suite SON profil, vivant, tel qu'un recruteur le verra.
 *
 * À gauche — la carte pro (sur la photo + voile vert de la DA) :
 *   nom en Fraunces, métier et ville, puis trois chiffres (pas d'icônes
 *   décoratives ni de pastille qui pulse : retour de revue « trop IA »)
 *   qui défilent avec Number Ticker (Magic UI) : compétences, années
 *   d'expérience, rayon de mobilité. Ils bougent EN DIRECT quand on coche une
 *   tuile ou change le rayon plus bas dans la page.
 *
 * À droite — « Vu par les recruteurs » :
 *   - Magic Card (Magic UI) : halo orange → vert qui suit la souris ;
 *   - inclinaison 3D au survol, adaptée de « 3D Card Effect » (Aceternity) :
 *     même principe (rotateX/rotateY selon la souris), réécrit avec Motion
 *     pour rester léger ;
 *   - Border Beam (Magic UI) : un trait de lumière fait le tour de la carte
 *     SEULEMENT quand tous les prérequis sont réunis. C'est la récompense.
 *   - les compétences cochées y apparaissent une à une (AnimatePresence).
 *
 * Accessibilité : tout est coupé si « Réduire les animations » est activé
 * (pas d'inclinaison, pas de faisceau, chiffres affichés directement).
 */

export interface ProfileShowcaseProps {
  name: string;
  initials: string;
  jobLabel: string;
  city: string;
  radiusKm: number | null;
  years: number | null;
  skills: string[];
  secondaryJobs: string[];
  nextSlot: string | null;
  /** Pourcentage des prérequis réunis (null tant que le serveur n'a pas répondu). */
  progress: number | null;
  missingCount: number;
}

/** Inclinaison 3D douce, plafonnée à 7°, avec ressort (façon Aceternity). */
function useTilt(disabled: boolean) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const spring = { stiffness: 180, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(y, [0, 1], [7, -7]), spring);
  const rotateY = useSpring(useTransform(x, [0, 1], [-7, 7]), spring);
  const onMove = (event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width);
    y.set((event.clientY - rect.top) / rect.height);
  };
  const onLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };
  return { rotateX, rotateY, onMove, onLeave };
}

function Stat({
  value,
  label,
  suffix,
  delay,
}: {
  value: number | null;
  label: string;
  suffix?: string;
  delay: number;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="font-brand text-3xl leading-none font-semibold text-white tabular-nums sm:text-4xl">
        {value === null ? (
          "—"
        ) : (
          <>
            <NumberTicker value={value} delay={delay} className="text-white" />
            {suffix && <span className="ml-1 text-xl text-white/70">{suffix}</span>}
          </>
        )}
      </span>
      <span className="text-[10px] leading-tight font-semibold tracking-wide text-white/70 uppercase sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export function ProfileShowcase(props: ProfileShowcaseProps) {
  const {
    name,
    initials,
    jobLabel,
    city,
    radiusKm,
    years,
    skills,
    secondaryJobs,
    nextSlot,
    progress,
    missingCount,
  } = props;
  const reduceMotion = Boolean(useReducedMotion());
  const { pathname } = useLocation();
  const image = heroImageFor(pathname);
  const tilt = useTilt(reduceMotion);
  const ready = progress !== null && missingCount === 0;

  // Entrée en cascade (désactivée si « Réduire les animations »).
  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section
      className="profile-showcase relative isolate grid items-center gap-8 overflow-hidden rounded-[var(--radius-lg)] bg-forest p-6 text-white shadow-[var(--shadow-2)] md:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"
      aria-labelledby="profile-showcase-title"
    >
      {/* Photo + voile vert : la même signature que les autres pages. */}
      <PhotoBackdrop key={image.src} src={image.src} position={image.position} />

      {/* ── Carte pro ─────────────────────────────────────────────── */}
      <div className="relative grid gap-6">
        <motion.p
          className="m-0 flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white/80 uppercase"
          {...rise(0)}
        >
          <span className="h-px w-6 bg-orange" aria-hidden="true" />
          Votre profil professionnel
        </motion.p>

        <motion.div className="grid gap-2" {...rise(0.08)}>
          <h1
            id="profile-showcase-title"
            className="m-0 font-brand text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-white md:text-5xl"
          >
            {name}
          </h1>
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-white/85">
            <span className="font-semibold text-white">
              {jobLabel || "Métier principal à renseigner"}
            </span>
            {city && (
              <span>{city}</span>
            )}
          </p>
        </motion.div>

        {/* Trois chiffres, mis à jour pendant la saisie. */}
        <motion.div
          className="grid max-w-md grid-cols-3 gap-3 border-t border-white/20 pt-5 sm:gap-4"
          {...rise(0.24)}
        >
          <Stat value={skills.length} label="Compétences" delay={0.3} />
          <Stat value={years} label="Ans d’expérience" delay={0.4} />
          <Stat value={radiusKm} label="Km de mobilité" delay={0.5} />
        </motion.div>
      </div>

      {/* ── Vu par les recruteurs ─────────────────────────────────── */}
      <motion.div
        className="relative [perspective:1200px]"
        {...rise(0.2)}
      >
        <p className="m-0 mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white/80 uppercase">
          <span className="h-px w-6 bg-orange" aria-hidden="true" />
          Vu par les recruteurs
        </p>
        <motion.div
          onMouseMove={tilt.onMove}
          onMouseLeave={tilt.onLeave}
          style={
            reduceMotion
              ? undefined
              : { rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: "preserve-3d" }
          }
          className="relative rounded-[var(--radius-lg)]"
        >
          <MagicCard
            className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface text-foreground shadow-2xl"
            {...MAGIC_CARD_COLORS}
          >
            <div
              className="grid gap-4 p-5"
              role="group"
              aria-label="Aperçu de votre profil tel que le voient les établissements"
            >
              {/* En-tête : initiales + identité + badge « prêt ». */}
              <div className="flex items-start gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-forest font-brand text-lg font-semibold text-white"
                  aria-hidden="true"
                >
                  {initials}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-brand text-lg leading-tight font-semibold break-words">
                    {name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {jobLabel || "Métier à préciser"}
                    {city ? ` · ${city}` : ""}
                    {radiusKm ? ` · ${radiusKm} km` : ""}
                  </span>
                </span>
                {ready ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-bold text-white">
                    <Check size={12} strokeWidth={3} aria-hidden="true" /> Prêt
                  </span>
                ) : progress !== null ? (
                  // Couleur du niveau (ambre / rouge) : voir lib/levels.ts.
                  <span
                    className={`level-pill is-${levelFromPercent(progress)} shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums`}
                  >
                    {progress} %
                  </span>
                ) : null}
              </div>

              {/* Compétences : elles arrivent une à une quand on coche. */}
              <div className="grid gap-2">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Compétences
                </span>
                <div className="flex min-h-8 flex-wrap gap-1.5">
                  <AnimatePresence initial={false} mode="popLayout">
                    {skills.length === 0 ? (
                      <motion.span
                        key="empty"
                        layout
                        className="text-sm text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Aucune compétence cochée pour l’instant.
                      </motion.span>
                    ) : (
                      skills.map((skill) => (
                        <motion.span
                          key={skill}
                          layout={!reduceMotion}
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.6, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                          transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                          className="inline-flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          <Check size={11} strokeWidth={3} aria-hidden="true" />
                          {skill}
                        </motion.span>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {secondaryJobs.length > 0 && (
                <p className="m-0 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Aussi : </span>
                  {secondaryJobs.join(" · ")}
                </p>
              )}

              {/* Pied : prochaine disponibilité. */}
              <div className="border-t border-border pt-3 text-sm">
                {nextSlot ? (
                  <span>
                    <span className="text-muted-foreground">Disponible · </span>
                    <span className="font-semibold">{nextSlot}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Aucune disponibilité à venir</span>
                )}
              </div>
            </div>
          </MagicCard>

          {/* La récompense : le faisceau ne tourne qu'à 100 %. */}
          {ready && !reduceMotion && (
            <BorderBeam
              size={120}
              duration={7}
              borderWidth={2}
              colorFrom="var(--orange)"
              colorTo="oklch(0.85 0.12 60)"
            />
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
