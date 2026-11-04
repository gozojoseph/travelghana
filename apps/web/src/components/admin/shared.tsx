"use client";

import type { EnquiryStatus, MembershipStatusValue, NotificationStatusValue, PackageStatus, Role, UserStatusValue } from "@travelghana/types";
import type { VerificationStatus, ReviewActionInput } from "@/lib/api";
import type { ListingStatus } from "@/lib/api";

/** Admin-wide datetime rendering, e.g. "19 Oct 2026, 21:30". Accepts the
 * string or (mis-labelled) Date shape the JSON transport can surface. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export {
  buttonClass,
  dangerButtonClass,
  Field,
  FormFeedback,
  inputClass,
  issueMap,
  secondaryButtonClass,
} from "@/components/ui/form";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const PACKAGE_STATUSES = Object.keys(PACKAGE_STATUS_LABELS) as PackageStatus[];

export const PACKAGE_STATUS_CHIP_CLASS: Record<PackageStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-primary/10 text-primary",
  ARCHIVED: "bg-accent/10 text-accent",
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In review",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

export const ENQUIRY_STATUSES = Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[];

export const ENQUIRY_STATUS_CHIP_CLASS: Record<EnquiryStatus, string> = {
  NEW: "bg-primary/10 text-primary",
  IN_REVIEW: "bg-secondary/40",
  QUOTED: "bg-accent/10 text-accent",
  CONVERTED: "bg-primary/15 text-primary",
  CLOSED: "bg-muted text-muted-foreground",
};

// ─── Admin console (D20) ─────────────────────────────────────────────────────

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "In review",
  PUBLISHED: "Live",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

export interface ListingChip {
  label: string;
  className: string;
}

export const LISTING_STATUS_CHIPS: Record<ListingStatus, ListingChip> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  PENDING_REVIEW: { label: "In review", className: "bg-primary/10 text-primary" },
  PUBLISHED: { label: "Live", className: "bg-green-100 text-green-700" },
  PAUSED: { label: "Paused", className: "bg-amber-100 text-amber-700" },
  ARCHIVED: { label: "Archived", className: "bg-accent/10 text-accent" },
};

export const REVIEW_ACTION_LABELS: Record<ReviewActionInput, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  SUSPEND: "Suspend",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const VERIFICATION_CHIP_CLASS: Record<VerificationStatus, string> = {
  UNVERIFIED: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-700",
  VERIFIED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

export const ROLE_LABELS: Record<Role, string> = {
  TRAVELER: "Traveler",
  DRIVER: "Driver",
  TOUR_OPERATOR: "Tour operator",
  HOTEL_MANAGER: "Hotel manager",
  TRANSPORT_COMPANY: "Transport",
  EXPERIENCE_PROVIDER: "Experience provider",
  ADMIN: "Admin",
};

export const USER_STATUS_LABELS: Record<UserStatusValue, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export const USER_STATUS_CHIP_CLASS: Record<UserStatusValue, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatusValue, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SUSPENDED: "Revoked",
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatusValue, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  FAILED: "Failed",
};

export const NOTIFICATION_STATUS_CHIP_CLASS: Record<NotificationStatusValue, string> = {
  QUEUED: "bg-amber-100 text-amber-700",
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
};

export const DESTINATION_CATEGORY_LABELS: Record<string, string> = {
  BEACH: "Beach",
  HISTORICAL: "Historical",
  CULTURAL: "Cultural",
  NATURE: "Nature",
  CITY: "City",
  FOOD: "Food",
  ADVENTURE: "Adventure",
};

export const USER_STATUS_VALUES = Object.keys(USER_STATUS_LABELS) as UserStatusValue[];
