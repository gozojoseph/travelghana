/**
 * TravelGhana design tokens (§30–§33, §53).
 * Source of truth — Tailwind theme in apps/web maps its colors from here.
 * Principle: "Ghana should be felt throughout the interface, not shouted at the user."
 */

export const colors = {
  /** Deep Ghana Green — dominant brand color */
  primary: "#006B3F",
  /** Warm Gold — accent */
  secondary: "#F2C94C",
  /** Ghana Red — emphasis/alerts only, sparingly */
  accent: "#CE1126",
  /** Warm Ivory — page background */
  background: "#FFFDF7",
  /** Primary text */
  textPrimary: "#17211B",
  /** Secondary text */
  textSecondary: "#65736B",
  /** Cards */
  card: "#FFFFFF",
  /** Deep evergreen — footer surface (dark) */
  footer: "#0B2E1D",
  /** Warm Ivory — main text on the footer surface */
  footerForeground: "#FFFDF7",
  /** Soft sage — secondary text on the footer surface */
  footerMuted: "#93A89A",
  /** Divider on the footer surface */
  footerBorder: "#1D3F2C",
} as const;

export const typography = {
  sans: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  display: "'DM Serif Display', Georgia, serif",
} as const;

export const radii = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

export const motion = {
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** Lucide icon mapping per §32 — never emojis as UI icons. */
export const icons = {
  explore: "Compass",
  destinations: "Map",
  search: "Search",
  hotels: "Building",
  tours: "Route",
  experiences: "Sparkles",
  transport: "Car",
  driver: "IdCard",
  flights: "Plane",
  calendar: "Calendar",
  location: "MapPin",
  restaurants: "Utensils",
  events: "CalendarDays",
  bookings: "Ticket",
  payments: "CreditCard",
  messages: "MessageCircle",
  profile: "User",
  settings: "Settings",
  notifications: "Bell",
  favorites: "Heart",
  navigation: "Navigation",
  accessibility: "Accessibility",
  emergency: "Phone",
} as const;

/** Two visual modes (§34). */
export type UIMode = "discovery" | "travel";
