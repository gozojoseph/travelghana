import type { ApiErrorResponse, SessionUser } from "@travelghana/types";

/** Browser API client (§40 secure API design): sends credentials, normalizes
 * the { error: { code, message } } contract into ApiClientError. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const err = (body as ApiErrorResponse | null)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? "Something went wrong",
      err?.details,
    );
  }

  return body as T;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<{ user: SessionUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: SessionUser }>("/auth/me"),

  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // ─── Operator self-service (D5) ─────────────────────────────────────────

  cities: () => request<{ items: CityDto[] }>("/destinations/cities"),

  myProvider: () => request<{ provider: ProviderDto | null }>("/operator/me/provider"),

  onboardProvider: (input: ProviderOnboardPayload) =>
    request<{ provider: ProviderDto }>("/operator/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProvider: (input: Partial<ProviderOnboardPayload>) =>
    request<{ provider: ProviderDto }>("/operator/me/provider", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // ─── Provider listings (D8: integer minor units, GHS default) ─────────────

  myListings: (status?: string) =>
    request<{ items: ListingSummaryDto[] }>(`/listings/me${status ? `?id=${status}` : ""}`),

  createListing: (input: ListingCreatePayload) =>
    request<{ listing: ListingSummaryDto }>("/listings/me", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateListing: (id: string, input: Partial<ListingUpdatePayload>) =>
    request<{ listing: ListingSummaryDto }>(`/listings/me/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteListing: (id: string) =>
    request<{ message: string }>(`/listings/me/${id}`, { method: "DELETE" }),

  transitionListingStatus: (id: string, status: ListingStatusInput) =>
    request<{ listing: ListingSummaryDto }>(`/listings/me/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ─── Admin review queue ───────────────────────────────────────────────────

  adminListings: (status?: "PENDING_REVIEW" | "ALL") =>
    request<{ items: ListingSummaryDto[] }>(`/listings/admin${status ? `?id=${status}` : ""}`),

  reviewListing: (id: string, action: ReviewActionInput) =>
    request<{ listing: ListingSummaryDto }>(`/listings/admin/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ reviewStatus: action }),
    }),

  // ─── Operator tours ───────────────────────────────────────────────────────

  myTours: () => request<{ items: TourDto[] }>("/operator/me/tours"),

  createTour: (input: TourPayload) =>
    request<{ tour: TourDto }>("/operator/me/tours", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateTour: (id: string, input: Partial<TourPayload>) =>
    request<{ tour: TourDto }>(`/operator/me/tours/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteTour: (id: string) =>
    request<{ message: string }>(`/operator/me/tours/${id}`, { method: "DELETE" }),

  // ─── Operator experiences ─────────────────────────────────────────────────

  myExperiences: () => request<{ items: ExperienceDto[] }>("/operator/me/experiences"),

  createExperience: (input: ExperiencePayload) =>
    request<{ experience: ExperienceDto }>("/operator/me/experiences", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateExperience: (id: string, input: Partial<ExperiencePayload>) =>
    request<{ experience: ExperienceDto }>(`/operator/me/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteExperience: (id: string) =>
    request<{ message: string }>(`/operator/me/experiences/${id}`, { method: "DELETE" }),
};

// ─── Operator DTOs (mirror the API JSON) ────────────────────────────────────

export type ProviderType =
  | "TOUR_OPERATOR"
  | "HOTEL"
  | "EXPERIENCE_PROVIDER"
  | "TRANSPORT_COMPANY";

export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export type ListingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "ARCHIVED";

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  TOUR_OPERATOR: "Tour operator",
  HOTEL: "Hotel / accommodation",
  EXPERIENCE_PROVIDER: "Experience provider",
  TRANSPORT_COMPANY: "Transport company",
};

export interface CityDto {
  id: string;
  name: string;
  slug: string;
  region?: { name: string; slug: string };
}

export interface ProviderDto {
  id: string;
  type: ProviderType;
  name: string;
  slug: string;
  description: string | null;
  verificationStatus: VerificationStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  cityId: string | null;
}

export interface ProviderOnboardPayload {
  type: ProviderType;
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  cityId?: string;
}

export interface ListingSummaryDto {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  providerId: string;
  providerName: string;
  cityName: string | null;
  citySlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  durationMinutes: number | null;
  capacity: number;
  priceMinor: number;
  currencyCode: string;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface ListingCreatePayload {
  title: string;
  description?: string;
  serviceArea?: string;
  durationMinutes?: number;
  capacity?: number;
  priceMinor: number;
  currencyCode?: string;
  cityId?: string;
  regionId?: string;
  coordinatesLat?: number;
  coordinatesLng?: number;
  address?: string;
  meetingPoint?: string;
  category?: string;
  whatIsIncluded?: string;
  whatIsExcluded?: string;
  requirements?: string;
  cancellationPolicy?: string;
  heroImageUrl?: string;
  published?: boolean;
}

export interface ListingUpdatePayload {
  title?: string;
  description?: string;
  serviceArea?: string;
  durationMinutes?: number;
  capacity?: number;
  priceMinor?: number;
  currencyCode?: string;
  cityId?: string;
  regionId?: string;
  coordinatesLat?: number;
  coordinatesLng?: number;
  address?: string;
  meetingPoint?: string;
  category?: string;
  whatIsIncluded?: string;
  whatIsExcluded?: string;
  requirements?: string;
  cancellationPolicy?: string;
  heroImageUrl?: string;
  published?: boolean;
}

export interface TourDto {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  durationHours: number | null;
  days: number | null;
  groupMin: number;
  groupMax: number;
  basePriceMinor: number;
  currencyCode: string;
  cityId: string | null;
  meetingPoint: string | null;
  category: string | null;
  published: boolean;
}

export interface TourPayload {
  title: string;
  summary?: string;
  description?: string;
  durationHours?: number;
  days?: number;
  groupMin?: number;
  groupMax?: number;
  basePriceMinor: number;
  currencyCode?: string;
  cityId?: string;
  meetingPoint?: string;
  category?: string;
  published?: boolean;
}

export interface ExperienceDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number | null;
  priceMinor: number;
  currencyCode: string;
  cityId: string | null;
  category: string | null;
  published: boolean;
}

export interface ExperiencePayload {
  title: string;
  description?: string;
  durationMinutes?: number;
  priceMinor: number;
  currencyCode?: string;
  cityId?: string;
  category?: string;
  published?: boolean;
}

export type ListingStatusInput = ListingStatus;

export type ReviewActionInput = "APPROVE" | "REJECT" | "SUSPEND";

export function validationIssues(err: unknown): ValidationIssue[] {
  if (err instanceof ApiClientError && err.details && typeof err.details === "object") {
    const issues = (err.details as { issues?: ValidationIssue[] }).issues;
    if (Array.isArray(issues)) return issues;
  }
  return [];
}
