"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { api, type ExperienceDto } from "@/lib/api";

import { handleLoadError } from "@/components/operator/shared";
import { ExperienceForm } from "@/components/operator/experience-form";

export default function EditExperiencePage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<ExperienceDto | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.myExperiences();
        const found = res.items.find((e) => e.id === params.id) ?? null;
        setExperience(found);
        setState(found ? "ready" : "missing");
      } catch (err) {
        handleLoadError(err);
        setState("error");
      }
    })();
  }, [params.id]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/operator/experiences"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to experiences
      </Link>
      <h1 className="mt-4 font-display text-3xl">Edit experience</h1>

      {state === "loading" ? <p className="mt-8 text-muted-foreground">Loading…</p> : null}
      {state === "missing" ? (
        <p className="mt-8 text-muted-foreground">Experience not found — it may have been deleted.</p>
      ) : null}
      {state === "error" ? <p className="mt-8 text-muted-foreground">Could not load this experience.</p> : null}

      {state === "ready" && experience ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <ExperienceForm initial={experience} />
        </div>
      ) : null}
    </main>
  );
}
