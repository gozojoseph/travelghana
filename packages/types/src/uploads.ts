/**
 * Managed uploads (D45): the admin console sends a multipart image and gets
 * a first-party URL back. The URL is relative (/api/uploads/...) so it
 * resolves on every origin that serves the web app.
 */
export interface UploadResult {
  /** Platform-minted storage key, e.g. "gallery/84b1...avif". */
  key: string;
  /** First-party public URL (relative). */
  url: string;
  size: number;
  mimeType: string;
}
