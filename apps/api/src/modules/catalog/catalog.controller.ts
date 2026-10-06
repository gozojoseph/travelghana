import { Controller, Get, Param, Query } from "@nestjs/common";
import type { Experience, Tour } from "@travelghana/database";
import {
  catalogListQuerySchema,
  providerListingSlugSchema,
} from "@travelghana/validation";
import { z } from "zod";

import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { CatalogService } from "./catalog.service";

/** Public discovery of published operator listings — no authentication. */
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get("tours")
  tours(
    @Query(new ZodValidationPipe(catalogListQuerySchema))
    query: z.infer<typeof catalogListQuerySchema>,
  ) {
    return this.catalog.listTours(query);
  }

  @Public()
  @Get("tours/:providerSlug/:listingSlug")
  tour(
    @Param(new ZodValidationPipe(providerListingSlugSchema))
    params: z.infer<typeof providerListingSlugSchema>,
  ): Promise<Tour> {
    return this.catalog.getTour(params);
  }

  @Public()
  @Get("experiences")
  experiences(
    @Query(new ZodValidationPipe(catalogListQuerySchema))
    query: z.infer<typeof catalogListQuerySchema>,
  ) {
    return this.catalog.listExperiences(query);
  }

  @Public()
  @Get("experiences/:providerSlug/:listingSlug")
  experience(
    @Param(new ZodValidationPipe(providerListingSlugSchema))
    params: z.infer<typeof providerListingSlugSchema>,
  ): Promise<Experience> {
    return this.catalog.getExperience(params);
  }
}
