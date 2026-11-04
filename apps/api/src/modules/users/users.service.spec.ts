import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersService } from "./users.service";

// PrismaService is mocked here; the Postgres-backed behaviour is covered by
// test/bookings.int.spec.ts (users/counts rides the same fixtures).
const db = {
  trip: { count: vi.fn() },
  packageBooking: { count: vi.fn() },
};

const service = new UsersService(db as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsersService.counts", () => {
  it("counts the member's owned trips and package bookings", async () => {
    db.trip.count.mockResolvedValue(2);
    db.packageBooking.count.mockResolvedValue(1);

    const counts = await service.counts("u1");

    expect(db.trip.count).toHaveBeenCalledWith({ where: { ownerUserId: "u1" } });
    expect(db.packageBooking.count).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(counts).toEqual({ trips: 2, packageBookings: 1 });
  });
});
