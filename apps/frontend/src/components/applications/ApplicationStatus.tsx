import { Check, Clock3, X } from "lucide-react";
import {
  applicationLabels,
  type ApplicationStatus as Status,
} from "../../services/applications";
import { Badge, APPLICATION_STATUS_VARIANT } from "../ui/Badge";
import "../../styles/applications.css";

// Statut d'une candidature dans le flux d'une liste : Badge du design system.
// Icône + libellé : le sens ne repose jamais sur la couleur seule.
export function ApplicationStatus({ status }: { status: Status }) {
  const Icon =
    status === "pending" ? Clock3 : status === "accepted" ? Check : X;
  return (
    <Badge variant={APPLICATION_STATUS_VARIANT[status]}>
      <Icon size={12} aria-hidden="true" />
      {applicationLabels[status]}
    </Badge>
  );
}
