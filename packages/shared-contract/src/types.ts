/** Roles a user can hold on the platform. */
export type Role =
  | "TRAVELER"
  | "DRIVER"
  | "TOUR_OPERATOR"
  | "HOTEL_MANAGER"
  | "TRANSPORT_COMPANY"
  | "EXPERIENCE_PROVIDER"
  | "ADMIN";

/** Booking flow states for the concierge-managed service. */
export type BookingStatus =
  | "REQUESTED"
  | "PAID"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED";

/** Review moderation states. */
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Provider verification stage shown in listings/catalog. */
export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

/** Listing type shown to travelers. */
export type ListingType = "TOUR" | "EXPERIENCE" | "TRANSPORT" | "HOTEL" | "EVENT";

/** Money as integer minor units (pesewas) + ISO 4217 currency. */
export interface Money {
  amountMinor: number;
  currencyCode: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  createdAt: string;
}

export interface Provider {
  id: string;
  type: "TOUR_OPERATOR" | "HOTEL" | "EXPERIENCE_PROVIDER" | "TRANSPORT_COMPANY";
  name: string;
  slug: string;
  description: string | null;
  verificationStatus: VerificationStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  cityId: string | null;
  serviceArea: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  region: { id: string; name: string; slug: string };
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  cities: City[];
}

export interface Listing {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  serviceArea: string | null;
  cityId: string | null;
  regionId: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  address: string | null;
  category: string | null;
  whatIsIncluded: string | null;
  whatIsExcluded: string | null;
  requirements: string | null;
  cancellationPolicy: string | null;
  heroImageUrl: string | null;
  priceMinor: number;
  currencyCode: string;
  durationMinutes: number | null;
  capacity: number;
  verificationStatus: VerificationStatus;
  published: boolean;
  publishedAt: string | null;
  publishedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummary extends Listing {
  provider: Pick<Provider, "id" | "name" | "slug" | "verificationStatus">;
  city: Pick<City, "id" | "name" | "slug"> | null;
  region: Pick<Region, "id" | "name" | "slug"> | null;
}

export interface Booking {
  id: string;
  code: string;
  userId: string;
  providerId: string;
  listingId: string;
  city: string;
  adults: number;
  children: number;
  totalMinor: number;
  currencyCode: string;
  status: BookingStatus;
  reviewStatus: ReviewStatus;
  specialRequests: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingReview {
  id: string;
  listingId: string;
  reviewerId: string;
  comment: string | null;
  status: ReviewStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
