"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, Star } from "lucide-react";
import type { ReviewEligibilityDto } from "@travelghana/types";

import { api } from "@/lib/api";
import { buttonClass, inputClass } from "@/components/admin/shared";

type Phase = "checking" | "hidden" | "eligible" | "submitted" | "error";

/**
 * The "write a review" form on a package page (D42). It only appears for a
 * signed-in traveler whose booking for this package the team CONFIRMED, and
 * who has not reviewed it yet - the server repeats both checks, so the worst
 * case is an honest error, never a silent publish. Submissions land in the
 * moderation queue (PENDING); nothing becomes public automatically.
 */
export function ReviewForm({ packageId }: { packageId: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ user }) => {
        if (!active) return;
        // Anonymous visitors: nothing shows - the booking flow funnels them
        // to login, and reviews are for people who traveled.
        if (!user) {
          setPhase("hidden");
          return;
        }
        return api.reviewStatus(packageId).then((status: ReviewEligibilityDto) => {
          if (!active) return;
          if (status.existing) {
            setPhase("hidden");
          } else if (status.eligible) {
            setPhase("eligible");
          } else {
            setPhase("hidden");
          }
        });
      })
      .catch(() => {
        if (active) setPhase("hidden");
      });
    return () => {
      active = false;
    };
  }, [packageId]);

  async function submit() {
    if (rating < 1 || rating > 5) {
      setFieldErrors({ rating: "Pick a star rating" });
      setError("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setError(null);
    setPending(true);
    try {
      await api.submitReview({ packageId, rating, body: body.trim() });
      setPhase("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the review.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "checking" || phase === "hidden") return null;

  if (phase === "submitted") {
    return (
      <div role="status" className="animate-pop mt-6 rounded-card border border-primary/20 bg-primary/5 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Star aria-hidden className="h-4 w-4" /> Thanks - your review is in the queue
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A team member reads every review before anything is published.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="mt-6 rounded-card border border-border bg-card p-5"
      id="review"
    >
      <p className="text-sm font-medium">You traveled on this journey - how was it?</p>
      <div className="mt-4">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Your rating
        </span>
        <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} of 5`}
              onClick={() => setRating(value)}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <Star
                aria-hidden
                className={`h-6 w-6 ${value <= rating ? "text-secondary" : "text-muted-foreground/40"}`}
                fill={value <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
        {fieldErrors.rating ? (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.rating}</p>
        ) : null}
      </div>
      <div className="mt-4">
        <textarea
          value={body}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
          className={inputClass}
          placeholder="What should other travelers know? (optional)"
          maxLength={2000}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} mt-4 inline-flex w-full items-center justify-center gap-2`}
      >
        {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
        {pending ? "Sending…" : "Submit for review"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Reviews are moderated before they are published. Nothing is posted automatically.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
