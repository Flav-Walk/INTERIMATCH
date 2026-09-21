import { HttpError } from "../errors.js";

export interface ContractEmailMessage {
  idempotencyKey: string;
  to: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
}

export interface ContractEmailSender {
  send(message: ContractEmailMessage): Promise<void>;
}

interface EmailLogger {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export class BrevoEmailService implements ContractEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly sender: { email: string; name: string },
    private readonly logger: EmailLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: ContractEmailMessage) {
    let response: Response;
    try {
      response = await this.fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: this.sender,
          to: [message.to],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
          headers: { "Idempotency-Key": message.idempotencyKey },
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(
        { provider: "brevo", error_code: safeCode(error) },
        "contract_email_failed",
      );
      throw new HttpError(
        502,
        "EMAIL_UNAVAILABLE",
        "L'email de notification n'a pas pu être envoyé.",
      );
    }
    if (!response.ok) {
      this.logger.error(
        { provider: "brevo", http_status: response.status },
        "contract_email_failed",
      );
      throw new HttpError(
        502,
        "EMAIL_UNAVAILABLE",
        "L'email de notification n'a pas pu être envoyé.",
      );
    }
    this.logger.info(
      { provider: "brevo", http_status: response.status },
      "contract_email_sent",
    );
  }
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const code = String((error as { code: unknown }).code);
  return /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : undefined;
}
