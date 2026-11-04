"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Edit3,
  Images,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { GalleryItem } from "@travelghana/types";

import { api } from "@/lib/api";
import {
  buttonClass,
  dangerButtonClass,
  FormFeedback,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/shared";

type StatusFilter = "" | "DRAFT" | "PUBLISHED";
type Status = "DRAFT" | "PUBLISHED";

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

const STATUS_CHIP_CLASS: Record<Status, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-primary/10 text-primary",
};

export default function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .adminGallery({ q: q.trim() || undefined, status: status || undefined })
        .then(({ items: next }) => {
          if (!active) return;
          setItems(next);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setItems([]);
          setError(err instanceof Error ? err.message : "Could not load the gallery.");
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, status]);

  async function togglePublish(item: GalleryItem) {
    setBusyId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const { item: updated } = await api.updateGalleryItem(item.id, {
        published: !item.published,
      });
      setItems((prev) =>
        prev ? prev.map((entry) => (entry.id === updated.id ? updated : entry)) : prev,
      );
      setFeedback(
        updated.published
          ? `“${updated.title}” is now live in the gallery.`
          : `“${updated.title}” moved back to draft.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the photo.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: GalleryItem) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;

    setBusyId(item.id);
    setError(null);
    setFeedback(null);
    try {
      await api.deleteGalleryItem(item.id);
      setItems((prev) => (prev ? prev.filter((entry) => entry.id !== item.id) : prev));
      setFeedback(`“${item.title}” was deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the photo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
            Admin
          </p>
          <h1 className="animate-rise mt-1 font-display text-4xl [animation-delay:40ms]">
            Gallery
          </h1>
          <p className="animate-rise mt-2 max-w-2xl text-muted-foreground [animation-delay:80ms]">
            Curate the public gallery. Drafts stay private; publishing puts a photo on the public
            page straight away.
          </p>
        </div>
        <Link href="/admin/gallery/new" className={`${buttonClass} inline-flex items-center gap-2`}>
          <Plus aria-hidden className="h-4 w-4" />
          New photo
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search gallery</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by title, caption, category or location"
            className={`${inputClass} pl-11`}
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {feedback ? (
          <p
            role="status"
            className="animate-pop rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            {feedback}
          </p>
        ) : null}
        <FormFeedback message={error} />
      </div>

      {items === null ? (
        <>
          <span role="status" className="sr-only">
            Loading gallery…
          </span>
          <div className="mt-8 flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="animate-pulse rounded-card border border-border bg-card p-5"
              >
                <div className="h-16 w-16 rounded bg-muted" />
                <div className="mt-3 h-5 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="animate-rise mt-10 flex flex-col items-start rounded-card border border-dashed border-border bg-card px-6 py-12">
          <Images aria-hidden className="h-10 w-10 text-primary/60" />
          <h2 className="mt-4 font-display text-2xl">
            {q || status ? "No matching photos" : "No photos yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {q || status
              ? "Try a different search or status filter."
              : "Add the first photo with an image URL, a caption and an optional category."}
          </p>
          {!q && !status ? (
            <Link
              href="/admin/gallery/new"
              className="mt-6 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
            >
              Add a photo
            </Link>
          ) : null}
        </div>
      ) : null}

      {items !== null && items.length > 0 ? (
        <div className="tg-stagger mt-8 flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary sm:flex-row sm:items-center"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-card border border-border bg-muted">
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/gallery/${item.id}`}
                    className="font-display text-xl transition-colors hover:text-primary"
                  >
                    {item.title}
                  </Link>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CHIP_CLASS[item.published ? "PUBLISHED" : "DRAFT"]}`}
                  >
                    {STATUS_LABELS[item.published ? "PUBLISHED" : "DRAFT"]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[item.category, item.location].filter(Boolean).join(" · ") ||
                    "No category or location"}
                  {" · "}order {item.sortOrder}
                </p>
                {item.caption ? (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.caption}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/gallery/${item.id}`}
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                >
                  <Edit3 aria-hidden className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => void togglePublish(item)}
                  disabled={busyId === item.id}
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                >
                  {busyId === item.id ? (
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  ) : null}
                  {item.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={busyId === item.id}
                  className={`${dangerButtonClass} inline-flex items-center gap-1.5`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
