import { Check } from "lucide-react";
import {
  passwordRequirement,
  passwordStrength,
  strengthLevels,
} from "../services/password";

/**
 * Deux informations distinctes, présentées comme telles.
 *
 * En haut, l'exigence — la seule que le serveur applique, et la seule qui
 * décide si l'inscription passe. En dessous, la force, qui est un conseil.
 * Les confondre laisserait croire qu'une barre bien remplie suffit.
 */
export function PasswordStrength({
  password,
  id,
}: {
  password: string;
  id: string;
}) {
  const requirement = passwordRequirement(password);
  const strength = passwordStrength(password);

  return (
    <div className="password-meter" id={id}>
      <p
        className={"password-rule" + (requirement.met ? " is-met" : "")}
        role="status"
      >
        {requirement.met ? (
          <>
            <Check size={15} aria-hidden="true" />
            Longueur suffisante.
          </>
        ) : (
          requirement.message
        )}
      </p>

      {password && (
        <>
          <div
            className="strength-bar"
            role="img"
            aria-label={`Force du mot de passe : ${strength.label}`}
          >
            {strengthLevels.map((_, index) => (
              <span
                key={index}
                className={index <= strength.score ? "is-filled" : ""}
                data-level={strength.score}
              />
            ))}
          </div>
          <p className="quiet strength-note">
            <strong>{strength.label}</strong>
            {strength.advice && ` · ${strength.advice}`}
          </p>
        </>
      )}
    </div>
  );
}
