// Vite lit ce fichier tout seul au démarrage : c'est ici que je branche
// Tailwind. J'ai choisi la version PostCSS plutôt que le plugin Vite de
// Tailwind, parce que le projet est sur Vite 8 et que le plugin Vite de
// Tailwind suit les nouvelles versions de Vite avec du retard.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
