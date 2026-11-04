import { z } from "zod";

/**
 * Catalog admin (D20 Phase 6): create/update/delete for destinations and
 * attractions, plus read-only city selectors for the forms. Slug semantics:
 * globally unique for destinations; caller may omit — the API derives one
 * from the name (kebab-case, uniqueness enforced by the DB).
 */

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

// Kept local (not imported from index.ts) so this module has no barrel cycle.
export const catalogIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

// ─── Destinations ────────────────────────────────────────────────────────────

export const destinationAdminQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** Omit = everything (admins manage drafts too). */
  published: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const destinationAdminCreateSchema = z.object({
  cityId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  category: z.enum([
    "BEACH",
    "HISTORICAL",
    "CULTURAL",
    "NATURE",
    "CITY",
    "FOOD",
    "ADVENTURE",
  ]),
  summary: z.string().trim().max(500).optional(),
  description: z.string().trim().max(8000).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  heroImageUrl: z.string().trim().url().max(500).optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const destinationAdminUpdateSchema = destinationAdminCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

// ─── Attractions ─────────────────────────────────────────────────────────────

export const attractionAdminQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  published: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const attractionAdminCreateSchema = z.object({
  /** null clears the link; omit = leave as-is on update. */
  destinationId: z.string().trim().min(1).max(64).nullish(),
  cityId: z.string().trim().min(1).max(64).nullish(),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(8000).optional(),
  category: z.string().trim().max(60).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  published: z.boolean().optional(),
});

export const attractionAdminUpdateSchema = attractionAdminCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export type DestinationAdminQuery = z.infer<typeof destinationAdminQuerySchema>;
export type DestinationAdminCreateInput = z.infer<typeof destinationAdminCreateSchema>;
export type DestinationAdminUpdateInput = z.infer<typeof destinationAdminUpdateSchema>;
export type AttractionAdminQuery = z.infer<typeof attractionAdminQuerySchema>;
export type AttractionAdminCreateInput = z.infer<typeof attractionAdminCreateSchema>;
export type AttractionAdminUpdateInput = z.infer<typeof attractionAdminUpdateSchema>;
export type CatalogIdParam = z.infer<typeof catalogIdParamSchema>;
