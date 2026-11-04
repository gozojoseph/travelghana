/**
 * Admin console contract (D20).
 *
 * Shape notes:
 * - All list endpoints return { items, total, page, pageSize, pages }.
 * - Dates are ISO strings (JSON transport), never Date — web renders them raw.
 * - `meta`/`payload` JSON columns are typed `unknown`; consumers narrow at the
 *   render site (the outbox/activity views treat them as opaque detail blobs).
 */

import type { Role } from "./index";

export type UserStatusValue = "ACTIVE" | "SUSPENDED";
export type MembershipStatusValue = "PENDING" | "ACTIVE" | "SUSPENDED";
export type VerificationStatusValue =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";
export type NotificationStatusValue = "QUEUED" | "SENT" | "FAILED";
export type ProviderTypeValue =
  | "TOUR_OPERATOR"
  | "HOTEL"
  | "EXPERIENCE_PROVIDER"
  | "TRANSPORT_COMPANY"
  | "RESTAURANT"
  | "EVENT_ORGANIZER"
  | "DRIVER_PARTNER";

// ─── Dashboard (§Admin home) ─────────────────────────────────────────────────

/** KPI counters — one entry per shipped admin section (no fake zeros). */
export interface AdminStatsCounts {
  /** Listings awaiting an APPROVE/REJECT/SUSPEND decision. */
  listingsPendingReview: number;
  /** Enquiries with status NEW. */
  enquiriesNew: number;
  /** Enquiries still NEW or IN_REVIEW with no assigned concierge. */
  enquiriesUnassignedActive: number;
  /** Packages in DRAFT status. */
  packagesDraft: number;
  /** Package booking requests awaiting availability confirmation (D25). */
  packageBookingsPending: number;
  /** Destinations not yet published in the public catalog. */
  destinationsUnpublished: number;
  /** Attractions explicitly unpublished from the public catalog. */
  attractionsUnpublished: number;
  /** Providers in UNVERIFIED or PENDING state. */
  providersUnverified: number;
  /** Notifications waiting in the delivery outbox (no provider wired yet). */
  notificationsQueued: number;
  /** Package reviews waiting for a moderation decision (D42). */
  reviewsPending: number;
  /** Transport listing requests awaiting a first team reply (D43). */
  listingRequestsPending: number;
  /** Users with status ACTIVE. */
  usersActive: number;
}

export interface AdminRecentEnquiry {
  id: string;
  code: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface AdminRecentListing {
  id: string;
  title: string;
  providerName: string;
  status: string;
  createdAt: string;
}

export interface AdminRecentAudit {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface AdminStats {
  counts: AdminStatsCounts;
  recent: {
    enquiries: AdminRecentEnquiry[];
    listings: AdminRecentListing[];
    audit: AdminRecentAudit[];
  };
  generatedAt: string;
}

// ─── Users & roles ───────────────────────────────────────────────────────────

export interface MembershipDto {
  id: string;
  role: Role;
  status: MembershipStatusValue;
  createdAt: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: UserStatusValue;
  emailVerified: boolean;
  createdAt: string;
  roles: Role[];
  memberships: MembershipDto[];
  /** Own provider business when the user also operates as an operator. */
  providerId: string | null;
}

export interface AdminUsersResult {
  items: AdminUserDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface AdminUserUpdateResult {
  user: AdminUserDto;
  message: string;
}

// ─── Providers (verification queue) ──────────────────────────────────────────

export interface AdminProviderDto {
  id: string;
  type: ProviderTypeValue;
  name: string;
  slug: string;
  verificationStatus: VerificationStatusValue;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cityId: string | null;
  cityName: string | null;
  /** Owning user account, when the operator registered one. */
  userId: string | null;
  userEmail: string | null;
  listingsTotal: number;
  listingsPublished: number;
  createdAt: string;
}

export interface AdminProvidersResult {
  items: AdminProviderDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

// ─── Audit trail (§Activity) ─────────────────────────────────────────────────

export interface AdminAuditDto {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AdminAuditResult {
  items: AdminAuditDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

// ─── Notification outbox (§Admin notifications) ──────────────────────────────

export interface AdminNotificationDto {
  id: string;
  userId: string;
  userEmail: string | null;
  channel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
  type: string;
  payload: unknown;
  status: NotificationStatusValue;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AdminNotificationsResult {
  items: AdminNotificationDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

// ─── Catalog admin (D20 Phase 6) ─────────────────────────────────────────────

export interface DestinationAdminDto {
  id: string;
  cityId: string;
  cityName: string | null;
  regionName: string | null;
  name: string;
  slug: string;
  category: string;
  summary: string | null;
  description: string | null;
  lat: number;
  lng: number;
  heroImageUrl: string | null;
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  /** Reference counts for the delete guard; populated on the detail route. */
  refCounts?: {
    packages: number;
    itineraryItems: number;
    attractions: number;
  };
}

export interface AttractionAdminDto {
  id: string;
  destinationId: string | null;
  destinationName: string | null;
  cityId: string | null;
  cityName: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  lat: number;
  lng: number;
  published: boolean;
  /** The Attraction model has no timestamp columns; updatedAt of its parent destination is not duplicated here. */
  refCounts?: {
    itineraryItems: number;
  };
}

export interface AdminCatalogResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Read-only city selector for destination/attraction forms. */
export interface CityOption {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
}

export interface CatalogMutationResult<T> {
  item: T;
  message: string;
}
