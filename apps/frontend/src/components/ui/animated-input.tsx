/*
 * Animated Input — SmoothUI
 * https://smoothui.dev/docs/components/animated-input
 *
 * Un champ dont le libellé est posé DANS le champ, puis remonte au-dessus en
 * rétrécissant (et passe en orange) quand on clique ou qu'il y a du texte.
 *
 * Retouches InteriMatch :
 * 1. inputProps : on peut passer name, type, maxLength, min, inputMode…
 *    (le composant d'origine n'acceptait qu'un champ texte sans nom, donc
 *    inutilisable dans un vrai formulaire).
 * 2. Le libellé non flottant est gris InteriMatch (--muted) au lieu de #6b7280.
 * 3. Champ plus haut (48 px), bordure et focus aux couleurs InteriMatch.
 * 4. Le libellé reste le nom accessible du champ (aria-label + <label for>) :
 *    les tests e2e trouvent toujours « Prénom », « Ville »…
 */
import { motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type InputHTMLAttributes } from "react";

const EASE_IN_OUT_CUBIC_X1 = 0.4;
const EASE_IN_OUT_CUBIC_Y1 = 0;
const EASE_IN_OUT_CUBIC_X2 = 0.2;
const EASE_IN_OUT_CUBIC_Y2 = 1;

const LABEL_TRANSITION = {
  duration: 0.28,
  ease: [
    EASE_IN_OUT_CUBIC_X1,
    EASE_IN_OUT_CUBIC_Y1,
    EASE_IN_OUT_CUBIC_X2,
    EASE_IN_OUT_CUBIC_Y2,
  ] as [number, number, number, number], // cubic-bezier tuple
};

export interface AnimatedInputProps {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  inputClassName?: string;
  label: string;
  labelClassName?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
  /** InteriMatch : les autres attributs du <input> (name, type, maxLength…). */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "disabled" | "placeholder" | "className"
  >;
}

export default function AnimatedInput({
  value,
  defaultValue = "",
  onChange,
  label,
  placeholder = "",
  disabled = false,
  className = "",
  inputClassName = "",
  labelClassName = "",
  icon,
  inputProps = {},
}: AnimatedInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const val = isControlled ? value : internalValue;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = !!val || isFocused;
  const shouldReduceMotion = useReducedMotion();
  const reactId = useId();
  const inputId = `animated-input-${reactId.replace(/:/g, "")}`;

  const getLabelAnimation = () => {
    if (shouldReduceMotion) {
      return {};
    }
    if (isFloating) {
      return {
        borderColor: "var(--color-brand)",
        color: "var(--color-brand)",
        scale: 0.85,
        y: -24,
      };
    }
    return { color: "var(--muted)", scale: 1, y: 0 };
  };

  const getLabelStyle = () => {
    if (!shouldReduceMotion) {
      return {};
    }
    if (isFloating) {
      return {
        borderColor: "var(--color-brand)",
        color: "var(--color-brand)",
        transform: "translateY(-24px) scale(0.85)",
      };
    }
    return {
      color: "var(--muted)",
      transform: "translateY(0) scale(1)",
    };
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {icon ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2"
        >
          {icon}
        </span>
      ) : null}
      <input
        aria-label={label}
        className={`peer block w-full min-h-12 rounded-lg border border-border bg-background px-3.5 py-3 text-[15px] text-foreground outline-none transition hover:border-forest/50 focus-visible:border-forest focus-visible:ring-3 focus-visible:ring-forest/15 ${icon ? "pl-10" : ""} ${inputClassName}`}
        disabled={disabled}
        id={inputId}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => {
          if (!isControlled) {
            setInternalValue(e.target.value);
          }
          onChange?.(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={isFloating ? placeholder : ""}
        ref={inputRef}
        type="text"
        {...inputProps}
        value={val}
      />
      <motion.label
        animate={getLabelAnimation()}
        className={`pointer-events-none absolute top-3 left-3 origin-left rounded-sm border border-transparent bg-background px-1 text-[15px] font-medium text-foreground ${labelClassName}`}
        htmlFor={inputId}
        style={{
          zIndex: 2,
          ...getLabelStyle(),
        }}
        transition={shouldReduceMotion ? { duration: 0 } : LABEL_TRANSITION}
      >
        {label}
      </motion.label>
    </div>
  );
}
