"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { trackView } from "@/lib/tracking";

/**
 * First-party recorder island (D37): mounted once in the root layout, records
 * every SPA route change to /api/track. Renders nothing; /admin paths are
 * skipped at the source inside trackView.
 */
export function BehaviorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackView(pathname);
  }, [pathname]);

  return null;
}
