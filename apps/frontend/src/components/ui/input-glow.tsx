/*
 * Halo de l'Input d'Aceternity UI, seul.
 *
 * Même code que le cadre animé de `input.tsx` (Aceternity UI), sorti dans un
 * composant à part. Pourquoi : dans le composant Field, le champ est fourni
 * par la page (<input> classique). Pour ne modifier aucune page, Field pose ce
 * cadre AUTOUR du champ reçu, au lieu de remplacer le champ par <Input>.
 * Adaptation InteriMatch : halo orange de marque au lieu du bleu d'origine.
 */
"use client";
import * as React from "react";
import { useMotionTemplate, useMotionValue, motion } from "motion/react";

export function InputGlow({ children }: { children: React.ReactNode }) {
  const radius = 100; // change this to increase the rdaius of the hover effect
  const [visible, setVisible] = React.useState(false);

  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: any) {
    let { left, top } = currentTarget.getBoundingClientRect();

    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }
  return (
    <motion.div
      style={{
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
      {children}
    </motion.div>
  );
}
