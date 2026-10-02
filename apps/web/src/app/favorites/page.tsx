import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl">Favorites</h1>
      <p className="mt-3 text-muted-foreground">
        Saved destinations and experiences will appear here once the trips increment lands.
      </p>
      <Link href="/explore" className="mt-6 inline-block font-medium text-primary underline-offset-4 hover:underline">
        Explore Ghana
      </Link>
    </main>
  );
}
