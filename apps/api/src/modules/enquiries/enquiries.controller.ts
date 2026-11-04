import { Body, Controller, Delete, Get, Param, Patch, Query, Post } from "@nestjs/common";
import { Role } from "@travelghana/database";
import type { Enquiry } from "@travelghana/types";
import {
  enquiryCreateSchema,
  enquiryListQuerySchema,
  enquiryUpdateSchema,
  idParamSchema,
  type EnquiryCreateInput,
  type EnquiryListQuery,
  type EnquiryUpdateInput,
  type IdParam,
} from "@travelghana/validation";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AnyRole } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { EnquiriesService } from "./enquiries.service";

/**
 * Public enquiry capture (D6). Guests may ask without an account; the
 * SessionGuard populates `user` for signed-in callers even on @Public()
 * routes, which lets the service attach the author and default the contact
 * fields — without ever turning the public form into an auth wall.
 */
@Controller("enquiries")
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Public()
  @Post()
  async create(
    @Body(new ZodValidationPipe(enquiryCreateSchema)) body: EnquiryCreateInput,
    @CurrentUser() requester?: { id: string; email: string; name: string | null },
  ): Promise<{ enquiry: Enquiry }> {
    return { enquiry: await this.enquiries.create(body, requester ?? null) };
  }
}

/** Admin concierge queue: the pipeline the workspace handoff feeds. */
@Controller("admin/enquiries")
export class AdminEnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Get()
  @AnyRole(Role.ADMIN)
  async list(
    @Query(new ZodValidationPipe(enquiryListQuerySchema)) query: EnquiryListQuery,
  ): Promise<{ items: Enquiry[] }> {
    return { items: await this.enquiries.list(query) };
  }

  @Get(":id")
  @AnyRole(Role.ADMIN)
  async get(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<{ enquiry: Enquiry }> {
    return { enquiry: await this.enquiries.get(params.id) };
  }

  @Patch(":id")
  @AnyRole(Role.ADMIN)
  async update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(enquiryUpdateSchema)) body: EnquiryUpdateInput,
  ): Promise<{ enquiry: Enquiry }> {
    return { enquiry: await this.enquiries.update(params.id, body) };
  }

  /** Spam / personal-data cleanup (D28) - audited, id stays in the audit. */
  @Delete(":id")
  @AnyRole(Role.ADMIN)
  async remove(
    @CurrentUser() admin: { id: string },
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ message: string }> {
    return this.enquiries.remove(admin.id, params.id);
  }
}
