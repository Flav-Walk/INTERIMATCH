import type { CompletionRule } from "./session";
import { requirementLabels } from "./profile";

/**
 * Nombre d'exigences de complétion.
 *
 * Il n'est pas écrit ici : il se compte sur `requirementLabels`, dont le type
 * `Record<CompletionRule, string>` oblige TypeScript à couvrir exactement les
 * règles du serveur. Une septième exigence ajoutée au backend fait échouer la
 * compilation tant que son libellé manque — le dénominateur suit alors de
 * lui-même, là où une constante recopiée aurait faussé la jauge en silence.
 */
export const WORKER_REQUIREMENT_COUNT = Object.keys(requirementLabels).length;

/**
 * Convertit uniquement `missing_requirements` en repère visuel.
 * Aucune donnée de profil n'est réévaluée côté client.
 */
export function workerRequirementProgress(
  missing: CompletionRule[] | undefined,
) {
  if (!missing) return null;
  const uniqueKnownRules = new Set<CompletionRule>(missing);
  const satisfied = Math.max(
    0,
    WORKER_REQUIREMENT_COUNT - uniqueKnownRules.size,
  );
  return Math.round((satisfied / WORKER_REQUIREMENT_COUNT) * 100);
}
