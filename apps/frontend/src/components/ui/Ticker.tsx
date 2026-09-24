import { useEffect, useLayoutEffect, useRef } from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "../../lib/cn";

/**
 * Compteur qui monte jusqu'à sa valeur.
 *
 * SOURCE : Magic UI — `number-ticker` (https://magicui.design/docs/components/number-ticker),
 * récupéré depuis https://magicui.design/r/number-ticker.json. Licence MIT.
 *
 * CE QUI A ÉTÉ ADAPTÉ.
 * - L'original formate en `en-US` : « 1,250 ». Un écran français doit écrire
 *   « 1 250 ». Le format passe en `fr-FR`.
 * - L'original rend `{startValue}`, donc « 0 », dans le HTML. Si le script
 *   échoue, ou tant que l'élément n'est pas entré dans le viewport, le tableau
 *   de bord affiche alors un zéro à la place d'un chiffre juste — un compteur
 *   décoratif ne doit jamais pouvoir mentir. Ici le HTML porte la VRAIE valeur,
 *   et c'est un effet de MISE EN PAGE (donc avant peinture) qui la ramène à
 *   zéro juste avant de lancer l'animation. Aucun clignotement, et le repli
 *   reste exact.
 * - `useReducedMotion` : la valeur s'écrit d'emblée, sans ressort.
 * - Ressort plus ferme (damping 45, stiffness 120). Le réglage d'origine met
 *   près d'une seconde à se stabiliser sur un nombre à deux chiffres, ce qui
 *   se lit comme une lenteur de l'application, pas comme une animation.
 */
export function Ticker({
  value,
  decimals = 0,
  suffix,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 45, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: "0px" });

  const write = (n: number) => {
    if (ref.current)
      ref.current.textContent = new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);
  };

  // Avant la première peinture : on remet le compteur à zéro pour qu'il ait
  // quelque chose à parcourir. Un `useEffect` s'exécuterait APRÈS, et l'écran
  // montrerait la valeur finale une image avant de la voir retomber.
  useLayoutEffect(() => {
    if (!still) write(0);
  }, [still]);

  useEffect(() => {
    if (!still && inView) motionValue.set(value);
  }, [motionValue, inView, value, still]);

  useEffect(() => {
    if (still) {
      write(value);
      return;
    }
    return spring.on("change", (latest) =>
      write(Number(latest.toFixed(decimals))),
    );
  }, [spring, decimals, still, value]);

  return (
    <span className={cn("tabular-nums", className)}>
      {/* Le HTML porte la valeur juste : script en échec ou mouvement refusé,
          l'écran reste exact. */}
      <span ref={ref}>
        {new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value)}
      </span>
      {suffix}
    </span>
  );
}
