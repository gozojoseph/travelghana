import { randomBytes } from "node:crypto";
import path from "node:path";

import { Injectable } from "@nestjs/common";

import { ApiError } from "../../common/errors/api-error";
import { LocalStorageDriver, MIME_BY_EXTENSION } from "./local-storage.driver";
import type { StorageDriver } from "./storage.types";

/** The upload scopes (first-level key directory). Growing set, D46+. */
export const UPLOAD_SCOPES = ["gallery"] as const;
export type UploadScope = (typeof UPLOAD_SCOPES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Served from the browser as a same-origin path via the Next /api proxy. */
export function publicUrlForKey(key: string): string {
  return `/api/uploads/${key}`;
}

/**
 * Facade over the selected driver (D45). Upload URLs live on gallery rows as
 * first-party relative paths so they resolve on localhost, LAN and the dev
 * tunnel alike; the backing store is internal detail.
 *
 * Driver selection: STORAGE_DRIVER=local (default) keeps files on disk under
 * UPLOAD_DIR (default "<apps/api>/uploads"). Any other configured value fails
 * fast here - there is no silent fallback to a different provider.
 */
@Injectable()
export class StorageService {
  private readonly driver: StorageDriver;

  constructor() {
    const driverName = (process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase();
    if (driverName === "local") {
      const root = process.env.UPLOAD_DIR?.trim() || path.resolve(process.cwd(), "uploads");
      this.driver = new LocalStorageDriver(root);
    } else {
      throw new Error(
        `Unsupported STORAGE_DRIVER "${driverName}" - install its driver dependency and wire it in storage.service`,
      );
    }
  }

  /** Mints a fresh key the browser never controls and stores the bytes. */
  async put(scope: UploadScope, mimeType: string, data: Buffer): Promise<{ key: string; url: string }> {
    const extension = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0];
    if (!extension) {
      throw ApiError.badRequest("This file type is not supported", "UNSUPPORTED_FILE_TYPE");
    }
    const suffix = randomBytes(12).toString("hex");
    const key = `${scope}/${suffix}${extension}`;
    await this.driver.put(key, data);
    return { key, url: publicUrlForKey(key) };
  }

  /** Non-throwing for misses; invalid keys also miss. */
  get(key: string) {
    return this.driver.get(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }
}
