"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, MapPin, ShieldAlert, Sparkles, Tickets } from "lucide-react";

import { api, PROVIDER_TYPE_LABELS, type ExperienceDto, type ProviderDto, type TourDto } from "@/lib/api";

import { handleLoadError } from "@/components/operator/shared";
import { ProviderForm } from "@/components/operator/provider-form";

type Phase = "loading" | "onboard" | "ready";

/** Operator home (D5 operator-first): onboard or manage your listings. */
export default function OperatorPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [provider, setProvider] = useState<ProviderDto | null>(null);
  const [tours, setTours] = useState<TourDto[]>([]);
  const [experiences, setExperiences] = useState<ExperienceDto[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { provider } = await api.myProvider();
        setProvider(provider);
        if (!provider) {
          setPhase("onboard");
          return;
        }
        const [tourRes, expRes] = await Promise.all([api.myTours(), api.myExperiences()]);
        setTours(tourRes.items);
        setExperiences(expRes.items);
        setPhase("ready");
      } catch (err) {
        if (handleLoadError(err) === "error") setError(true);
      }
    })();
  }, []);

  if (phase === "loading" && !error) {
    return <main className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</main>;
  }

  if (error && phase === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-muted-foreground">Something went wrong loading the operator dashboard.</p>
      </main>
    );
  }

  if (phase === "onboard") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-secondary">For operators</p>
        <h1 className="mt-1 font-display text-4xl">List your business on TravelGhana</h1>
        <p className="mt-3 text-muted-foreground">
          Reach travelers planning trips to Ghana. Create your operator profile now — tours and
          experiences can be added right after.
        </p>
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <ProviderForm />
        </div>
      </main>
    );
  }

  const publishedTours = tours.filter((t) => t.published).length;
  const publishedExperiences = experiences.filter((e) => e.published).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-secondary">Operator dashboard</p>
      <h1 className="mt-1 font-display text-4xl">{provider?.name}</h1>

      <div className="mt-6 rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Building2 aria-hidden className="h-4 w-4 text-primary" />
            {provider ? PROVIDER_TYPE_LABELS[provider.type] : ""}
          </span>
          {provider?.cityId ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin aria-hidden className="h-4 w-4" /> City set
            </span>
          ) : null}
          <span className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert aria-hidden className="h-4 w-4" />
            {provider?.verificationStatus === "VERIFIED"
              ? "Verified"
              : "Verification pending — an admin will review your profile"}
          </span>
        </div>
        {provider?.description ? (
          <p className="mt-3 text-sm text-muted-foreground">{provider.description}</p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/operator/tours"
          className="group rounded-card border border-border bg-card p-6 transition-colors hover:border-primary"
        >
          <Tickets aria-hidden className="h-6 w-6 text-primary" />
          <p className="mt-3 font-medium">Tours</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tours.length} total · {publishedTours} published
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
            Manage tours →
          </span>
        </Link>
        <Link
          href="/operator/experiences"
          className="group rounded-card border border-border bg-card p-6 transition-colors hover:border-primary"
        >
          <Sparkles aria-hidden className="h-6 w-6 text-primary" />
          <p className="mt-3 font-medium">Experiences</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {experiences.length} total · {publishedExperiences} published
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
            Manage experiences →
          </span>
        </Link>
      </div>
    </main>
  );
}
