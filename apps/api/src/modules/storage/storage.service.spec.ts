import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { StorageService, UPLOAD_SCOPES, publicUrlForKey } from "./storage.service";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("StorageService (D45)", () => {
  it("fails fast on an unknown STORAGE_DRIVER instead of silently falling back", () => {
    vi.stubEnv("STORAGE_DRIVER", "cloudinary");
    expect(() => new StorageService()).toThrow(/STORAGE_DRIVER/);
  });

  it("uses the local driver under UPLOAD_DIR and mints scoped, extension-typed keys", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "tg-storage-spec-"));
    vi.stubEnv("UPLOAD_DIR", root);

    const service = new StorageService();
    const stored = await service.put("gallery", "image/png", Buffer.from("png bytes"));

    expect(UPLOAD_SCOPES).toContain("gallery");
    expect(stored.key).toMatch(/^gallery\/[0-9a-f]{24}\.png$/);
    expect(stored.url).toBe(publicUrlForKey(stored.key));
    expect(stored.url).toMatch(/^\/api\/uploads\//); // first-party relative path

    // The bytes physically landed under the configured root.
    expect((await readFile(path.join(root, stored.key))).toString()).toBe("png bytes");

    rmSync(root, { recursive: true, force: true });
  });

  it("rejects mime types outside the extension map before touching the disk", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "tg-storage-spec-"));
    vi.stubEnv("UPLOAD_DIR", root);

    const service = new StorageService();
    await expect(
      service.put("gallery", "image/svg+xml", Buffer.from("<svg/>")),
    ).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_FILE_TYPE" });

    rmSync(root, { recursive: true, force: true });
  });
});
