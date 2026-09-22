import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitaire `cn` attendu par tous les composants shadcn (Magic UI,
 * Aceternity, SmoothUI…) : assemble des classes et résout les conflits
 * Tailwind (`px-2` puis `px-4` → seul `px-4` reste).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
