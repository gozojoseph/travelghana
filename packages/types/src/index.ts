/**
 * Shared domain types used by web, api and admin.
 * Enum values mirror the Prisma schema (packages/database/prisma/schema.prisma).
 * Keep in sync — a codegen step can replace this once the API stabilizes.
 */

export type Role =
  | "TRAVELER"
  | "DRIVER"
  | "TOUR_OPERATOR"
  | "HOTEL_MANAGER"
  | "TRANSPORT_COMPANY"
  | "EXPERIENCE_PROVIDER"
  | "ADMIN";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED";

// ─── Auth / identity ─────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  emailVerified: boolean;
}

export interface AuthResponse {
  user: SessionUser;
}

export interface MessageResponse {
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

// ─── Trip planner (§14) ──────────────────────────────────────────────────────

export * from "./trips";

// ─── Curated packages (admin-managed) ────────────────────────────────────────

export * from "./packages";

// ─── Gallery (admin-managed) ─────────────────────────────────────────────────

export * from "./gallery";

// ─── Trip enquiries (D6 concierge workflow, Phase 2) ─────────────────────────

export * from "./enquiries";
export * from "./admin";
export * from "./settings";
export * from "./bookings";
export * from "./listing-bookings";
export * from "./users";
export * from "./insights";
export * from "./notifications";
export * from "./reviews";
export * from "./uploads";
