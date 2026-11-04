/**
 * Gallery domain types (admin-managed, platform-owned).
 *
 * A gallery item is one editorial image with a caption and optional grouping.
 * Images are referenced by URL for now — there is no upload pipeline yet.
 */

export interface GalleryItem {
  id: string;
  title: string;
  caption: string | null;
  imageUrl: string;
  category: string | null;
  location: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
