import { Injectable } from "@nestjs/common";
import type { Provider, Role, Tour, Experience } from "@travelghana/database";
import {
  ONBOARDABLE_PROVIDER_TYPES,
  type ExperienceCreateInput,
  type ExperienceUpdateInput,
  type ProviderOnboardInput,
  type ProviderUpdateInput,
  type TourCreateInput,
  type TourUpdateInput,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { PrismaService } from "../../common/prisma.service";

/** Provider type → RBAC role granted at onboarding (D3: one account, many roles). */
const ROLE_FOR_TYPE: Record<(typeof ONBOARDABLE_PROVIDER_TYPES)[number], Role> = {
  TOUR_OPERATOR: "TOUR_OPERATOR",
  HOTEL: "HOTEL_MANAGER",
  EXPERIENCE_PROVIDER: "EXPERIENCE_PROVIDER",
  TRANSPORT_COMPANY: "TRANSPORT_COMPANY",
};

const MAX_SLUG = 80;

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG);
  return base || "listing";
}

/**
 * Operator self-service (D5 operator-first): provider onboarding + management
 * of tour and experience listings. Hotel rooms, transport (vehicles/drivers),
 * events and the public catalog arrive in their own increments.
 */
@Injectable()
export class OperatorService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Provider ────────────────────────────────────────────────────────────────

  async getProvider(userId: string): Promise<Provider | null> {
    return this.prisma.provider.findUnique({ where: { userId } });
  }

  async onboard(userId: string, input: ProviderOnboardInput): Promise<Provider> {
    const existing = await this.prisma.provider.findUnique({ where: { userId } });
    if (existing) {
      throw ApiError.conflict("This account already operates a provider", "PROVIDER_EXISTS");
    }
    await this.assertCityExists(input.cityId);

    const slug = await this.uniqueProviderSlug(input.name);
    const role = ROLE_FOR_TYPE[input.type];

    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.create({
        data: {
          userId,
          type: input.type,
          name: input.name,
          slug,
          description: input.description,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          cityId: input.cityId,
        },
      });
      // D3: add the operator role; re-activate if previously suspended.
      await tx.roleMembership.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role },
        update: { status: "ACTIVE" },
      });
      return provider;
    });
  }

  async updateProvider(userId: string, input: ProviderUpdateInput): Promise<Provider> {
    const provider = await this.ownProvider(userId);
    await this.assertCityExists(input.cityId);
    return this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        name: input.name,
        description: input.description,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        cityId: input.cityId,
      },
    });
  }

  // ─── Tours ──────────────────────────────────────────────────────────────────

  listTours(userId: string): Promise<Tour[]> {
    return this.ownListings(userId, (providerId) =>
      this.prisma.tour.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } }),
    );
  }

  async createTour(userId: string, input: TourCreateInput): Promise<Tour> {
    const provider = await this.ownProvider(userId);
    await this.assertCityExists(input.cityId);
    const slug = await this.uniqueListingSlug(input.title, (s) =>
      this.prisma.tour.findFirst({ where: { providerId: provider.id, slug: s }, select: { id: true } }),
    );
    return this.prisma.tour.create({
      data: {
        providerId: provider.id,
        slug,
        title: input.title,
        summary: input.summary,
        description: input.description,
        durationHours: input.durationHours,
        days: input.days,
        groupMin: input.groupMin,
        groupMax: input.groupMax,
        basePriceMinor: input.basePriceMinor,
        currencyCode: input.currencyCode,
        cityId: input.cityId,
        meetingPoint: input.meetingPoint,
        category: input.category,
        published: input.published,
      },
    });
  }

  async updateTour(userId: string, tourId: string, input: TourUpdateInput): Promise<Tour> {
    const provider = await this.ownProvider(userId);
    const tour = await this.ownTour(provider.id, tourId);
    await this.assertCityExists(input.cityId);
    const slug =
      input.title === undefined
        ? undefined
        : await this.uniqueListingSlug(input.title, (s) =>
            this.prisma.tour.findFirst({
              where: { providerId: provider.id, slug: s, NOT: { id: tour.id } },
              select: { id: true },
            }),
          );
    return this.prisma.tour.update({
      where: { id: tour.id },
      data: {
        title: input.title,
        summary: input.summary,
        description: input.description,
        durationHours: input.durationHours,
        days: input.days,
        groupMin: input.groupMin,
        groupMax: input.groupMax,
        basePriceMinor: input.basePriceMinor,
        currencyCode: input.currencyCode,
        cityId: input.cityId,
        meetingPoint: input.meetingPoint,
        category: input.category,
        slug,
        published: input.published,
      },
    });
  }

  async deleteTour(userId: string, tourId: string): Promise<void> {
    const provider = await this.ownProvider(userId);
    const tour = await this.ownTour(provider.id, tourId);
    await this.prisma.tour.delete({ where: { id: tour.id } });
  }

  // ─── Experiences ────────────────────────────────────────────────────────────

  listExperiences(userId: string): Promise<Experience[]> {
    return this.ownListings(userId, (providerId) =>
      this.prisma.experience.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } }),
    );
  }

  async createExperience(userId: string, input: ExperienceCreateInput): Promise<Experience> {
    const provider = await this.ownProvider(userId);
    await this.assertCityExists(input.cityId);
    const slug = await this.uniqueListingSlug(input.title, (s) =>
      this.prisma.experience.findFirst({ where: { providerId: provider.id, slug: s }, select: { id: true } }),
    );
    return this.prisma.experience.create({
      data: {
        providerId: provider.id,
        slug,
        title: input.title,
        description: input.description,
        durationMinutes: input.durationMinutes,
        priceMinor: input.priceMinor,
        currencyCode: input.currencyCode,
        cityId: input.cityId,
        category: input.category,
        published: input.published,
      },
    });
  }

  async updateExperience(
    userId: string,
    experienceId: string,
    input: ExperienceUpdateInput,
  ): Promise<Experience> {
    const provider = await this.ownProvider(userId);
    const experience = await this.ownExperience(provider.id, experienceId);
    await this.assertCityExists(input.cityId);
    const slug =
      input.title === undefined
        ? undefined
        : await this.uniqueListingSlug(input.title, (s) =>
            this.prisma.experience.findFirst({
              where: { providerId: provider.id, slug: s, NOT: { id: experience.id } },
              select: { id: true },
            }),
          );
    return this.prisma.experience.update({
      where: { id: experience.id },
      data: {
        title: input.title,
        description: input.description,
        durationMinutes: input.durationMinutes,
        priceMinor: input.priceMinor,
        currencyCode: input.currencyCode,
        cityId: input.cityId,
        category: input.category,
        slug,
        published: input.published,
      },
    });
  }

  async deleteExperience(userId: string, experienceId: string): Promise<void> {
    const provider = await this.ownProvider(userId);
    const experience = await this.ownExperience(provider.id, experienceId);
    await this.prisma.experience.delete({ where: { id: experience.id } });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async ownProvider(userId: string): Promise<Provider> {
    const provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) throw ApiError.notFound("No provider profile — onboard first", "NO_PROVIDER");
    return provider;
  }

  private async ownListings<T>(
    userId: string,
    find: (providerId: string) => Promise<T[]>,
  ): Promise<T[]> {
    const provider = await this.ownProvider(userId);
    return find(provider.id);
  }

  private async ownTour(providerId: string, tourId: string): Promise<Tour> {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour || tour.providerId !== providerId) {
      // Same answer for missing and not-yours: no existence oracle (§40).
      throw ApiError.notFound("Tour not found", "TOUR_NOT_FOUND");
    }
    return tour;
  }

  private async ownExperience(providerId: string, experienceId: string): Promise<Experience> {
    const experience = await this.prisma.experience.findUnique({ where: { id: experienceId } });
    if (!experience || experience.providerId !== providerId) {
      throw ApiError.notFound("Experience not found", "EXPERIENCE_NOT_FOUND");
    }
    return experience;
  }

  private async assertCityExists(cityId?: string): Promise<void> {
    if (cityId === undefined) return;
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw ApiError.badRequest("Unknown city", "CITY_NOT_FOUND");
  }

  private async uniqueProviderSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    for (let n = 2; ; n++) {
      const taken = await this.prisma.provider.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
      candidate = `${base}-${n}`;
    }
  }

  private async uniqueListingSlug(
    title: string,
    taken: (slug: string) => Promise<{ id: string } | null>,
  ): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    for (let n = 2; ; n++) {
      if (!(await taken(candidate))) return candidate;
      candidate = `${base}-${n}`;
    }
  }
}
