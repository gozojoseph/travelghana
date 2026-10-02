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

export type EnquiryStatus = "NEW" | "IN_REVIEW" | "QUOTED" | "CONVERTED" | "CLOSED";

export type TripStatus =
  | "PLANNING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Monetary amounts cross service boundaries as minor units + explicit currency (D8). */
export interface Money {
  amountMinor: number;
  currencyCode: string;
}

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
