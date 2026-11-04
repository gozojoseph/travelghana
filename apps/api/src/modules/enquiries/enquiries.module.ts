import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module";
import { EnquiriesController, AdminEnquiriesController } from "./enquiries.controller";
import { EnquiriesService } from "./enquiries.service";

@Module({
  imports: [MailModule],
  controllers: [EnquiriesController, AdminEnquiriesController],
  providers: [EnquiriesService],
})
export class EnquiriesModule {}
