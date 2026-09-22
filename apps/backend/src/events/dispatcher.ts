import type { BusinessEvent, BusinessEventType } from "./business-event.js";
import { createBusinessEvent } from "./business-event.js";
import { hmacSha256 } from "./signature.js";

export interface EventLogger {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface BusinessEventPublisher {
  publish(
    eventType: BusinessEventType,
    data: Record<string, unknown>,
  ): BusinessEvent;
}

export type DeliveryResult = {
  status: "accepted" | "duplicate";
  event_id: string;
};

export class PermanentWebhookError extends Error {
  constructor(
    public readonly category: "invalid_payload" | "invalid_signature" | "http",
    public readonly httpStatus: number,
  ) {
    super(`Permanent webhook failure: ${category} (${httpStatus})`);
    this.name = "PermanentWebhookError";
  }
}

type Fetch = typeof fetch;

class RetryableHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Retryable webhook failure (${status})`);
  }
}

export class N8nWebhookDelivery {
  constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly logger: EventLogger,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly now: () => number = Date.now,
    private readonly retryDelays = [1_000, 5_000],
  ) {}

  async deliver(event: BusinessEvent): Promise<DeliveryResult> {
    // Cette chaîne exacte est à la fois signée et envoyée, sans reconstruction.
    const rawBody = JSON.stringify(event);
    const attempts = this.retryDelays.length + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = Math.floor(this.now() / 1_000).toString();
      const signature = hmacSha256(this.secret, `${timestamp}.${rawBody}`);
      try {
        const response = await this.fetchImpl(this.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-interimatch-timestamp": timestamp,
            "x-interimatch-signature": `sha256=${signature}`,
            "x-correlation-id": event.event_id,
          },
          body: rawBody,
          signal: AbortSignal.timeout(10_000),
        });
        const responseBody = await readJson(response);
        if (
          response.ok &&
          (responseBody.status === "accepted" ||
            responseBody.status === "duplicate")
        ) {
          this.logger.info(
            {
              event_id: event.event_id,
              event_type: event.event_type,
              attempt,
              http_status: response.status,
              result: responseBody.status,
            },
            "business_event_delivered",
          );
          return {
            status: responseBody.status,
            event_id: event.event_id,
          };
        }
        if (response.status === 400 || response.status === 401) {
          const category =
            response.status === 400 ? "invalid_payload" : "invalid_signature";
          this.logger.error(
            {
              event_id: event.event_id,
              event_type: event.event_type,
              attempt,
              http_status: response.status,
              error_category: category,
            },
            "business_event_delivery_failed",
          );
          throw new PermanentWebhookError(category, response.status);
        }
        if (response.status < 500) {
          this.logger.error(
            {
              event_id: event.event_id,
              event_type: event.event_type,
              attempt,
              http_status: response.status,
              error_category: "http_permanent",
            },
            "business_event_delivery_failed",
          );
          throw new PermanentWebhookError("http", response.status);
        }
        throw new RetryableHttpError(response.status);
      } catch (error) {
        if (error instanceof PermanentWebhookError) throw error;
        await this.retryOrThrow(
          event,
          attempt,
          error instanceof RetryableHttpError ? error.status : undefined,
          error instanceof RetryableHttpError
            ? "http_retryable"
            : "network_retryable",
          error,
        );
      }
    }
    throw new Error("Unreachable delivery state");
  }

  private async retryOrThrow(
    event: BusinessEvent,
    attempt: number,
    httpStatus: number | undefined,
    category: string,
    cause?: unknown,
  ) {
    const fields = {
      event_id: event.event_id,
      event_type: event.event_type,
      attempt,
      http_status: httpStatus,
      error_category: category,
      error_code: safeErrorCode(cause),
    };
    const delay = this.retryDelays[attempt - 1];
    if (delay === undefined) {
      this.logger.error(fields, "business_event_delivery_exhausted");
      throw cause instanceof Error ? cause : new Error("Webhook unavailable");
    }
    this.logger.info(
      { ...fields, retry_in_ms: delay },
      "business_event_delivery_retry",
    );
    await this.sleep(delay);
  }
}

/** Publie hors du chemin HTTP : la transaction métier reste indépendante de n8n. */
export class AsyncBusinessEventPublisher implements BusinessEventPublisher {
  constructor(
    private readonly delivery: N8nWebhookDelivery,
    private readonly logger: EventLogger,
  ) {}

  publish(eventType: BusinessEventType, data: Record<string, unknown>) {
    const event = createBusinessEvent(eventType, data);
    void this.delivery.deliver(event).catch((error: unknown) => {
      this.logger.error(
        {
          event_id: event.event_id,
          event_type: event.event_type,
          error_category:
            error instanceof PermanentWebhookError
              ? error.category
              : "delivery_exhausted",
        },
        "business_event_not_delivered",
      );
    });
    return event;
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function safeErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const code = String((error as { code: unknown }).code);
  return /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : undefined;
}
