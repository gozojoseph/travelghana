import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/errors/api-error";
import { OperatorService } from "./operator.service";

// PrismaService is mocked — service logic here; full DB coverage in the
// integration suite (test/*.int.spec.ts).
const db = {
  provider: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  roleMembership: {
    upsert: vi.fn(),
  },
  tour: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  experience: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  city: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
};

const service = new OperatorService(db as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onboard", () => {
  it("creates the provider and grants the matching role", async () => {
    db.provider.findUnique.mockResolvedValue(null); // no provider yet, slug free
    db.provider.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);
    db.city.findUnique.mockResolvedValue({ id: "c1" });

    const provider = await service.onboard("u1", {
      type: "TOUR_OPERATOR",
      name: "Accra Adventures",
    } as never);

    expect(provider.name).toBe("Accra Adventures");
    expect(db.provider.create).toHaveBeenCalledOnce();
    expect(db.roleMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_role: { userId: "u1", role: "TOUR_OPERATOR" } },
        create: { userId: "u1", role: "TOUR_OPERATOR" },
      }),
    );
  });

  it("maps HOTEL to HOTEL_MANAGER role", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    db.provider.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    await service.onboard("u1", { type: "HOTEL", name: "Coast Stays" } as never);

    expect(db.roleMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_role: { userId: "u1", role: "HOTEL_MANAGER" } },
      }),
    );
  });

  it("rejects a second provider with PROVIDER_EXISTS", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });

    await expect(
      service.onboard("u1", { type: "HOTEL", name: "Again Ltd" } as never),
    ).rejects.toMatchObject({ code: "PROVIDER_EXISTS", status: 409 } satisfies Partial<ApiError>);
  });

  it("rejects unknown city with CITY_NOT_FOUND", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    db.city.findUnique.mockResolvedValue(null);

    await expect(
      service.onboard("u1", { type: "HOTEL", name: "X", cityId: "nope" } as never),
    ).rejects.toMatchObject({ code: "CITY_NOT_FOUND", status: 400 });
  });

  it("suffixes the slug when the name is already taken", async () => {
    db.provider.findUnique
      .mockResolvedValueOnce(null) // no provider for this user
      .mockResolvedValueOnce({ id: "other" }) // slug "accra-adventures" taken
      .mockResolvedValueOnce({ id: "other" }) // slug "accra-adventures-2" taken
      .mockResolvedValue(null); // slug "accra-adventures-3" free
    db.provider.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    const provider = await service.onboard("u1", {
      type: "TOUR_OPERATOR",
      name: "Accra Adventures",
    } as never);

    expect(provider.slug).toBe("accra-adventures-3");
  });
});

describe("listing ownership", () => {
  const provider = { id: "p1", userId: "u1" };

  it("404s when the user has no provider", async () => {
    db.provider.findUnique.mockResolvedValue(null);

    await expect(service.listTours("u1")).rejects.toMatchObject({
      code: "NO_PROVIDER",
      status: 404,
    });
  });

  it("404s on another provider's tour (no existence oracle)", async () => {
    db.provider.findUnique.mockResolvedValue(provider);
    db.tour.findUnique.mockResolvedValue({ id: "t9", providerId: "someone-else" });

    await expect(service.deleteTour("u1", "t9")).rejects.toMatchObject({
      code: "TOUR_NOT_FOUND",
      status: 404,
    });
    expect(db.tour.delete).not.toHaveBeenCalled();
  });

  it("deletes an owned tour", async () => {
    db.provider.findUnique.mockResolvedValue(provider);
    db.tour.findUnique.mockResolvedValue({ id: "t1", providerId: "p1" });

    await service.deleteTour("u1", "t1");

    expect(db.tour.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });
});

describe("tours", () => {
  const provider = { id: "p1", userId: "u1" };

  beforeEach(() => {
    db.provider.findUnique.mockResolvedValue(provider);
    db.city.findUnique.mockResolvedValue({ id: "c1" });
  });

  it("creates a tour with a slugified title", async () => {
    db.tour.findFirst.mockResolvedValue(null);
    db.tour.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    const tour = await service.createTour("u1", {
      title: "Cape Coast & Elmina Day Trip",
      basePriceMinor: 85000,
      currencyCode: "GHS",
    } as never);

    expect(tour.slug).toBe("cape-coast-elmina-day-trip");
    expect(tour.basePriceMinor).toBe(85000);
    expect(tour.currencyCode).toBe("GHS");
  });

  it("re-derives the slug when the title changes, skipping the current tour", async () => {
    db.tour.findUnique.mockResolvedValue({ id: "t1", providerId: "p1" });
    db.tour.findFirst.mockResolvedValue(null);
    db.tour.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    const tour = await service.updateTour("u1", "t1", { title: "New Name" } as never);

    expect(tour.title).toBe("New Name");
    expect(tour.slug).toBe("new-name");
    expect(db.tour.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: "p1",
          slug: "new-name",
          NOT: { id: "t1" },
        }),
      }),
    );
  });

  it("keeps the slug when the title is unchanged", async () => {
    db.tour.findUnique.mockResolvedValue({ id: "t1", providerId: "p1" });
    db.tour.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    const tour = await service.updateTour("u1", "t1", { basePriceMinor: 90000 } as never);

    expect(tour.slug).toBeUndefined(); // not set in the update payload
    expect(db.tour.findFirst).not.toHaveBeenCalled();
  });
});

describe("experiences", () => {
  const provider = { id: "p1", userId: "u1" };

  beforeEach(() => {
    db.provider.findUnique.mockResolvedValue(provider);
  });

  it("creates an experience with a slugified title", async () => {
    db.experience.findFirst.mockResolvedValue(null);
    db.experience.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => data);

    const experience = await service.createExperience("u1", {
      title: "Kente Weaving Workshop",
      priceMinor: 25000,
    } as never);

    expect(experience.slug).toBe("kente-weaving-workshop");
  });

  it("404s on another provider's experience", async () => {
    db.experience.findUnique.mockResolvedValue({ id: "e9", providerId: "not-mine" });

    await expect(service.deleteExperience("u1", "e9")).rejects.toMatchObject({
      code: "EXPERIENCE_NOT_FOUND",
      status: 404,
    });
  });
});
