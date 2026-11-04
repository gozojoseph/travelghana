"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import type { GalleryItem } from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import { GalleryItemForm } from "@/components/admin/gallery-item-form";
import { dangerButtonClass, FormFeedback } from "@/components/admin/shared";

export default function EditGalleryItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<GalleryItem | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .adminGalleryItem(params.id)
      .then(({ item: loaded }) => {
        if (!active) return;
        setItem(loaded);
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setState("missing");
        } else {
          setState("error");
          setError(err instanceof Error ? err.message : "Could not load the photo.");
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  async function remove() {
    if (!item) return;
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    try {
      await api.deleteGalleryItem(item.id);
      router.push("/admin/gallery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the photo.");
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 pb-24">
      <Link
        href="/admin/gallery"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to gallery
      </Link>

      {state === "loading" ? (
        <div className="mt-8 flex flex-col gap-4">
          <span role="status" className="sr-only">
            Loading photo…
          </span>
          <div className="animate-pulse rounded-card border border-border bg-card p-6" aria-hidden>
            <div className="h-8 w-1/2 rounded bg-muted" />
            <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
          </div>
          <div className="animate-pulse rounded-card border border-border bg-card p-6" aria-hidden>
            <div className="h-40 rounded bg-muted" />
          </div>
        </div>
      ) : null}

      {state === "missing" ? (
        <div className="animate-rise mt-8 rounded-card border border-dashed border-border bg-card p-8">
          <h1 className="font-display text-3xl">Photo not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted. Head back to the gallery list.
          </p>
          <Link
            href="/admin/gallery"
            className="mt-6 inline-block rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Back to gallery
          </Link>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="mt-8">
          <FormFeedback message={error} />
        </div>
      ) : null}

      {state === "ready" && item ? (
        <>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="animate-rise font-display text-4xl">{item.title}</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.published
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {[item.category, item.location].filter(Boolean).join(" · ") || "No category"} ·
                order {item.sortOrder}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className={`${dangerButtonClass} inline-flex items-center gap-1.5`}
            >
              {deleting ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="h-4 w-4" />
              )}
              Delete
            </button>
          </div>

          {feedback ? (
            <p
              role="status"
              className="animate-pop mt-6 rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
            >
              {feedback}
            </p>
          ) : null}
          {error ? (
            <div className="mt-6">
              <FormFeedback message={error} />
            </div>
          ) : null}

          <div className="animate-rise mt-8 rounded-card border border-border bg-card p-6 [animation-delay:60ms]">
            <GalleryItemForm
              mode="edit"
              initial={item}
              onSaved={(updated) => {
                setItem(updated);
                setFeedback("Changes saved.");
                setError(null);
              }}
            />
          </div>
        </>
      ) : null}
    </main>
  );
}
