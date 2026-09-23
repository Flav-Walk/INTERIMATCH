/*
 * InputGlow — le cadre animé de l'Input d'Aceternity, tout seul.
 *
 * C'est exactement le même code que la boîte autour du champ dans input.tsx.
 * Pourquoi je l'ai séparé : dans Field, le champ est écrit dans la page (un
 * <input> normal). Pour ne modifier AUCUNE page, Field met ce cadre autour du
 * champ qu'il reçoit, au lieu de le remplacer par <Input>.
 * Couleur du halo : orange InteriMatch au lieu du bleu d'origine.
 */
"use client";
import * as React from "react";
import { useMotionTemplate, useMotionValue, motion } from "motion/react";

export function InputGlow({ children }: { children: React.ReactNode }) {
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
