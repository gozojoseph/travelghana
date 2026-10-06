"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ExperienceForm } from "@/components/operator/experience-form";

export default function NewExperiencePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/operator/experiences"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to experiences
      </Link>
      <h1 className="mt-4 font-display text-3xl">New experience</h1>
      <div className="mt-8 rounded-card border border-border bg-card p-6">
        <ExperienceForm />
      </div>
    </main>
  );
}
