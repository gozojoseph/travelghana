import { describe, expect, it } from "vitest";

import { generateToken, hashPassword, hashToken, verifyPassword } from "./passwords";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored.startsWith("scrypt$")).toBe(true);

    const valid = await verifyPassword("correct horse battery staple", stored);
    expect(valid).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("secret-password");
    const valid = await verifyPassword("wrong-password", stored);
    expect(valid).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    await expect(verifyPassword("x", "garbage")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt$ab$cd")).resolves.toBe(false);
  });
});

describe("tokens", () => {
  it("generates url-safe high-entropy tokens", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(token).not.toContain("=");
  });

  it("hashes tokens deterministically for storage", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
});
