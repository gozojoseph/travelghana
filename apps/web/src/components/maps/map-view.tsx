"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  href?: string;
}

/**
 * Real map UI (§13): interactive Mapbox GL map when NEXT_PUBLIC_MAPBOX_TOKEN is
 * configured; otherwise an accessible list fallback with external map links.
 * mapbox-gl is imported lazily client-side only.
 */
export function MapView({
  markers,
  zoom = 7,
  className = "h-[420px] w-full",
}: {
  markers: MapMarker[];
  zoom?: number;
  className?: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current || markers.length === 0) return;

    let map: mapboxgl.Map | null = null;
    let cancelled = false;

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: centerOf(markers),
        zoom,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      for (const m of markers) {
        const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
          m.href
            ? `<a href="${m.href}" style="font-weight:600;color:#006B3F">${escapeHtml(m.label)}</a>`
            : escapeHtml(m.label),
        );
        new mapboxgl.Marker({ color: "#006B3F" })
          .setLngLat([m.lng, m.lat])
          .setPopup(popup)
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [token, markers, zoom]);

  if (markers.length === 0) return null;

  // Fallback (no token): accessible list with external map links — never a fake map.
  if (!token) {
    return (
      <div className={`rounded-card border border-border bg-card p-4 ${className.replace(/h-\[[^\]]+\]/, "h-auto")}`}>
        <p className="mb-2 text-sm font-medium">Locations on this map</p>
        <ul className="flex flex-col gap-1.5">
          {markers.map((m) => (
            <li key={`${m.lat},${m.lng}`} className="flex items-center gap-2 text-sm">
              <MapPin aria-hidden className="h-4 w-4 shrink-0 text-primary" />
              {m.href ? (
                <a href={m.href} className="font-medium underline-offset-4 hover:underline">
                  {m.label}
                </a>
              ) : (
                <span>{m.label}</span>
              )}
              <a
                href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=12/${m.lat}/${m.lng}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                open in maps
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Interactive map of destinations"
      className={`rounded-card border border-border ${className}`}
    />
  );
}

function centerOf(markers: MapMarker[]): [number, number] {
  const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
  const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
  return [lng, lat];
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
