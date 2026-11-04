import type { BookingStatus } from "./index";

/**
 * Package bookings (D25) - a traveler books one curated package journey.
 * Curated packages are platform-owned editorial journeys without provider
 * inventory, so this is a lean request row: no payment is taken until a human
 * confirms availability. The status reuse of BookingStatus keeps the future
 * payment path (PENDING_PAYMENT -> CONFIRMED) intact.
 */
export interface PackageBooking {
  id: string;
  code: string;
  packageId: string;
  startDate: string;
  adults: number;
  children: number;
  notes: string | null;
  status: BookingStatus;
  /** Manual payments (D44): set when the console records payment received. */
  paidAt: string | null;
  createdAt: string;
}

/** Traveler-facing shape: their own booking with the package display context. */
export interface PackageBookingWithPackage extends PackageBooking {
  package: {
    id: string;
    slug: string;
    title: string;
    priceMinor: number;
    currencyCode: string;
  };
}

export interface MyPackageBookingsResult {
  items: PackageBookingWithPackage[];
  total: number;
}

/** Admin console shape: the package + traveler context attached. */
export interface AdminPackageBookingDto extends PackageBooking {
  /** Manual payments (D44): set by the console's "Mark paid" action. */
  paidAt: string | null;
  package: { id: string; slug: string; title: string; priceMinor: number };
  user: { id: string; email: string; name: string | null };
}

export interface AdminPackageBookingsResult {
  items: AdminPackageBookingDto[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
