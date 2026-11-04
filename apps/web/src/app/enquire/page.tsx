import type { Metadata } from "next";
import { ConciergeBell, Mail } from "lucide-react";

import { EnquiryForm } from "@/components/trips/enquiry-form";

export const metadata: Metadata = {
  title: "Plan with our concierge — TravelGhana",
  description:
    "Tell us how you want to travel in Ghana and our concierge team puts a tailored plan together — by email, with real quotes. No account needed.",
  alternates: { canonical: "/enquire" },
};

export default function EnquirePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 pb-24">
      <p className="animate-rise text-sm font-medium uppercase tracking-widest text-secondary">
        Custom trips
      </p>
      <div className="animate-rise mt-1 flex items-start gap-4">
        <ConciergeBell aria-hidden className="mt-1 h-9 w-9 text-primary" />
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Let a concierge plan it with you</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Prefer a person to a spreadsheet? Tell us where you want to go, how you like to
            travel and what matters to your group. A member of our concierge team replies by
            email with a tailored plan and a real quote — usually within two working days.
          </p>
        </div>
      </div>

      <div className="animate-rise mt-8 grid gap-6 lg:grid-cols-[1fr_320px] [animation-delay:80ms]">
        <section aria-labelledby="enquiry-form-heading" className="rounded-card border border-border bg-card p-5 sm:p-8">
          <h2 id="enquiry-form-heading" className="font-display text-2xl">
            Your brief
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything here is optional except your name and email — but the more you share, the
            better the quote.
          </p>
          <div className="mt-6">
            <EnquiryForm />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-card border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Mail aria-hidden className="h-4 w-4 text-primary" />
              What happens next
            </h3>
            <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">1.</span> You send this brief — an
                account is not needed.
              </li>
              <li>
                <span className="font-semibold text-foreground">2.</span> A concierge reviews it
                and emails you a tailored itinerary with a quote.
              </li>
              <li>
                <span className="font-semibold text-foreground">3.</span> If you like it, they
                arrange the bookings with you by email.
              </li>
            </ol>
          </div>
          <div className="rounded-card border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Good to know</p>
            <p className="mt-2">
              An enquiry is not a booking and nothing is charged here. Prefer to plan it yourself?
              Use the trip planner — you can send it to this same concierge team when you are
              ready.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
