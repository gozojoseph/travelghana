import { Module } from "@nestjs/common";

import { buildMailer, MAILER } from "./mailer";

/**
 * Shared transactional-mail infrastructure (D36). One provider instance for
 * the whole API: the MAILER token is resolved by buildMailer() from
 * MAILER_PROVIDER (console|brevo) and is failure-tolerant by contract.
 * Modules that send mail import this module and @Inject(MAILER) in their
 * services; tests override the token via their module setup.
 */
@Module({
  providers: [{ provide: MAILER, useFactory: buildMailer }],
  exports: [MAILER],
})
export class MailModule {}
