"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import { api, type TourDto } from "@/lib/api";

import { handleLoadError, toCedisDisplay } from "@/components/operator/shared";

export default function OperatorToursPage() {
  const [tours, setTours] = useState<TourDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const res = await api.myTours();
      setTours(res.items);
      setState("ready");
    } catch (err) {
      handleLoadError(err);
      setState("error");
    }
  }, []);

  async function togglePublished(tour: TourDto) {
    await api.updateTour(tour.id, { published: !tour.published });
    await load();
  }

  async function remove(tour: TourDto) {
    if (!window.confirm(`Delete “${tour.title}”? This cannot be undone.`)) return;
    await api.deleteTour(tour.id);
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-secondary">Operator</p>
          <h1 className="mt-1 font-display text-3xl">Your tours</h1>
        </div>
        <Link
          href="/operator/tours/new"
          className="flex items-center gap-2 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-4 w-4" /> New tour
        </Link>
      </div>

      {state === "loading" ? <p className="mt-8 text-muted-foreground">Loading…</p> : null}
      {state === "error" ? <p className="mt-8 text-muted-foreground">Could not load tours.</p> : null}

      {state === "ready" && tours.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-border p-10 text-center">
          <p className="font-medium">No tours yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first tour — travelers can book it once published.
          </p>
          <Link
            href="/operator/tours/new"
            className="mt-4 inline-block rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create a tour
          </Link>
        </div>
      ) : null}

      <ul className="mt-8 flex flex-col gap-3">
        {tours.map((tour) => (
          <li key={tour.id} className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {tour.title}
                {tour.published ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Published
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Draft
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                GHS {toCedisDisplay(tour.basePriceMinor)} per person · max {tour.groupMax} people
                {tour.durationHours ? ` · ${tour.durationHours}h` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void togglePublished(tour)}
                className="flex items-center gap-1.5 rounded-card border border-border px-3 py-2 text-sm font-medium"
                title={tour.published ? "Unpublish" : "Publish"}
              >
                {tour.published ? (
                  <>
                    <EyeOff aria-hidden className="h-4 w-4" /> Unpublish
                  </>
                ) : (
                  <>
                    <Eye aria-hidden className="h-4 w-4" /> Publish
                  </>
                )}
              </button>
              <Link
                href={`/operator/tours/${tour.id}`}
                className="flex items-center gap-1.5 rounded-card border border-border px-3 py-2 text-sm font-medium"
              >
                <Pencil aria-hidden className="h-4 w-4" /> Edit
              </Link>
              <button
                type="button"
                onClick={() => void remove(tour)}
                className="flex items-center gap-1.5 rounded-card border border-border px-3 py-2 text-sm font-medium text-red-600"
              >
                <Trash2 aria-hidden className="h-4 w-4" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
