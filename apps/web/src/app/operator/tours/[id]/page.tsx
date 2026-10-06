"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { api, type TourDto } from "@/lib/api";

import { handleLoadError } from "@/components/operator/shared";
import { TourForm } from "@/components/operator/tour-form";

export default function EditTourPage() {
  const params = useParams<{ id: string }>();
  const [tour, setTour] = useState<TourDto | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.myTours();
        const found = res.items.find((t) => t.id === params.id) ?? null;
        setTour(found);
        setState(found ? "ready" : "missing");
      } catch (err) {
        handleLoadError(err);
        setState("error");
      }
    })();
  }, [params.id]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/operator/tours" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to tours
      </Link>
      <h1 className="mt-4 font-display text-3xl">Edit tour</h1>

      {state === "loading" ? <p className="mt-8 text-muted-foreground">Loading…</p> : null}
      {state === "missing" ? (
        <p className="mt-8 text-muted-foreground">Tour not found — it may have been deleted.</p>
      ) : null}
      {state === "error" ? <p className="mt-8 text-muted-foreground">Could not load this tour.</p> : null}

      {state === "ready" && tour ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <TourForm initial={tour} />
        </div>
      ) : null}
    </main>
  );
}
