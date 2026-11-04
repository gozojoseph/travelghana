/** Current shared-contract version. Bump on breaking contract changes. */
export const appVersion = "0.1.0";

export type { Role, BookingStatus, ReviewStatus, VerificationStatus, Provider, Listing, ListingSummary, Booking, ListingReview, User, ListingType, Money } from "./types";

export const packageJson = {
  name: "@travelghana/shared-contract",
  version: appVersion,
  description: "Canonical domain model shared by the API and web app",
  main: "src/index.ts",
  types: "src/index.ts",
} as const;
