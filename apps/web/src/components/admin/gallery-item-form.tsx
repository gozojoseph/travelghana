"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { FormEvent } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import type { GalleryItem } from "@travelghana/types";
import {
  galleryItemCreateSchema,
  galleryItemUpdateSchema,
  type GalleryItemCreateInput,
  type GalleryItemUpdateInput,
} from "@travelghana/validation";

import { api } from "@/lib/api";

import {
  buttonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  secondaryButtonClass,
} from "./shared";

interface GalleryItemFormProps {
  mode: "create" | "edit";
  initial?: GalleryItem;
  onSaved: (item: GalleryItem) => void;
  onCancel?: () => void;
}

/** Managed-upload whitelist mirrors the API (D45). The input keeps type="url"
 * for the keyboard hint; noValidate means the schema alone validates. */
const ACCEPTED_UPLOAD_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/avif";

/** Admin gallery editor — paste an external URL or upload a photo (D45). */
export function GalleryItemForm({ mode, initial, onSaved, onCancel }: GalleryItemFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [published, setPublished] = useState(initial?.published ?? false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Managed upload (D45): pick a file, the platform stores it under its own
   * key, and the answer fills the URL field with the first-party path. The
   * field stays editable - pasting an external https URL remains valid.
   */
  async function onFileChosen(fileList: FileList | null) {
    const file = fileList?.[0];
    setUploadError(null);
    if (!file) return;
    setUploading(true);
    setPending(true);
    try {
      const { upload } = await api.uploadFile(file);
      setImageUrl(upload.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
      setPending(false);
      // Re-trigger preview after the imageUrl change above renders.
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsedSortOrder = Number.parseInt(sortOrder, 10);
    if (!Number.isFinite(parsedSortOrder) || parsedSortOrder < 0) {
      setFieldErrors({ sortOrder: "Enter a whole number (0 or more)" });
      return;
    }

    const payload = {
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      caption: caption.trim(),
      category: category.trim(),
      location: location.trim(),
      sortOrder: parsedSortOrder,
      published,
    };

    const parsed =
      mode === "create"
        ? galleryItemCreateSchema.safeParse(payload)
        : galleryItemUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(issueMap(parsed.error.issues));
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setPending(true);
    try {
      if (mode === "create") {
        const { item } = await api.createGalleryItem(parsed.data as GalleryItemCreateInput);
        onSaved(item);
      } else {
        if (!initial) throw new Error("Gallery item not found");
        const { item } = await api.updateGalleryItem(
          initial.id,
          parsed.data as GalleryItemUpdateInput,
        );
        onSaved(item);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the photo");
    } finally {
      setPending(false);
    }
  }

  const trimmedImageUrl = imageUrl.trim();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Field label="Title" error={fieldErrors.title}>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Independence Arch at first light"
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.title)}
        />
      </Field>

      <Field
        label="Image URL"
        error={fieldErrors.imageUrl}
        hint="Paste a direct https link - or upload a photo below and this fills itself."
      >
        <input
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://…/photo.jpg"
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.imageUrl)}
        />
      </Field>

      <Field label="Or upload a photo" hint="JPEG, PNG, WebP, GIF or AVIF, up to 5 MB.">
        <input
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
          onChange={(event) => void onFileChosen(event.target.files)}
          disabled={uploading || pending}
          className={inputClass}
        />
        {uploading ? (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Uploading…
          </p>
        ) : null}
        {uploadError ? <p className="mt-1.5 text-sm text-accent">{uploadError}</p> : null}
      </Field>

      {trimmedImageUrl && !fieldErrors.imageUrl ? (
        <div className="overflow-hidden rounded-card border border-border bg-muted">
          <img
            src={trimmedImageUrl}
            alt=""
            className="max-h-64 w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-card border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <ImageIcon aria-hidden className="h-5 w-5 text-primary/60" />
          The image preview appears here once you add a URL or finish an upload.
        </div>
      )}

      <Field
        label="Caption"
        error={fieldErrors.caption}
        hint="Optional — one line shown under the title in the lightbox. Up to 400 characters."
      >
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={2}
          maxLength={400}
          placeholder="Morning light over Black Star Square."
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.caption)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Category"
          error={fieldErrors.category}
          hint="Optional — e.g. Heritage, Coast, Culture. Used for gallery filters."
        >
          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Heritage"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.category)}
          />
        </Field>

        <Field
          label="Location"
          error={fieldErrors.location}
          hint="Optional — e.g. Cape Coast, Central Region."
        >
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Cape Coast, Central Region"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.location)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Sort order"
          error={fieldErrors.sortOrder}
          hint="Lower numbers appear first. Use 0 for the top of the gallery."
        >
          <input
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.sortOrder)}
          />
        </Field>

        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Published
          </label>
        </div>
      </div>

      <FormFeedback message={formError} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? (
            <Loader2 aria-hidden className="mr-2 inline h-4 w-4 animate-spin" />
          ) : null}
          {mode === "create" ? "Add photo" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
