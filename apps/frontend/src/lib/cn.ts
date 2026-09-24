import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes conditionnelles, puis départage celles qui se
 * contredisent.
 *
 * `clsx` aplatit les conditions ; `tailwind-merge` règle le reste. Sans lui,
 * `cn("px-4", props.className)` avec `px-6` en propriété laisse les deux
 * classes dans l'attribut, et c'est l'ordre du fichier CSS généré — pas
 * l'intention de l'appelant — qui décide laquelle s'applique. Un composant ne
 * serait alors surchargeable que par hasard.
 *
 * C'est la convention de toutes les bibliothèques dont la refonte reprend les
 * composants (Magic UI, Aceternity, SmoothUI) : leurs sources appellent `cn`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
