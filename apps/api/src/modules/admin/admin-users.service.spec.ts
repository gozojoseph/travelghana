import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/errors/api-error";
import { AdminUsersService } from "./admin-users.service";

const db = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  roleMembership: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

const service = new AdminUsersService(db as never);

const ADMIN_ID = "admin-1";
const TARGET_ID = "target-1";

function userRow(path: string, over: Record<string, unknown> = {}) {
  // Shape matches the Prisma include used by findUser (memberships + provider).
  return {
    id: TARGET_ID,
    email: "user@example.com",
    name: "Target User",
    phone: null,
    status: "ACTIVE",
    emailVerifiedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    memberships: [],
    provider: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.auditLog.create.mockResolvedValue({});
});

describe("update — guardrails", () => {
  it("refuses suspending your own account (SELF_SUSPEND)", async () => {
    db.user.findUnique.mockResolvedValue(
      userRow("self", { id: ADMIN_ID, memberships: [
        { id: "m-admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
      ] }),
    );

    await expect(
      service.update(ADMIN_ID, ADMIN_ID, { status: "SUSPENDED" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "SELF_SUSPEND",
    } satisfies Partial<ApiError>);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses removing your own ADMIN role (SELF_DEMOTE)", async () => {
    db.user.findUnique.mockResolvedValue(
      userRow("self", {
        id: ADMIN_ID,
        memberships: [
          { id: "m-admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
        ],
      }),
    );

    await expect(
      service.update(ADMIN_ID, ADMIN_ID, { removeRoles: ["ADMIN"] }),
    ).rejects.toMatchObject({ status: 409, code: "SELF_DEMOTE" });
    expect(db.roleMembership.update).not.toHaveBeenCalled();
  });

  it("refuses removing the last active ADMIN membership (LAST_ADMIN)", async () => {
    db.user.findUnique.mockResolvedValue(
      userRow("target", {
        memberships: [
          { id: "m-admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
        ],
      }),
    );
    db.roleMembership.count.mockResolvedValue(1);

    await expect(
      service.update(ADMIN_ID, TARGET_ID, { removeRoles: ["ADMIN"] }),
    ).rejects.toMatchObject({ status: 409, code: "LAST_ADMIN" });
    expect(db.roleMembership.update).not.toHaveBeenCalled();
  });

  it("allows removing ADMIN when another active admin remains", async () => {
    db.user.findUnique.mockImplementation((_args: unknown) =>
      Promise.resolve(
        userRow("target", {
          memberships: [
            { id: "m-admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
          ],
        }),
      ),
    );
    db.roleMembership.count.mockResolvedValue(2);
    db.roleMembership.update.mockResolvedValue({});

    const result = await service.update(ADMIN_ID, TARGET_ID, { removeRoles: ["ADMIN"] });

    expect(db.roleMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m-admin" }, data: { status: "SUSPENDED" } }),
    );
    expect(result.message).toContain("removed ADMIN");
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_UPDATED", entityType: "User" }),
      }),
    );
  });

  it("never counts a PENDING admin membership toward the last-admin check", async () => {
    // Target holds only a PENDING admin membership; the one ACTIVE admin is
    // the caller. Removing the PENDING row changes no active admin, so it
    // must be allowed (and is a no-op — PENDING never granted the role).
    db.user.findUnique.mockResolvedValue(
      userRow("target", {
        memberships: [
          { id: "m-admin", role: "ADMIN", status: "PENDING", createdAt: new Date() },
        ],
      }),
    );
    db.roleMembership.count.mockResolvedValue(1);

    const result = await service.update(ADMIN_ID, TARGET_ID, { removeRoles: ["ADMIN"] });

    expect(db.roleMembership.update).not.toHaveBeenCalled();
    expect(result.message).toBe("No changes");
  });
});

describe("update — role grants", () => {
  it("creates a missing membership and records what changed", async () => {
    db.user.findUnique
      .mockResolvedValueOnce(userRow("target", { memberships: [] }))
      .mockResolvedValueOnce(
        userRow("target", {
          memberships: [
            { id: "m-new", role: "TOUR_OPERATOR", status: "ACTIVE", createdAt: new Date() },
          ],
        }),
      );
    db.roleMembership.create.mockResolvedValue({});

    const result = await service.update(ADMIN_ID, TARGET_ID, {
      addRoles: ["TOUR_OPERATOR"],
    });

    expect(db.roleMembership.create).toHaveBeenCalledWith({
      data: { userId: TARGET_ID, role: "TOUR_OPERATOR", status: "ACTIVE" },
    });
    expect(result.user.roles).toEqual(["TOUR_OPERATOR"]);
    expect(result.message).toContain("added TOUR_OPERATOR");
  });

  it("reactivates a suspended membership instead of creating a duplicate", async () => {
    db.user.findUnique
      .mockResolvedValueOnce(
        userRow("target", {
          memberships: [
            { id: "m-op", role: "TOUR_OPERATOR", status: "SUSPENDED", createdAt: new Date() },
          ],
        }),
      )
      .mockResolvedValueOnce(
        userRow("target", {
          memberships: [
            { id: "m-op", role: "TOUR_OPERATOR", status: "ACTIVE", createdAt: new Date() },
          ],
        }),
      );
    db.roleMembership.update.mockResolvedValue({});

    const result = await service.update(ADMIN_ID, TARGET_ID, {
      addRoles: ["TOUR_OPERATOR"],
    });

    expect(db.roleMembership.create).not.toHaveBeenCalled();
    expect(db.roleMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m-op" }, data: { status: "ACTIVE" } }),
    );
    expect(result.message).toContain("activated TOUR_OPERATOR");
  });
});

describe("update — status", () => {
  it("suspends another admin's account and audits the change", async () => {
    db.user.findUnique
      .mockResolvedValueOnce(
        userRow("target", {
          status: "ACTIVE",
          memberships: [],
        }),
      )
      .mockResolvedValueOnce(
        userRow("target", {
          status: "SUSPENDED",
          memberships: [],
        }),
      );
    db.user.update.mockResolvedValue({});

    const result = await service.update(ADMIN_ID, TARGET_ID, { status: "SUSPENDED" });

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET_ID },
        data: { status: "SUSPENDED" },
      }),
    );
    expect(result.message).toContain("SUSPENDED");
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("audits nothing when the patch changes nothing", async () => {
    db.user.findUnique
      .mockResolvedValueOnce(
        userRow("target", { status: "ACTIVE", memberships: [] }),
      )
      .mockResolvedValueOnce(
        userRow("target", { status: "ACTIVE", memberships: [] }),
      );

    const result = await service.update(ADMIN_ID, TARGET_ID, { status: "ACTIVE" });

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(result.message).toBe("No changes");
  });
});

describe("list", () => {
  it("maps roles from ACTIVE memberships only", async () => {
    db.user.findMany.mockResolvedValue([
      userRow("a", {
        memberships: [
          { id: "m1", role: "TRAVELER", status: "ACTIVE", createdAt: new Date() },
          { id: "m2", role: "TOUR_OPERATOR", status: "SUSPENDED", createdAt: new Date() },
        ],
        provider: { id: "prov-1" },
      }),
    ]);
    db.user.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, pageSize: 25 });

    expect(result.total).toBe(1);
    expect(result.pages).toBe(1);
    expect(result.items[0]).toMatchObject({
      roles: ["TRAVELER"],
      providerId: "prov-1",
      emailVerified: true,
    });
  });

  it("computes pages for partial results", async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(26);

    const result = await service.list({ page: 1, pageSize: 25 });

    expect(result.pages).toBe(2);
  });
});
