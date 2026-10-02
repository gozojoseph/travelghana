import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/errors/api-error";
import { AuthService } from "./auth.service";
import { MAILER, type Mailer } from "./mailer";

// PrismaService is mocked — service logic is unit-tested here; integration
// coverage comes later with a test database.
const db = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  session: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  roleMembership: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
};

const mailer: Mailer = { send: vi.fn(async () => undefined) };

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "u1",
    email: "ama@example.com",
    name: "Ama",
    passwordHash: null,
    emailVerifiedAt: new Date(),
    status: "ACTIVE",
    memberships: [{ role: "TRAVELER", status: "ACTIVE" }],
    ...overrides,
  };
}

describe("AuthService.login", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(db as never, mailer);
  });

  it("throws INVALID_CREDENTIALS for unknown email", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: "nobody@example.com", password: "pw" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("throws INVALID_CREDENTIALS on wrong password", async () => {
    const user = makeUser({ passwordHash: "scrypt$ab$".padEnd(20, "0") });
    db.user.findUnique.mockResolvedValue(user);
    await expect(service.login({ email: "ama@example.com", password: "wrong" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("throws ACCOUNT_SUSPENDED for suspended users", async () => {
    const { hashPassword } = await import("./passwords");
    const user = makeUser({ status: "SUSPENDED", passwordHash: await hashPassword("right") });
    db.user.findUnique.mockResolvedValue(user);
    await expect(service.login({ email: "ama@example.com", password: "right" })).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
  });
});

describe("AuthService.register", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(db as never, mailer);
  });

  it("rejects duplicate emails with EMAIL_TAKEN", async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    await expect(
      service.register({ name: "Ama", email: "ama@example.com", password: "password123" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("creates a traveler and sends a verification email", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(makeUser({ emailVerifiedAt: null }));
    const result = await service.register({ name: "Ama", email: "ama@example.com", password: "password123" });

    expect(result.user.roles).toContain("TRAVELER");
    expect(result.sessionToken).toBeDefined();
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });
});

describe("AuthService email verification", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(db as never, mailer);
  });

  it("rejects unknown or consumed tokens", async () => {
    db.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyEmail("bad-token")).rejects.toBeInstanceOf(ApiError);

    db.emailVerificationToken.findUnique.mockResolvedValue({
      id: "t1",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.verifyEmail("used-token")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("consumes the token and marks the email verified", async () => {
    db.emailVerificationToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await service.verifyEmail("good-token");
    expect(db.emailVerificationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });
});

describe("AuthService.forgotPassword", () => {
  it("stays silent for unknown emails (no enumeration)", async () => {
    vi.clearAllMocks();
    const svc = new AuthService(db as never, mailer);
    db.user.findUnique.mockResolvedValue(null);
    await svc.forgotPassword("ghost@example.com");
    expect(mailer.send).not.toHaveBeenCalled();
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("sends a reset link for known emails", async () => {
    vi.clearAllMocks();
    const svc = new AuthService(db as never, mailer);
    db.user.findUnique.mockResolvedValue(makeUser());
    await svc.forgotPassword("ama@example.com");
    expect(db.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });
});

describe("MAILER token", () => {
  it("is exported for DI", () => {
    expect(MAILER).toBeDefined();
  });
});
