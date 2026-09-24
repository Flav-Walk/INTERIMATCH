/*
 * Number Ticker — Magic UI
 * https://magicui.design/docs/components/number-ticker
 *
 * Un chiffre qui défile de 0 jusqu'à sa valeur quand il entre à l'écran
 * (ressort Motion : ça ralentit en arrivant).
 *
 * Retouches InteriMatch :
 * 1. Format français (fr-FR) au lieu de en-US : « 1 250 » et pas « 1,250 ».
 * 2. Plus de couleur noire imposée : le chiffre prend la couleur du texte
 *    autour (utile sur le bandeau vert foncé).
 * 3. « Réduire les animations » : la valeur finale s'affiche tout de suite.
 */
"use client"

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react"
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react"

import { cn } from "../../lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value)
      }, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [motionValue, isInView, delay, value, direction, startValue])

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
        }
      }),
    [springValue, decimalPlaces]
  )

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tabular-nums",
        className
      )}
      {...props}
    >
      {reduceMotion ? value : startValue}
    </span>
  )
}
