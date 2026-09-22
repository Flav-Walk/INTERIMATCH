import type { BusinessEventType } from "../events/business-event.js";
import { createBusinessEvent } from "../events/business-event.js";
import {
  N8nWebhookDelivery,
  PermanentWebhookError,
} from "../events/dispatcher.js";

export type ContractNotificationKind =
  | "contract_available"
  | "worker_signed"
  | "contract_completed_worker"
  | "contract_completed_company";

export type ContractNotification = {
  deliveryId: string;
  occurredAt: string;
  eventType: Extract<
    BusinessEventType,
    "contract.available" | "contract.worker_signed" | "contract.completed"
  >;
  data: Record<string, unknown>;
};

export interface ContractNotificationSender {
  send(notification: ContractNotification): Promise<void>;
}

/** Adaptateur fin : l'outbox contrat garde l'identité et la reprise, tandis que
 * le client n8n partagé garde la signature HMAC, le timeout et les retries. */
export class N8nContractNotificationSender
  implements ContractNotificationSender
{
  constructor(private readonly delivery: N8nWebhookDelivery) {}

  async send(notification: ContractNotification) {
    const event = createBusinessEvent(
      notification.eventType,
      notification.data,
      {
        eventId: notification.deliveryId,
        idempotencyKey: `${notification.eventType}:${notification.deliveryId}`,
        now: new Date(notification.occurredAt),
      },
    );
    try {
      await this.delivery.deliver(event);
    } catch (error) {
      const code =
        error instanceof PermanentWebhookError
          ? `N8N_${error.category.toUpperCase()}`
          : "N8N_UNAVAILABLE";
      throw Object.assign(new Error("Contract notification was not accepted"), {
        code,
      });
    }
  }
}
