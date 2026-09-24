/*
 * Bento Grid — Aceternity UI
 * https://ui.aceternity.com/components/bento-grid
 *
 * Code copié depuis Aceternity. Changements marqués « InteriMatch » : le
 * chemin d'import de cn() et l'import des types React.
 *
 * Comment ça marche :
 * - BentoGrid = une grille de 3 colonnes (1 seule sur mobile).
 * - BentoGridItem = une case : un visuel en haut (header), puis une icône,
 *   un titre et une description. Au survol, le texte glisse un peu vers la
 *   droite (group-hover/bento:translate-x-2).
 * La taille de chaque case (1 ou 2 colonnes, 1 ou 2 lignes), je la règle
 * dans motion.css : c'est ce qui donne l'effet « bento » irrégulier.
 */
import type * as React from "react"; // InteriMatch : types React importés
import { cn } from "../../lib/utils"; // InteriMatch : pas d'alias « @/ »

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "group/bento shadow-input row-span-1 flex flex-col justify-between space-y-4 rounded-xl border border-neutral-200 bg-white p-4 transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none",
        className,
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-2">
        {icon}
        <div className="mt-2 mb-2 font-sans font-bold text-neutral-600 dark:text-neutral-200">
          {title}
        </div>
        <div className="font-sans text-xs font-normal text-neutral-600 dark:text-neutral-300">
          {description}
        </div>
      </div>
    </div>
  );
};
