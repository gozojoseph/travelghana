import { Injectable } from "@nestjs/common";

import { MapsAdapter, StaticMapOptions } from "./maps-adapter.interface";

/**
 * Mapbox Static Images API (D4). Default style: Mapbox Streets. Overlay:
 * pin markers with auto-fit when markers exist, else explicit center+zoom.
 * Plain HTTP — no SDK dependency.
 */
@Injectable()
export class MapboxAdapter implements MapsAdapter {
  private readonly token = process.env.MAPBOX_PUBLIC_TOKEN ?? "";
  private readonly defaultStyle = "mapbox/streets-v12";

  get isConfigured(): boolean {
    return this.token.length > 0;
  }

  staticMap(options: StaticMapOptions): string | null {
    if (!this.isConfigured) return null;

    const { width, height, zoom = 11, markers = [], center, style } = options;

    if (markers.length === 0 && !center) return null;

    const pins = markers
      .slice(0, 20)
      .map((m) => `pin-l+${BRAND_PIN}(${m.lng.toFixed(6)},${m.lat.toFixed(6)})`)
      .join(",");
    const overlaySegment = pins ? `/${pins}` : "";

    const view = markers.length > 0 ? "auto" : `${center!.lng},${center!.lat},${zoom}`;

    return `https://api.mapbox.com/styles/v1/${style ?? this.defaultStyle}/static${overlaySegment}/${view}/${width}x${height}@2x?access_token=${this.token}&padding=32`;
  }
}

/** Deep Ghana Green pin (§31 brand). */
const BRAND_PIN = "006B3F";
