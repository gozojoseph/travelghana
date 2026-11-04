import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { LocalStorageDriver, isValidStorageKey } from "./local-storage.driver";

/** Every temp root gets its own dir; cleaned up exhaustively in afterAll. */
const dirs: string[] = [];
let root: string;
let driver: LocalStorageDriver;

afterAll(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "tg-uploads-spec-"));
  dirs.push(root);
  driver = new LocalStorageDriver(root);
});

describe("LocalStorageDriver (D45)", () => {
  it("round-trips bytes with the content type derived from the key", async () => {
    const data = Buffer.from("not really a png, just bytes");
    await driver.put("gallery/abc123.png", data);

    const stored = await driver.get("gallery/abc123.png");
    expect(stored?.data.equals(data)).toBe(true);
    expect(stored?.contentType).toBe("image/png");
  });

  it("maps whitelisted extensions to content types", async () => {
    await driver.put("gallery/a.webp", Buffer.from("w"));
    await driver.put("gallery/b.avif", Buffer.from("a"));
    expect((await driver.get("gallery/a.webp"))?.contentType).toBe("image/webp");
    expect((await driver.get("gallery/b.avif"))?.contentType).toBe("image/avif");
  });

  it("returns null for misses without throwing", async () => {
    expect(await driver.get("gallery/none.png")).toBeNull();
  });

  it("deletes idempotently", async () => {
    await driver.put("gallery/gone.png", Buffer.from("x"));
    await driver.delete("gallery/gone.png");
    expect(await driver.get("gallery/gone.png")).toBeNull();
    await driver.delete("gallery/gone.png"); // second call is a no-op
  });

  it("rejects traversal and malformed keys on write", async () => {
    await expect(driver.put("gallery/../../evil.png", Buffer.from("x"))).rejects.toThrow();
    await expect(driver.put("gallery/./x.png", Buffer.from("x"))).rejects.toThrow();
    await expect(driver.put("gallery\\backslash.png", Buffer.from("x"))).rejects.toThrow();
    await expect(driver.put("gallery/has space.png", Buffer.from("x"))).rejects.toThrow();
    await expect(driver.put("gallery/", Buffer.from("x"))).rejects.toThrow();
  });

  it("misses instead of throwing on traversal reads", async () => {
    expect(await driver.get("../secret.env")).toBeNull();
    expect(await driver.get("gallery/../../.env")).toBeNull();
  });

  it("never resolves outside the root even with a crafted key", async () => {
    await expect(driver.put("gallery/..%2F..%2F.env", Buffer.from("x"))).rejects.toThrow();
  });
});

describe("isValidStorageKey", () => {
  it("accepts minted keys", () => {
    expect(isValidStorageKey("gallery/84b19c22aa0d3f11d2e701c5.png")).toBe(true);
  });

  it("rejects user-crafted paths", () => {
    expect(isValidStorageKey("")).toBe(false);
    expect(isValidStorageKey("gallery/../.env")).toBe(false);
    expect(isValidStorageKey("gallery/photo name.png")).toBe(false);
    expect(isValidStorageKey("gallery/semi;colon.png")).toBe(false);
    expect(isValidStorageKey(`gallery/${"x".repeat(300)}.png`)).toBe(false);
  });
});
