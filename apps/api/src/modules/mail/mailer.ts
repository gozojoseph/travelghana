import { Logger, type LoggerService } from "@nestjs/common";

/**
 * Mailer abstraction (§21 notification abstraction). Provider selection via
 * MAILER_PROVIDER ("console" default | "brevo"); the Brevo account itself is
 * owner provisioning (see OPEN_QUESTIONS.md #9 for the domain/SPF follow-ups).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const MAILER = Symbol("MAILER");

/**
 * The contract callers rely on: send() RESOLVES even when delivery fails, so
 * a provider outage, a bad API key or a rate limit can never break (or lose)
 * a signup, a forgot-password request or a booking flow. Failures are logged
 * and left for a human; the calling API result is unchanged.
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Development mailer: logs the message instead of sending. Verification and
 * reset links are printed so local flows are testable end-to-end.
 */
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger("Mailer");

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
  }
}

/**
 * Brevo transactional email (free tier: 300 emails/day; until a domain is
 * bought, one verified sender address is enough). Failure-tolerant by design -
 * see the Mailer contract above. Logs must never carry the message body
 * (verification/reset links are credential-bearing): failures report
 * recipient + subject + HTTP status only.
 */
export class BrevoMailer implements Mailer {
  private readonly logger = new Logger("Mailer");

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async send(message: MailMessage): Promise<void> {
    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          "api-key": this.apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          // Brevo's field is htmlContent, not html (optional; text alone is
          // a valid send and keeps plain-text deliverability).
          ...(message.html ? { htmlContent: message.html } : {}),
        }),
      });
      if (response.ok) return;
      const detail =
        response.status === 429
          ? "rate limited (Brevo free tier: 300 emails/day)"
          : `HTTP ${response.status}`;
      this.logger.warn(
        `Brevo mail delivery failed for "${message.subject}" to ${this.maskEmail(message.to)}` +
          `: ${detail}`,
      );
    } catch (error) {
      this.logger.warn(
        `Brevo mail delivery error for "${message.subject}" to ${this.maskEmail(message.to)}` +
          `: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private maskEmail(email: string): string {
    const at = email.indexOf("@");
    if (at <= 0) return "***";
    return `${email.slice(0, 2)}***${email.slice(at)}`;
  }
}

/**
 * Provider selection, resolved once at DI time. Anything that is not a fully
 * configured "brevo" setup degrades to the console mailer with a loud warning
 * instead of failing to start - the API must boot mail-provider-agnostically.
 */
export function buildMailer(logger: LoggerService = new Logger("Mailer")): Mailer {
  const provider = (process.env.MAILER_PROVIDER ?? "console").trim().toLowerCase();
  if (provider !== "brevo") {
    if (provider !== "console") {
      logger.warn(`Unknown MAILER_PROVIDER "${provider}" - using the console mailer`);
    }
    logger.log(`Mailer provider: ${provider || "console"} (console mailer active)`);
    return new ConsoleMailer();
  }
  const apiKey = (process.env.BREVO_API_KEY ?? "").trim();
  const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
  const fromName = (process.env.MAIL_FROM_NAME ?? "TravelGhana").trim();
  const timeoutMs = Number(process.env.BREVO_TIMEOUT_MS ?? "") || DEFAULT_TIMEOUT_MS;
  if (!apiKey || !fromEmail) {
    logger.warn(
      "MAILER_PROVIDER=brevo but BREVO_API_KEY or MAIL_FROM_EMAIL is missing - using the console mailer",
    );
    return new ConsoleMailer();
  }
  logger.log("Mailer provider: brevo (BrevoMailer active)");
  return new BrevoMailer(apiKey, fromEmail, fromName, timeoutMs);
}
