import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Global access to the shared Prisma client (packages/database).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
