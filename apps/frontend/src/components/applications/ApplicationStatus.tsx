import {
  applicationLabels,
  type ApplicationStatus as Status,
} from "../../services/applications";
import { StatusTrack, type TrackTone } from "../da/StatusTrack";
import "../../styles/applications.css";

/**
 * Statut d'une candidature : en attente, acceptée ou refusée.
 *
 * Ce n'est plus un badge avec un point de couleur (retour de revue) : c'est
 * une petite frise en 3 étapes (components/da/StatusTrack.tsx, inspirée de
 * l'Animated Timeline d'Animata).
 *
 *   En attente  → 2 étapes sur 3, la 2e pulse (l'entreprise examine)
 *   Acceptée    → 3 sur 3, en vert, coche au bout
 *   Non retenue → 3 sur 3, en gris, croix au bout
 *
 * key={status} : si le statut change pendant que la page est ouverte (par
 * exemple l'entreprise accepte), React recrée la frise et elle se rallume.
 */
const TRACK: Record<Status, { reached: number; tone: TrackTone }> = {
  pending: { reached: 2, tone: "pending" },
  accepted: { reached: 3, tone: "done" },
  rejected: { reached: 3, tone: "stopped" },
};

export function ApplicationStatus({ status }: { status: Status }) {
  return (
    <span key={status} className={`application-status-track is-${status}`}>
      <StatusTrack {...TRACK[status]} label={applicationLabels[status]} />
    </span>
  );
}
