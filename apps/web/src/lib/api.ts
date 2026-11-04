import type {
  ApiErrorResponse,
  Enquiry,
  EnquiryStatus,
  GalleryItem,
  PackageDetail,
  PackageStatus,
  PackageSummary,
  SessionUser,
  SiteSettings,
  PackageBooking,
  AdminPackageBookingsResult,
  AdminPackageBookingDto,
  MyPackageBookingsResult,
  UserCounts,
  AdminListingRequest,
  AdminListingRequestsResult,
  ListingRequest,
  MyListingRequestsResult,
  UploadResult,
  TravelerNotificationsResult,
  TravelerNotificationDto,
  PackageDepartureDto,
  PackageReviewStatus,
  PackageReviewsResult,
  ReviewEligibilityDto,
  AdminPackageReviewDto,
  AdminPackageReviewsResult,
} from "@travelghana/types";
import type {
  AdminAuditResult,
  AdminCatalogResult,
  AdminInsightSessionDetail,
  AdminInsightSessionsResult,
  AdminInsightsResult,
  AdminNotificationsResult,
  AdminProviderDto,
  AdminProvidersResult,
  AdminStats,
  AdminUsersResult,
  AdminUserUpdateResult,
  AttractionAdminDto,
  CatalogMutationResult,
  CityOption,
  DestinationAdminDto,
  NotificationStatusValue,
  UserStatusValue,
} from "@travelghana/types";
import type {
  AttractionAdminCreateInput,
  AttractionAdminUpdateInput,
  DestinationAdminCreateInput,
  DestinationAdminUpdateInput,
  EnquiryUpdateInput,
  GalleryItemCreateInput,
  GalleryItemUpdateInput,
  PackageCreateInput,
  PackageUpdateInput,
  SiteSettingsUpdateInput,
  PackageBookingCreateWire,
  ReviewCreateInput,
  ListingRequestCreateWire,
} from "@travelghana/validation";

/** Browser API client (§40 secure API design): sends credentials, normalizes
 * the { error: { code, message } } contract into ApiClientError.
 * Default base is the SAME ORIGIN ("/api") — a Next.js rewrite proxies it to
 * the API server-side, so dev previews over tunnels (devtunnels/ngrok) work
 * with first-party session cookies without exposing the API port. Deployments
 * that serve the web and API from different origins set
 * NEXT_PUBLIC_API_URL to the absolute API base instead. */
const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "/api";
export { API_URL };

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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      // JSON bodies announce themselves; multipart bodies (managed uploads,
      // D45) must keep the browser-set multipart boundary.
      ...(init.body !== undefined && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
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
    apiRequest<{ user: SessionUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    apiRequest<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => apiRequest<{ user: SessionUser }>("/auth/me"),

  verifyEmail: (token: string) =>
    apiRequest<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  verifyEmailByCode: (email: string, code: string) =>
    apiRequest<{ message: string }>("/auth/verify-email-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  resendVerification: () =>
    apiRequest<{ message: string }>("/auth/resend-verification", { method: "POST" }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  resetPasswordByCode: (email: string, code: string, password: string) =>
    apiRequest<{ message: string }>("/auth/reset-password-code", {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    }),

  // ─── Operator self-service (D5) ─────────────────────────────────────────

  cities: () => apiRequest<{ items: CityDto[] }>("/destinations/cities"),

  myProvider: () => apiRequest<{ provider: ProviderDto | null }>("/operator/me/provider"),

  onboardProvider: (input: ProviderOnboardPayload) =>
    apiRequest<{ provider: ProviderDto }>("/operator/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProvider: (input: Partial<ProviderOnboardPayload>) =>
    apiRequest<{ provider: ProviderDto }>("/operator/me/provider", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // ─── Provider listings (D8: integer minor units, GHS default) ─────────────

  myListings: (status?: string) =>
    apiRequest<{ items: ListingSummaryDto[] }>(`/listings/me${status ? `?id=${status}` : ""}`),

  createListing: (input: ListingCreatePayload) =>
    apiRequest<{ listing: ListingSummaryDto }>("/listings/me", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateListing: (id: string, input: Partial<ListingUpdatePayload>) =>
    apiRequest<{ listing: ListingSummaryDto }>(`/listings/me/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteListing: (id: string) =>
    apiRequest<{ message: string }>(`/listings/me/${id}`, { method: "DELETE" }),

  transitionListingStatus: (id: string, status: ListingStatusInput) =>
    apiRequest<{ listing: ListingSummaryDto }>(`/listings/me/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ─── Admin review queue ───────────────────────────────────────────────────

  adminListings: (status?: "PENDING_REVIEW" | "ALL") =>
    apiRequest<{ items: ListingSummaryDto[] }>(`/listings/admin${status ? `?id=${status}` : ""}`),

  reviewListing: (id: string, action: ReviewActionInput, note?: string) =>
    apiRequest<{ listing: ListingSummaryDto }>(`/listings/admin/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({
        reviewStatus: action,
        ...(note !== undefined && note.trim() !== "" ? { note: note.trim() } : {}),
      }),
    }),

  // ─── Admin console (D20) ──────────────────────────────────────────────────

  adminStats: () => apiRequest<{ stats: AdminStats }>("/admin/stats"),

  adminUsers: (params: { q?: string; status?: UserStatusValue } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    search.set("page", "1");
    search.set("pageSize", "50");
    const query = search.toString();
    return apiRequest<AdminUsersResult>(`/admin/users${query ? `?${query}` : ""}`);
  },

  updateAdminUser: (id: string, input: { addRoles?: string[]; removeRoles?: string[]; status?: UserStatusValue }) =>
    apiRequest<AdminUserUpdateResult>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  adminProviders: (params: { q?: string; verificationStatus?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.verificationStatus) search.set("verificationStatus", params.verificationStatus);
    search.set("page", "1");
    search.set("pageSize", "50");
    const query = search.toString();
    return apiRequest<AdminProvidersResult>(`/admin/providers${query ? `?${query}` : ""}`);
  },

  setProviderVerification: (id: string, verificationStatus: VerificationStatus) =>
    apiRequest<{ provider: AdminProviderDto }>(`/admin/providers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ verificationStatus }),
    }),

  adminAudit: (params: { action?: string; entityType?: string; actor?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.action) search.set("action", params.action);
    if (params.entityType) search.set("entityType", params.entityType);
    if (params.actor) search.set("actor", params.actor);
    search.set("page", "1");
    search.set("pageSize", "100");
    const query = search.toString();
    return apiRequest<AdminAuditResult>(`/admin/audit${query ? `?${query}` : ""}`);
  },

  // ─── Visitor insights (D37) ────────────────────────────────────────────────

  adminInsights: (range: "24h" | "7d" | "30d" = "7d", includeAdmins = false) => {
    const search = new URLSearchParams({ range });
    if (includeAdmins) search.set("includeAdmins", "true");
    return apiRequest<AdminInsightsResult>(`/admin/insights?${search.toString()}`);
  },

  adminInsightSessions: (
    params: { range?: "24h" | "7d" | "30d"; includeAdmins?: boolean; page?: number } = {},
  ) => {
    const search = new URLSearchParams({ range: params.range ?? "7d", page: String(params.page ?? 1) });
    if (params.includeAdmins) search.set("includeAdmins", "true");
    return apiRequest<AdminInsightSessionsResult>(`/admin/insights/sessions?${search.toString()}`);
  },

  adminInsightSession: (sessionId: string) =>
    apiRequest<AdminInsightSessionDetail>(`/admin/insights/sessions/${sessionId}`),

  adminNotifications: (params: { status?: NotificationStatusValue; type?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.type) search.set("type", params.type);
    search.set("page", "1");
    search.set("pageSize", "100");
    const query = search.toString();
    return apiRequest<AdminNotificationsResult>(
      `/admin/notifications${query ? `?${query}` : ""}`,
    );
  },

  /** Outbox cleanup (D28): queued/failed records only - server refuses SENT. */
  deleteNotification: (id: string) =>
    apiRequest<{ message: string }>(`/admin/notifications/${id}`, { method: "DELETE" }),

  adminCatalogCities: () =>
    apiRequest<{ items: CityOption[] }>("/admin/catalog/cities"),

  adminDestinations: (params: { q?: string; published?: "true" | "false" } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.published) search.set("published", params.published);
    search.set("page", "1");
    search.set("pageSize", "50");
    const query = search.toString();
    return apiRequest<AdminCatalogResult<DestinationAdminDto>>(
      `/admin/catalog/destinations${query ? `?${query}` : ""}`,
    );
  },

  adminDestination: (id: string) =>
    apiRequest<{ item: DestinationAdminDto }>(`/admin/catalog/destinations/${id}`),

  createDestination: (input: DestinationAdminCreateInput) =>
    apiRequest<CatalogMutationResult<DestinationAdminDto>>("/admin/catalog/destinations", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateDestination: (id: string, input: DestinationAdminUpdateInput) =>
    apiRequest<CatalogMutationResult<DestinationAdminDto>>(
      `/admin/catalog/destinations/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  deleteDestination: (id: string) =>
    apiRequest<{ message: string }>(`/admin/catalog/destinations/${id}`, {
      method: "DELETE",
    }),

  adminAttractions: (params: { q?: string; published?: "true" | "false" } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.published) search.set("published", params.published);
    search.set("page", "1");
    search.set("pageSize", "50");
    const query = search.toString();
    return apiRequest<AdminCatalogResult<AttractionAdminDto>>(
      `/admin/catalog/attractions${query ? `?${query}` : ""}`,
    );
  },

  adminAttraction: (id: string) =>
    apiRequest<{ item: AttractionAdminDto }>(`/admin/catalog/attractions/${id}`),

  createAttraction: (input: AttractionAdminCreateInput) =>
    apiRequest<CatalogMutationResult<AttractionAdminDto>>("/admin/catalog/attractions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateAttraction: (id: string, input: AttractionAdminUpdateInput) =>
    apiRequest<CatalogMutationResult<AttractionAdminDto>>(
      `/admin/catalog/attractions/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ),

  deleteAttraction: (id: string) =>
    apiRequest<{ message: string }>(`/admin/catalog/attractions/${id}`, {
      method: "DELETE",
    }),

  // ─── Admin packages ───────────────────────────────────────────────────────

  adminPackages: (params: { q?: string; status?: PackageStatus } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    const query = search.toString();
    return apiRequest<{ items: PackageSummary[] }>(
      `/admin/packages${query ? `?${query}` : ""}`,
    );
  },

  adminPackage: (id: string) =>
    apiRequest<{ package: PackageDetail }>(`/admin/packages/${id}`),

  createPackage: (input: PackageCreateInput) =>
    apiRequest<{ package: PackageDetail }>("/admin/packages", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updatePackage: (id: string, input: PackageUpdateInput) =>
    apiRequest<{ package: PackageDetail }>(`/admin/packages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deletePackage: (id: string) =>
    apiRequest<{ message: string }>(`/admin/packages/${id}`, { method: "DELETE" }),

  // ─── Admin gallery ────────────────────────────────────────────────────────

  adminGallery: (params: { q?: string; status?: "DRAFT" | "PUBLISHED" } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    const query = search.toString();
    return apiRequest<{ items: GalleryItem[] }>(`/admin/gallery${query ? `?${query}` : ""}`);
  },

  adminGalleryItem: (id: string) =>
    apiRequest<{ item: GalleryItem }>(`/admin/gallery/${id}`),

  createGalleryItem: (input: GalleryItemCreateInput) =>
    apiRequest<{ item: GalleryItem }>("/admin/gallery", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateGalleryItem: (id: string, input: GalleryItemUpdateInput) =>
    apiRequest<{ item: GalleryItem }>(`/admin/gallery/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteGalleryItem: (id: string) =>
    apiRequest<{ message: string }>(`/admin/gallery/${id}`, { method: "DELETE" }),

  // ─── Site settings (D24 contact + social) ─────────────────────────────────

  siteSettings: () => apiRequest<{ settings: SiteSettings }>("/site-settings"),

  adminUpdateSettings: (input: SiteSettingsUpdateInput) =>
    apiRequest<{ settings: SiteSettings }>("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // ─── Package bookings (D25) ───────────────────────────────────────────────

  createBooking: (input: PackageBookingCreateWire) =>
    apiRequest<{ booking: PackageBooking }>("/bookings", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  adminPackageBookings: (status?: PackageBooking["status"]) => {
    const query = status ? `?status=${status}` : "";
    return apiRequest<AdminPackageBookingsResult>(`/admin/bookings${query}`);
  },

  /** Outreach actions (D36): acknowledge + concern emails to the traveler. */
  adminAcknowledgeBooking: (id: string, message?: string) =>
    apiRequest<{ message: string }>(`/admin/bookings/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify(message ? { message } : {}),
    }),

  adminConcernBooking: (id: string, message: string) =>
    apiRequest<{ message: string }>(`/admin/bookings/${id}/concern`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  /** Availability decision (D36): only for payment-pending requests. */
  adminDecideBooking: (id: string, decision: "CONFIRMED" | "CANCELLED", reason?: string) =>
    apiRequest<{ booking: AdminPackageBookingDto }>(`/admin/bookings/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }),

  /** Junk-request cleanup (D28): server refuses financial records. */
  adminDeleteBooking: (id: string) =>
    apiRequest<{ message: string }>(`/admin/bookings/${id}`, { method: "DELETE" }),

  /** Manual payments (D44): record payment received for a confirmed booking. */
  adminMarkBookingPaid: (id: string) =>
    apiRequest<{ booking: AdminPackageBookingDto }>(`/admin/bookings/${id}/paid`, {
      method: "POST",
    }),

  myBookings: () => apiRequest<MyPackageBookingsResult>("/bookings/me"),

  // ─── Transport listing requests (D43 quote-only) ──────────────────────────

  createListingRequest: (input: ListingRequestCreateWire) =>
    apiRequest<{ request: ListingRequest }>("/listing-requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  myListingRequests: () => apiRequest<MyListingRequestsResult>("/listing-requests/me"),

  adminListingRequests: (status?: "PENDING" | "CONFIRMED" | "CANCELLED") => {
    const query = status ? `?status=${status}` : "";
    return apiRequest<AdminListingRequestsResult>(`/admin/listing-requests${query}`);
  },

  /** The team's written quote: emailed + kept so the traveler can re-read it. */
  adminQuoteListingRequest: (id: string, message: string) =>
    apiRequest<{ message: string }>(`/admin/listing-requests/${encodeURIComponent(id)}/quote`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  adminDecideListingRequest: (
    id: string,
    decision: "CONFIRMED" | "CANCELLED",
    message?: string,
  ) =>
    apiRequest<{ request: AdminListingRequest }>(
      `/admin/listing-requests/${encodeURIComponent(id)}/decision`,
      { method: "POST", body: JSON.stringify({ decision, ...(message ? { message } : {}) }) },
    ),

  /** Ops cleanup - a quote conversation is not a financial record. */
  adminDeleteListingRequest: (id: string) =>
    apiRequest<{ message: string }>(`/admin/listing-requests/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /**
   * Managed uploads (D45): multipart goes through the same-origin /api proxy;
   * the browser sets the multipart boundary, so the body must NOT carry the
   * JSON content type (apiRequest skips it for FormData bodies).
   */
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ upload: UploadResult }>("/admin/uploads", {
      method: "POST",
      body: form,
    });
  },

  userCounts: () => apiRequest<{ counts: UserCounts }>("/users/counts"),

  // ─── Package departures (D41 seat-managed dates) ──────────────────────────

  packageDepartures: (slug: string) =>
    apiRequest<{ departures: PackageDepartureDto[] }>(
      `/packages/${encodeURIComponent(slug)}/departures`,
    ),

  adminDepartures: (packageId: string) =>
    apiRequest<{ departures: PackageDepartureDto[] }>(
      `/admin/packages/${encodeURIComponent(packageId)}/departures`,
    ),

  adminCreateDeparture: (
    packageId: string,
    input: { startDate: string; seats: number },
  ) =>
    apiRequest<{ departures: PackageDepartureDto[] }>(
      `/admin/packages/${encodeURIComponent(packageId)}/departures`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  /** Weekly quick-add: same weekday and seats for N weeks from startDate. */
  adminCreateDeparturesWeekly: (
    packageId: string,
    input: { startDate: string; seats: number; weeks: number },
  ) =>
    apiRequest<{ created: number; departures: PackageDepartureDto[] }>(
      `/admin/packages/${encodeURIComponent(packageId)}/departures/weekly`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  adminUpdateDeparture: (
    packageId: string,
    departureId: string,
    seats: number,
  ) =>
    apiRequest<{ departure: PackageDepartureDto }>(
      `/admin/packages/${encodeURIComponent(packageId)}/departures/${encodeURIComponent(departureId)}`,
      { method: "PATCH", body: JSON.stringify({ seats }) },
    ),

  adminDeleteDeparture: (packageId: string, departureId: string) =>
    apiRequest<{ message: string }>(
      `/admin/packages/${encodeURIComponent(packageId)}/departures/${encodeURIComponent(departureId)}`,
      { method: "DELETE" },
    ),

  // ─── Package reviews (D42 booking-verified + moderated) ───────────────────

  /** Approved reviews + star summary; used by the package page's SSR too. */
  packageReviews: (slug: string) =>
    apiRequest<PackageReviewsResult>(`/reviews?packageSlug=${encodeURIComponent(slug)}`),

  reviewStatus: (packageId: string) =>
    apiRequest<ReviewEligibilityDto>(`/reviews/status?packageId=${encodeURIComponent(packageId)}`),

  submitReview: (input: ReviewCreateInput) =>
    apiRequest<{ status: PackageReviewStatus }>("/reviews", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  adminReviews: (status?: PackageReviewStatus) => {
    const query = status ? `?status=${status}` : "";
    return apiRequest<AdminPackageReviewsResult>(`/admin/reviews${query}`);
  },

  adminApproveReview: (id: string) =>
    apiRequest<{ review: AdminPackageReviewDto }>(`/admin/reviews/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    }),

  adminRejectReview: (id: string, reason: string) =>
    apiRequest<{ review: AdminPackageReviewDto }>(`/admin/reviews/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // ─── Traveler notifications (D40 inbox) ───────────────────────────────────

  notifications: (page = 1) =>
    apiRequest<TravelerNotificationsResult>(
      `/notifications?page=${page}&pageSize=20`,
    ),

  markNotificationRead: (id: string) =>
    apiRequest<{ notification: TravelerNotificationDto }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
    ),

  markAllNotificationsRead: () =>
    apiRequest<{ marked: number }>("/notifications/read-all", { method: "POST" }),

  notificationsUnread: () => apiRequest<{ unread: number }>("/notifications/unread"),

  // ─── Admin enquiries (D6 concierge queue) ─────────────────────────────────

  adminEnquiries: (params: { q?: string; status?: EnquiryStatus } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    const query = search.toString();
    return apiRequest<{ items: Enquiry[] }>(`/admin/enquiries${query ? `?${query}` : ""}`);
  },

  updateEnquiry: (id: string, input: EnquiryUpdateInput) =>
    apiRequest<{ enquiry: Enquiry }>(`/admin/enquiries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  /** Spam / personal-data cleanup (D28): audited on the server. */
  deleteEnquiry: (id: string) =>
    apiRequest<{ message: string }>(`/admin/enquiries/${id}`, { method: "DELETE" }),

  // ─── Operator tours ───────────────────────────────────────────────────────

  myTours: () => apiRequest<{ items: TourDto[] }>("/operator/me/tours"),

  createTour: (input: TourPayload) =>
    apiRequest<{ tour: TourDto }>("/operator/me/tours", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateTour: (id: string, input: Partial<TourPayload>) =>
    apiRequest<{ tour: TourDto }>(`/operator/me/tours/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteTour: (id: string) =>
    apiRequest<{ message: string }>(`/operator/me/tours/${id}`, { method: "DELETE" }),

  // ─── Operator experiences ─────────────────────────────────────────────────

  myExperiences: () => apiRequest<{ items: ExperienceDto[] }>("/operator/me/experiences"),

  createExperience: (input: ExperiencePayload) =>
    apiRequest<{ experience: ExperienceDto }>("/operator/me/experiences", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateExperience: (id: string, input: Partial<ExperiencePayload>) =>
    apiRequest<{ experience: ExperienceDto }>(`/operator/me/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteExperience: (id: string) =>
    apiRequest<{ message: string }>(`/operator/me/experiences/${id}`, { method: "DELETE" }),
};

// ─── Operator DTOs (mirror the API JSON) ────────────────────────────────────

export type ProviderType =
  | "TOUR_OPERATOR"
  | "HOTEL"
  | "EXPERIENCE_PROVIDER"
  | "TRANSPORT_COMPANY"
  | "RESTAURANT"
  | "EVENT_ORGANIZER"
  | "DRIVER_PARTNER";

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
  RESTAURANT: "Restaurant",
  EVENT_ORGANIZER: "Event organizer",
  DRIVER_PARTNER: "Driver partner",
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
