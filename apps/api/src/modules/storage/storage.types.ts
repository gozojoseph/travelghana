/**
 * Storage abstraction (D45). Managed uploads are stored behind this small
 * interface so the deployment can swap the backing provider without touching
 * feature code. The dev/preview driver keeps files on local disk; a managed
 * image host (Cloudinary/Supabase) becomes another driver when the owner
 * picks one and provides keys - never a hard dependency.
 */
export interface StoredObject {
  data: Buffer;
  contentType: string;
}

export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
