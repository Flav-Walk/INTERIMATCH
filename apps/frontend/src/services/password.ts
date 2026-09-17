/**
 * Mot de passe : ce que le serveur exige, et ce que l'interface conseille.
 *
 * Les deux ne se confondent pas. Le serveur applique une seule règle —
 * `z.string().min(12).max(128)` dans `registerSchema` — et c'est elle qui
 * décide si une inscription passe. La force, elle, n'est qu'une estimation
 * destinée à l'utilisateur : elle n'autorise rien et ne refuse rien.
 *
 * Cette séparation est tenue par construction plus bas : tant que l'exigence du
 * serveur n'est pas satisfaite, l'indicateur ne peut pas dépasser « Faible ».
 * Une barre bien remplie ne pourra donc jamais laisser croire qu'un mot de
 * passe trop court sera accepté.
 */

/** Seule contrainte bloquante, reprise de `registerSchema` côté backend. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordRequirement {
  /** Satisfait la règle du serveur. */
  met: boolean;
  /** Caractères restant à saisir, pour le dire plutôt que de le faire deviner. */
  missing: number;
  /** Message à afficher, vide si la règle est satisfaite. */
  message: string;
}

export function passwordRequirement(password: string): PasswordRequirement {
  const missing = Math.max(0, MIN_PASSWORD_LENGTH - password.length);
  if (password.length > MAX_PASSWORD_LENGTH)
    return {
      met: false,
      missing: 0,
      message: `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`,
    };
  if (missing === 0) return { met: true, missing: 0, message: "" };
  return {
    met: false,
    missing,
    message: password.length
      ? `Encore ${missing} caractère${missing > 1 ? "s" : ""} : ${MIN_PASSWORD_LENGTH} au minimum.`
      : `${MIN_PASSWORD_LENGTH} caractères au minimum.`,
  };
}

export const strengthLevels = [
  "Très faible",
  "Faible",
  "Correct",
  "Solide",
] as const;

export type StrengthScore = 0 | 1 | 2 | 3;

export interface PasswordStrength {
  score: StrengthScore;
  label: string;
  /** Ce qui ferait réellement progresser ce mot de passe, ou vide. */
  advice: string;
}

const families = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

/**
 * Estimation de la force. La longueur compte, mais la répétition ne compte pas :
 * « aaaaaaaaaaaa » fait douze caractères pour une seule lettre, et ne vaut pas
 * douze caractères variés. On borne donc la longueur utile par la variété réelle.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: strengthLevels[0], advice: "" };

  const used = families.filter((family) => family.test(password)).length;
  const distinct = new Set(password).size;
  const effective = Math.min(password.length, distinct * 3);

  let score = 0;
  if (effective >= 10) score += 1;
  if (effective >= 14) score += 1;
  if (used >= 3) score += 1;
  if (used === 4 && effective >= 18) score += 1;
  score = Math.min(score, 3);

  // Tant que la règle du serveur n'est pas remplie, l'indicateur reste bas :
  // il ne doit jamais suggérer qu'un mot de passe refusé serait bon.
  if (!passwordRequirement(password).met) score = Math.min(score, 1);

  const advice =
    score >= 3
      ? ""
      : used < 3
        ? "Mêlez majuscules, chiffres et signes de ponctuation."
        : distinct * 3 < password.length
          ? "Évitez les caractères répétés."
          : "Allongez-le : c'est ce qui compte le plus.";

  return {
    score: score as StrengthScore,
    label: strengthLevels[score],
    advice,
  };
}
