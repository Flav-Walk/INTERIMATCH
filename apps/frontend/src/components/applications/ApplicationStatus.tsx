import { motion } from "motion/react";
import {
  applicationLabels,
  type ApplicationStatus as Status,
} from "../../services/applications";
import "../../styles/applications.css";

/**
 * Badge de statut d'une candidature : en attente, acceptée ou refusée.
 *
 * - J'ai remplacé l'icône Lucide par un simple point de couleur. Quand la
 *   candidature est « en attente », le point pulse (animation dans motion.css).
 * - key={status} : si le statut change pendant que la page est ouverte (par
 *   exemple l'entreprise accepte), React recrée le badge et il refait son
 *   apparition. Comme ça, l'utilisateur voit que quelque chose a bougé.
 */
export function ApplicationStatus({ status }: { status: Status }) {
  return (
    <motion.span
      key={status}
      className={`application-status is-${status}`}
      // Départ : invisible et un peu plus petit. Arrivée : taille normale.
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      // Petit ressort (bounce 0.3) pour un effet « pop » discret.
      transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
    >
      {/* aria-hidden : le point est décoratif, le texte suffit à l'écran. */}
      <span className="status-dot" aria-hidden="true" />
      {applicationLabels[status]}
    </motion.span>
  );
}
