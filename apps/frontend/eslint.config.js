import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    // `src/components/ui` : code copié tel quel depuis Magic UI, Aceternity UI
    // et SmoothUI. On ne le reformate pas à nos règles, pour pouvoir le
    // comparer ou le mettre à jour depuis la source.
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
