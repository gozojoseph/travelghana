"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PackageForm } from "@/components/admin/package-form";

export default function NewPackagePage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 pb-24">
      <Link
        href="/admin/packages"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to packages
      </Link>

      <h1 className="animate-rise mt-4 font-display text-4xl">New package</h1>
      <p className="animate-rise mt-2 text-muted-foreground [animation-delay:60ms]">
        Set the shape and price, then write the day-by-day outline. You can keep it as a draft for
        as long as you like.
      </p>

      <div className="animate-rise mt-8 rounded-card border border-border bg-card p-6 [animation-delay:120ms]">
        <PackageForm
          mode="create"
          onSaved={(pkg) => router.push(`/admin/packages/${pkg.id}`)}
        />
      </div>
    </main>
  );
}
