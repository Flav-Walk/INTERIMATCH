import { Check, Clock3, X } from "lucide-react";
import {
  applicationLabels,
  type ApplicationStatus as Status,
} from "../../services/applications";

export function ApplicationStatus({ status }: { status: Status }) {
  const Icon =
    status === "pending" ? Clock3 : status === "accepted" ? Check : X;
  return (
    <span className={`application-status is-${status}`}>
      <Icon size={14} aria-hidden="true" />
      {applicationLabels[status]}
    </span>
  );
}
