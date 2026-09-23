import { forwardRef, useRef, type ReactNode } from "react";
import { BedDouble, ChefHat, ConciergeBell, Store, Wine } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { AnimatedBeam } from "../ui/animated-beam";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

/*
 * Visuel du haut de l'accueil, à la place de la carte « InteriMatch vous
 * accompagne » (jugée trop « IA » en revue).
 *
 * Composant utilisé : Animated Beam de Magic UI
 * https://magicui.design/docs/components/animated-beam
 * (même montage que leur démo « multiple outputs »).
 *
 * Ce que ça montre : à gauche des métiers, au centre InteriMatch, à droite
 * des établissements. Des faisceaux lumineux partent des métiers vers
 * InteriMatch, puis d'InteriMatch vers les établissements : c'est le
 * rapprochement, dessiné. Rien n'est une vraie donnée, c'est une illustration.
 *
 * Comment Animated Beam trouve ses points :
 * 1. Chaque rond a une ref (fromRef / toRef).
 * 2. Le composant mesure leur position dans le conteneur (containerRef).
 * 3. Il trace une courbe SVG entre les deux, et fait glisser un dégradé
 *    dessus en boucle.
 */

// Un rond blanc avec une icône dedans. forwardRef : Animated Beam a besoin
// d'accéder à l'élément HTML pour mesurer sa position.
const Node = forwardRef<
  HTMLDivElement,
  { children: ReactNode; label: string; className?: string }
>(({ children, label, className }, ref) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-14 items-center justify-center rounded-full border border-white/25 bg-white text-forest shadow-[0_8px_24px_rgb(0_0_0/0.25)]",
        className,
      )}
    >
      {children}
    </div>
    <span className="text-xs font-medium text-white/85">{label}</span>
  </div>
));
Node.displayName = "Node";

// Couleurs des faisceaux : de l'orange de marque vers un vert clair.
const BEAM = {
  pathColor: "rgb(255 255 255)",
  pathOpacity: 0.18,
  pathWidth: 2,
  gradientStartColor: "oklch(0.75 0.17 43)",
  gradientStopColor: "oklch(0.9 0.08 160)",
};

export function MatchingBeam() {
  // « Réduire les animations » : on garde les traits, sans lumière qui défile.
  const reduceMotion = useReducedMotion();
  const beam = reduceMotion
    ? { ...BEAM, gradientStartColor: "transparent", gradientStopColor: "transparent" }
    : BEAM;
  const containerRef = useRef<HTMLDivElement>(null);
  // Trois métiers à gauche.
  const serveur = useRef<HTMLDivElement>(null);
  const cuisine = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  // InteriMatch au centre.
  const hub = useRef<HTMLDivElement>(null);
  // Deux établissements à droite.
  const hotel = useRef<HTMLDivElement>(null);
  const restaurant = useRef<HTMLDivElement>(null);

  return (
    <BlurFade delay={0.35} duration={0.7} className="w-full max-w-[520px]">
      <div
        ref={containerRef}
        // aria-hidden : c'est un dessin, le texte à gauche dit déjà tout.
        aria-hidden="true"
        className="relative flex h-[380px] w-full items-center justify-between px-2"
      >
        <div className="flex flex-col gap-9">
          <Node ref={serveur} label="Serveur">
            <ConciergeBell size={22} />
          </Node>
          <Node ref={cuisine} label="Cuisinier">
            <ChefHat size={20} />
          </Node>
          <Node ref={bar} label="Barman">
            <Wine size={20} />
          </Node>
        </div>

        {/* Le centre, plus grand, avec les initiales en Fraunces. */}
        <Node
          ref={hub}
          label="InteriMatch"
          className="size-24 border-2 border-orange-ink/40 bg-forest font-brand text-3xl font-semibold text-white"
        >
          IM
        </Node>

        <div className="flex flex-col gap-16">
          <Node ref={hotel} label="Hôtel">
            <BedDouble size={20} />
          </Node>
          <Node ref={restaurant} label="Restaurant">
            <Store size={20} />
          </Node>
        </div>

        {/* Faisceaux métiers → InteriMatch, légèrement décalés dans le temps. */}
        <AnimatedBeam containerRef={containerRef} fromRef={serveur} toRef={hub} curvature={-40} {...beam} />
        <AnimatedBeam containerRef={containerRef} fromRef={cuisine} toRef={hub} delay={0.6} {...beam} />
        <AnimatedBeam containerRef={containerRef} fromRef={bar} toRef={hub} curvature={40} delay={1.2} {...beam} />
        {/* Faisceaux InteriMatch → établissements. */}
        <AnimatedBeam containerRef={containerRef} fromRef={hub} toRef={hotel} curvature={-30} delay={1.8} {...beam} />
        <AnimatedBeam containerRef={containerRef} fromRef={hub} toRef={restaurant} curvature={30} delay={2.4} {...beam} />
      </div>
    </BlurFade>
  );
}
