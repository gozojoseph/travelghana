/**
 * Maps provider abstraction (D4). Swapping Mapbox for Google Maps or OSM later
 * means adding an adapter — no call-site changes.
 */
export interface StaticMapMarker {
  lat: number;
  lng: number;
}

export interface StaticMapOptions {
  width: number;
  height: number;
  zoom?: number;
  markers?: StaticMapMarker[];
  /** Fallback center when no markers are given. */
  center?: { lat: number; lng: number };
  /** Mapbox style path ("user/style"); adapter default when omitted. */
  style?: string;
}

export interface MapsAdapter {
  /** Absolute URL of a rendered static map image, or null when unavailable. */
  staticMap(options: StaticMapOptions): string | null;
  readonly isConfigured: boolean;
}
