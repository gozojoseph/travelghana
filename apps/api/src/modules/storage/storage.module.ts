import { Module } from "@nestjs/common";

import { StorageService } from "./storage.service";

/**
 * Storage abstraction (D45). Providers selecting STORAGE_DRIVER register the
 * backing driver once; feature modules only ever see StorageService.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
