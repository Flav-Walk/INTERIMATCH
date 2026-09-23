/*
 * Input — Aceternity UI (le champ de leur « Signup Form »)
 * https://ui.aceternity.com/components/signup-form
 *
 * Code copié depuis Aceternity. J'ai changé deux choses, marquées
 * « InteriMatch » : le chemin d'import de cn(), et la couleur du halo
 * (bleu à l'origine, orange chez nous).
 *
 * Comment ça marche : le champ est entouré d'une boîte avec 2 px de marge.
 * Quand la souris passe, on dessine dans cette boîte un cercle orange qui
 * suit le curseur. On voit donc une lueur orange autour du champ.
 */
"use client";
import * as React from "react";
import { cn } from "../../lib/utils"; // InteriMatch : pas d'alias « @/ »
import { useMotionTemplate, useMotionValue, motion } from "motion/react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const radius = 100; // taille du halo en pixels
    // visible = la souris est-elle sur le champ ? Sinon le halo fait 0 px.
    const [visible, setVisible] = React.useState(false);

    let mouseX = useMotionValue(0);
    let mouseY = useMotionValue(0);

    // Position de la souris par rapport au coin haut-gauche du cadre.
    function handleMouseMove({ currentTarget, clientX, clientY }: any) {
      let { left, top } = currentTarget.getBoundingClientRect();

      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }
    return (
      <motion.div
        style={{
          // InteriMatch : halo orange de marque au lieu du bleu #3b82f6.
          background: useMotionTemplate`
        radial-gradient(
          ${visible ? radius + "px" : "0px"} circle at ${mouseX}px ${mouseY}px,
          var(--orange),
          transparent 80%
        )
      `,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="group/input rounded-lg p-[2px] transition duration-300"
      >
        <input
          type={type}
          className={cn(
            `shadow-input dark:placeholder-text-neutral-600 flex h-10 w-full rounded-md border-none bg-gray-50 px-3 py-2 text-sm text-black transition duration-400 group-hover/input:shadow-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:ring-[2px] focus-visible:ring-neutral-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-white dark:shadow-[0px_0px_1px_1px_#404040] dark:focus-visible:ring-neutral-600`,
            className,
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    );
  },
);
Input.displayName = "Input";

export { Input };
