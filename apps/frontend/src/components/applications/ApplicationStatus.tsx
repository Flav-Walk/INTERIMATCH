import { motion } from "motion/react";
import {
  applicationLabels,
  type ApplicationStatus as Status,
} from "../../services/applications";
import "../../styles/applications.css";

/**
 * Badge de statut d'une candidature : en attente, acceptée, refusée.
 *
 * - Un point de couleur remplace l'icône : il pulse tant que la candidature
 *   attend une réponse (voir motion.css).
 * - `key={status}` : quand le statut change sous les yeux de l'utilisateur
 *   (une entreprise accepte une candidature), le badge est recréé et rejoue
 *   son entrée avec Motion. Le changement se voit au lieu de passer inaperçu.
 */
export function ApplicationStatus({ status }: { status: Status }) {
  return (
    <motion.span
      key={status}
      className={`application-status is-${status}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
    >
      <span className="status-dot" aria-hidden="true" />
      {applicationLabels[status]}
    </motion.span>
  );
}
