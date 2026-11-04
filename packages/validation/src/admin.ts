import { z } from "zod";

/**
 * Shared zod schemas — used by API controllers and web forms alike.
 */

export const adminRoleSchema = z.enum([
  "TRAVELER",
  "DRIVER",
  "TOUR_OPERATOR",
  "HOTEL_MANAGER",
  "TRANSPORT_COMPANY",
  "EXPERIENCE_PROVIDER",
  "ADMIN",
]);

const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);

// ─── Users & roles ───────────────────────────────────────────────────────────

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const adminUserUpdateSchema = z
  .object({
    addRoles: z.array(adminRoleSchema).max(7).optional(),
    removeRoles: z.array(adminRoleSchema).max(7).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine(
    (v) =>
      (v.addRoles !== undefined && v.addRoles.length > 0) ||
      (v.removeRoles !== undefined && v.removeRoles.length > 0) ||
      v.status !== undefined,
    { message: "No changes provided" },
  );

// ─── Providers (verification) ────────────────────────────────────────────────

export const adminProvidersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  verificationStatus: z
    .enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "SUSPENDED"])
    .optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const adminProviderPatchSchema = z.object({
  verificationStatus: z.enum([
    "UNVERIFIED",
    "PENDING",
    "VERIFIED",
    "REJECTED",
    "SUSPENDED",
  ]),
});

// ─── Audit trail ─────────────────────────────────────────────────────────────

export const adminAuditQuerySchema = z.object({
  actor: z.string().trim().max(64).optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  entityId: z.string().trim().max(64).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

// ─── Notification outbox ─────────────────────────────────────────────────────

export const adminNotificationsQuerySchema = z.object({
  status: z.enum(["QUEUED", "SENT", "FAILED"]).optional(),
  type: z.string().trim().max(120).optional(),
  userId: z.string().trim().max(64).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type AdminRoleInput = z.infer<typeof adminRoleSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type AdminProvidersQuery = z.infer<typeof adminProvidersQuerySchema>;
export type AdminProviderPatchInput = z.infer<typeof adminProviderPatchSchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type AdminNotificationsQuery = z.infer<typeof adminNotificationsQuerySchema>;
