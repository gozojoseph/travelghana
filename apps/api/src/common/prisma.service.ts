import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { PrismaClient } from "@travelghana/database";

/**
 * One Prisma client instance per API process, connected on first use and
 * disconnected on shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
