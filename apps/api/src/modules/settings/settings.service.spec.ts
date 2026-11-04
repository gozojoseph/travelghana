import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SETTINGS, SettingsService } from "./settings.service";

// PrismaService is mocked here; the Postgres-backed singleton behaviour is
// exercised by the dev database (the row is a fixed-id upsert).
const db = {
  siteSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

const service = new SettingsService(db as never);

const now = new Date("2026-10-20T09:00:00.000Z");

function savedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "site",
    phone: "+233 30 123 4567",
    whatsapp: "+233 55 987 6543",
    email: "hello@travelghana.example",
    address: "Independence Avenue, Accra",
    facebookUrl: "https://facebook.com/travelghana",
    instagramUrl: null,
    twitterUrl: null,
    youtubeUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsService.get", () => {
  it("maps the stored row to the public DTO", async () => {
    db.siteSettings.findUnique.mockResolvedValue(savedRow());

    const dto = await service.get();

    expect(db.siteSettings.findUnique).toHaveBeenCalledWith({ where: { id: "site" } });
    expect(dto).toEqual({
      phone: "+233 30 123 4567",
      whatsapp: "+233 55 987 6543",
      email: "hello@travelghana.example",
      address: "Independence Avenue, Accra",
      facebookUrl: "https://facebook.com/travelghana",
      instagramUrl: null,
      twitterUrl: null,
      youtubeUrl: null,
      updatedAt: now.toISOString(),
    });
  });

  it("returns an all-null DTO before the first admin save", async () => {
    db.siteSettings.findUnique.mockResolvedValue(null);

    expect(await service.get()).toEqual(EMPTY_SETTINGS);
  });
});

describe("SettingsService.update", () => {
  const input = (overrides: Record<string, string> = {}) => ({
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    youtubeUrl: "",
    momoInstructions: "",
    bankInstructions: "",
    ...overrides,
  });

  it("upserts the singleton row with empty strings cleared to null", async () => {
    db.siteSettings.upsert.mockResolvedValue(savedRow());

    const dto = await service.update("admin-1", input({
      phone: "+233 30 123 4567",
      whatsapp: "",
      email: "hello@travelghana.example",
      address: "Independence Avenue, Accra",
      facebookUrl: "https://facebook.com/travelghana",
      youtubeUrl: "https://youtube.com/@travelghana",
    }));

    expect(dto.updatedAt).toBe(now.toISOString());

    const arg = db.siteSettings.upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: "site" });
    expect(arg.update.phone).toBe("+233 30 123 4567");
    expect(arg.update.whatsapp).toBeNull();
    expect(arg.update.youtubeUrl).toBe("https://youtube.com/@travelghana");
    expect(arg.create.whatsapp).toBeNull();
  });

  it("records every save in the audit log with filled + cleared fields", async () => {
    db.siteSettings.upsert.mockResolvedValue(savedRow());

    await service.update("admin-1", input({
      phone: "+233 30 123 4567",
      email: "hello@travelghana.example",
    }));

    const arg = db.auditLog.create.mock.calls[0]![0];
    expect(arg.data.action).toBe("SITE_SETTINGS_UPDATED");
    expect(arg.data.entityType).toBe("SiteSettings");
    expect(arg.data.entityId).toBe("site");
    expect(arg.data.actorUserId).toBe("admin-1");
    expect(arg.data.meta).toEqual({
      filledFields: ["phone", "email"],
      clearedFields: [
        "whatsapp",
        "address",
        "facebookUrl",
        "instagramUrl",
        "twitterUrl",
        "youtubeUrl",
        "momoInstructions",
        "bankInstructions",
      ],
    });
  });
});
