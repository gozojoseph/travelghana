import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageDriver, StoredObject } from "./storage.types";

/**
 * Extension map shared by the storage surface: uploaded keys are minted with
 * a whitelisted extension, and the serving side derives the content type from
 * that same extension (one source of truth, no sidecar files).
 */
export const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

/** Keys are minted internally; this guard blocks every crafted path. */
export function isValidStorageKey(key: string): boolean {
  if (!key || key.length > 200) return false;
  if (key.includes("\\") || key.includes("\0")) return false;
  if (key.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key);
}

function contentTypeForKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/**
 * Local-disk driver (dev/preview era): files live under one root, keys are
 * minted by the service (never user input), and every read/write re-checks
 * that the resolved path stays inside the root.
 */
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  private resolveInsideRoot(key: string): string {
    if (!isValidStorageKey(key)) {
      throw new Error("Invalid storage key");
    }
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolveInsideRoot(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<StoredObject | null> {
    let target: string;
    try {
      target = this.resolveInsideRoot(key);
    } catch {
      return null; // invalid keys simply miss
    }
    try {
      const data = await readFile(target);
      return { data, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveInsideRoot(key));
    } catch {
      // Deleting an absent object is not an error for our use (idempotent).
    }
  }
}
