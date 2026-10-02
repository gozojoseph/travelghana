import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { destinationListQuerySchema, destinationSlugSchema } from "@travelghana/validation";
import { z } from "zod";

import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { DestinationsService } from "./destinations.service";

/** Public discovery endpoints (§14 — search starts simple, extensible filters). */
@Controller("destinations")
export class DestinationsController {
  constructor(private readonly destinations: DestinationsService) {}

  @Public()
  @Get()
  list(
    @Query(new ZodValidationPipe(destinationListQuerySchema))
    query: z.infer<typeof destinationListQuerySchema>,
  ) {
    return this.destinations.list(query);
  }

  @Public()
  @Get("regions")
  regions() {
    return this.destinations.listRegions();
  }

  @Public()
  @Get("cities")
  cities(@Query("region") regionSlug?: string) {
    return this.destinations.listCities(regionSlug);
  }

  @Public()
  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const parsed = destinationSlugSchema.safeParse({ slug });
    if (!parsed.success) {
      throw new NotFoundException("Destination not found");
    }
    return this.destinations.getBySlug(parsed.data.slug);
  }
}
