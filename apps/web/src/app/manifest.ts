import type { MetadataRoute } from "next";

/**
 * PWA identity. Icons are deterministic resizes of the original
 * `public/Travel Ghana Logo.png` (see apps/web/scripts/generate-brand-icons.ps1);
 * the `maskable` variant centers the artwork inside the 80% safe circle, while
 * the plain icons keep it at the safe edges of a brand Warm Ivory canvas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travel Ghana",
    short_name: "Travel Ghana",
    description:
      "Discover Ghana, plan your journey, book tours, experiences, hotels and trusted drivers — all in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFDF7",
    theme_color: "#006B3F",
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
