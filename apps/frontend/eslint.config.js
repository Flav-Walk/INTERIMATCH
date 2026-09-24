import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    // components/ui = code copié depuis Magic UI, Aceternity et SmoothUI.
    // Je ne le passe pas au linter : il doit rester identique à l'original,
    // pour pouvoir le comparer ou le remettre à jour facilement.
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src/components/ui/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
);
