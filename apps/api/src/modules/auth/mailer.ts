import { Logger } from "@nestjs/common";

/**
 * Mailer abstraction (§21 notification abstraction). Swap the implementation
 * (SES, Postmark, Resend…) without touching callers — provider selection via
 * env once a real account exists (see OPEN_QUESTIONS.md #9).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const MAILER = Symbol("MAILER");

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

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
