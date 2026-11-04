import { Injectable } from "@nestjs/common";
import { Prisma } from "@travelghana/database";
import type { SiteSettings as DbSiteSettings } from "@travelghana/database";
import type { SiteSettings } from "@travelghana/types";
import type { SiteSettingsUpdateInput } from "@travelghana/validation";

import { PrismaService } from "../../common/prisma.service";

/** Fixed singleton id; there is exactly one settings row per deployment. */
const SETTINGS_ID = "site";

/** Fixed field order keeps the audit meta deterministic. */
const FIELD_KEYS = [
  "phone",
  "whatsapp",
  "email",
  "address",
  "facebookUrl",
  "instagramUrl",
  "twitterUrl",
  "youtubeUrl",
  "momoInstructions",
  "bankInstructions",
] as const;

/** All-null snapshot shown before any admin has saved settings. */
export const EMPTY_SETTINGS: SiteSettings = {
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  facebookUrl: null,
  instagramUrl: null,
  twitterUrl: null,
  youtubeUrl: null,
  momoInstructions: null,
  bankInstructions: null,
  updatedAt: null,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SiteSettings> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
    return this.toDto(row as DbSiteSettings | null);
  }

  async update(actorUserId: string, input: SiteSettingsUpdateInput): Promise<SiteSettings> {
    // D24 semantics: the PATCH is a full replace. Every field arrives filled
    // or empty; an empty string clears the stored value (null).
    const data = {
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      email: input.email || null,
      address: input.address || null,
      facebookUrl: input.facebookUrl || null,
      instagramUrl: input.instagramUrl || null,
      twitterUrl: input.twitterUrl || null,
      youtubeUrl: input.youtubeUrl || null,
      // D44: manual payment instruction blocks (confirmation emails only).
      momoInstructions: input.momoInstructions || null,
      bankInstructions: input.bankInstructions || null,
    };

    const row = await this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });

    const filledFields = FIELD_KEYS.filter((key) => (input[key] ?? "").length > 0);
    const clearedFields = FIELD_KEYS.filter((key) => input[key].length === 0);
    await this.auditSave(actorUserId, filledFields, clearedFields);

    return this.toDto(row as DbSiteSettings | null);
  }

  private async auditSave(
    actorUserId: string,
    filledFields: readonly string[],
    clearedFields: readonly string[],
  ): Promise<void> {
    const meta: Prisma.InputJsonObject = { filledFields: [...filledFields], clearedFields: [...clearedFields] };
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "SITE_SETTINGS_UPDATED",
        entityType: "SiteSettings",
        entityId: SETTINGS_ID,
        meta,
      },
    });
  }

  private toDto(row: DbSiteSettings | null): SiteSettings {
    if (!row) return EMPTY_SETTINGS;
    return {
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.email,
      address: row.address,
      facebookUrl: row.facebookUrl,
      instagramUrl: row.instagramUrl,
      twitterUrl: row.twitterUrl,
      youtubeUrl: row.youtubeUrl,
      momoInstructions: row.momoInstructions,
      bankInstructions: row.bankInstructions,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
