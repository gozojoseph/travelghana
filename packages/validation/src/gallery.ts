import { z } from "zod";

/**
 * Gallery validation - shared by the admin API and the admin web form.
 *
 * D45: images may be an external https URL OR a first-party managed upload
 * path (/api/uploads/<key>, minted by POST /api/admin/uploads). The caption,
 * category, location and sort order are editorial metadata.
 */

const galleryItemInputSchema = z.object({
  title: z.string().trim().min(1, "Give this photo a title").max(120),
  caption: z.string().trim().max(400).optional(),
  imageUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/api/uploads/"), {
      message: "Upload a photo or paste a direct https image URL",
    }),
  category: z.string().trim().max(60).optional(),
  location: z.string().trim().max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  published: z.boolean().optional(),
});

export const galleryItemCreateSchema = galleryItemInputSchema;

export const galleryItemUpdateSchema = galleryItemInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "No changes provided" });

export const galleryItemListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export type GalleryItemCreateInput = z.infer<typeof galleryItemCreateSchema>;
export type GalleryItemUpdateInput = z.infer<typeof galleryItemUpdateSchema>;
export type GalleryItemListQuery = z.infer<typeof galleryItemListQuerySchema>;
