import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() : tous les composants copiés de Magic UI, Aceternity et SmoothUI
 * l'importent. Elle sert à assembler des classes CSS :
 *   - clsx gère les conditions : cn("a", actif && "b") donne "a b" ou "a".
 *   - twMerge garde la dernière classe Tailwind en cas de doublon :
 *     cn("px-2", "px-4") donne "px-4".
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
