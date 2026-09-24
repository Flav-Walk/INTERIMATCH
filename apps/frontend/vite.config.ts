import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Vite tournait jusqu'ici sur sa configuration implicite : aucun fichier, aucun
 * greffon. L'arrivée de Tailwind v4 en impose un, puisque le moteur est un
 * greffon Vite et non plus une étape PostCSS.
 *
 * Rien d'autre n'est déclaré ici. Le port, l'hôte et les variables d'
 * environnement continuent d'être passés en ligne de commande par les scripts
 * npm et par Playwright : les y laisser garde une seule source de vérité.
 */
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    /*
     * Pré-transformation des modules d'entrée.
     *
     * La suite navigateur lance deux navigateurs en parallèle contre UN serveur
     * de développement. Chaque route est chargée à la demande, et les espaces
     * sont découpés en morceaux : la toute première navigation vers un écran
     * paie donc la transformation de sa branche entière, pendant que l'autre
     * navigateur demande la sienne. Sous cette charge, des `page.goto` ont
     * dépassé trente secondes — sur des écrans qui s'affichent en cent
     * millisecondes une fois chauds.
     *
     * Le symptôme ressemblait à une régression et n'en était pas. Chauffer les
     * entrées supprime la cause au lieu d'allonger les délais d'attente, ce qui
     * n'aurait fait que déplacer le seuil.
     */
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/layouts/AppLayout.tsx",
        "./src/pages/*.tsx",
        "./src/components/**/*.tsx",
      ],
    },
  },
});
