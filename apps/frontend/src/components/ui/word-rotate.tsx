/*
 * Word Rotate — Magic UI
 * https://magicui.design/docs/components/word-rotate
 *
 * Un mot qui en remplace un autre toutes les 2,5 s (il sort vers le bas, le
 * suivant arrive par le haut). Sert dans les titres : « Trouvez un poste de
 * serveur / cuisinier / barman ».
 *
 * Mes 4 retouches sur le code de Magic UI :
 * 1. <span> au lieu de <h1> : le mot tourne À L'INTÉRIEUR d'un titre existant.
 * 2. Les lecteurs d'écran lisent la liste complète une fois (sr-only), et
 *    ignorent le mot qui change (aria-hidden) : sinon ils le répètent en boucle.
 * 3. « Réduire les animations » : le premier mot reste affiché, fixe.
 * 4. Déplacement de 12 px au lieu de 50 : plus discret dans une phrase.
 */
"use client"

import { useEffect, useState } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionProps,
} from "motion/react"

import { cn } from "../../lib/utils"

interface WordRotateProps {
  words: string[]
  duration?: number
  motionProps?: MotionProps
  className?: string
}

export function WordRotate({
  words,
  duration = 2500,
  motionProps = {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 12 },
    transition: { duration: 0.25, ease: "easeOut" },
  },
  className,
}: WordRotateProps) {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length)
    }, duration)

    // Clean up interval on unmount
    return () => clearInterval(interval)
  }, [words, duration, reduceMotion])

  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <span className="sr-only">{words.join(", ")}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index]}
          aria-hidden="true"
          className={cn("inline-block", className)}
          {...motionProps}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
