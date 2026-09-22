/**
 * Tailwind CSS passe par PostCSS, que Vite lit tout seul.
 *
 * Pourquoi PostCSS plutôt que le plugin Vite de Tailwind : ce plugin suit les
 * versions de Vite avec du retard, et le projet est déjà sur Vite 8. Passer
 * par PostCSS évite tout conflit de version.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
