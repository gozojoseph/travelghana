"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GalleryItemForm } from "@/components/admin/gallery-item-form";

export default function NewGalleryItemPage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 pb-24">
      <Link
        href="/admin/gallery"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to gallery
      </Link>

      <h1 className="animate-rise mt-4 font-display text-4xl">New photo</h1>
      <p className="animate-rise mt-2 text-muted-foreground [animation-delay:60ms]">
        Paste an image URL and add the details. New photos start as drafts and stay off the public
        gallery until you publish them.
      </p>

      <div className="animate-rise mt-8 rounded-card border border-border bg-card p-6 [animation-delay:120ms]">
        <GalleryItemForm
          mode="create"
          onSaved={(item) => router.push(`/admin/gallery/${item.id}`)}
        />
      </div>
    </main>
  );
}
