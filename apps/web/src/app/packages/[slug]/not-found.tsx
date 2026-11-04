import Link from "next/link";
import { PackageOpen } from "lucide-react";

export default function PackageNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <PackageOpen aria-hidden className="h-12 w-12 text-primary/60" />
      <h1 className="mt-4 font-display text-4xl">Package not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This journey may have been unpublished, or the link is wrong. Browse the current packages
        to find your next trip.
      </p>
      <Link
        href="/packages"
        className="mt-6 inline-flex items-center gap-2 rounded-card bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98]"
      >
        Browse packages
      </Link>
    </main>
  );
}
