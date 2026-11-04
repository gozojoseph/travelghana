import { Injectable } from "@nestjs/common";
import type { UserCounts } from "@travelghana/types";

import { PrismaService } from "../../common/prisma.service";

/**
 * "My TravelGhana" surface helpers. The counts power the nav and card
 * badges on the traveler side (D27); each counter points at a real surface,
 * never a placeholder destination for unbuilt UI.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async counts(userId: string): Promise<UserCounts> {
    const [trips, packageBookings] = await Promise.all([
      this.prisma.trip.count({ where: { ownerUserId: userId } }),
      this.prisma.packageBooking.count({ where: { userId } }),
    ]);
    return { trips, packageBookings };
  }
}
