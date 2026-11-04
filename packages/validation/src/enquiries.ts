import { z } from "zod";

import { TRIP_INTEREST_VALUES } from "./trips";

/**
 * Trip enquiry validation (D6 — concierge workflow, Phase 2).
 *
 * One create schema covers both capture surfaces:
 * - the public /enquire form (guests, no account), and
 * - the trip workspace "send to concierge" flow, where an owner optionally
 *   links the enquiry to their trip via `tripId` — the API then enriches the
 *   enquiry from the trip (dates, party size, destination/interest snapshot,
 *   derived budget range) and records the link for the admin queue.
 * Contact fields default to the signed-in account server-side when omitted.
 */

export const ENQUIRY_STATUS_VALUES = [
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "CONVERTED",
  "CLOSED",
] as const;

/** Free-text budget bands offered on the public form (coarse, not prices). */
export const BUDGET_RANGE_OPTIONS = [
  "Under GHS 2,000",
  "GHS 2,000 - 5,000",
  "GHS 5,000 - 10,000",
  "GHS 10,000+",
  "Flexible",
] as const;

const enquirableInterest = z.enum(TRIP_INTEREST_VALUES);

export const enquiryCreateSchema = z
  .object({
    tripId: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().max(30).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    adults: z.coerce.number().int().min(1).max(30).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),
    destinations: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    interests: z.array(enquirableInterest).max(TRIP_INTEREST_VALUES.length).optional(),
    budgetRange: z
      .string()
      .trim()
      .max(60)
      .refine((v) => v === "" || BUDGET_RANGE_OPTIONS.includes(v as (typeof BUDGET_RANGE_OPTIONS)[number]), {
        message: "Choose a budget range from the list",
      })
      .optional(),
    accommodationPref: z.string().trim().max(500).optional(),
    transportPref: z.string().trim().max(500).optional(),
    specialRequests: z.string().trim().max(2000).optional(),
  });
  // No "non-empty" refine here: for a signed-in owner an empty body is a
  // legitimate "default everything from my account/trip" request. Guests
  // without name/email are rejected by the service (MISSING_CONTACT).

export type EnquiryCreateInput = z.infer<typeof enquiryCreateSchema>;

export const enquiryListQuerySchema = z.object({
  status: z.enum(ENQUIRY_STATUS_VALUES).optional(),
  q: z.string().trim().max(120).optional(),
});

export type EnquiryListQuery = z.infer<typeof enquiryListQuerySchema>;

/**
 * Admin queue update: advance the pipeline and/or (re)assign. The pipeline is
 * NEW → IN_REVIEW → QUOTED → CONVERTED → CLOSED, and CLOSED is terminal.
 */
export const ENQUIRY_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  NEW: ["IN_REVIEW", "QUOTED", "CLOSED"],
  IN_REVIEW: ["QUOTED", "CONVERTED", "CLOSED"],
  QUOTED: ["CONVERTED", "CLOSED"],
  CONVERTED: ["CLOSED"],
  CLOSED: [],
};

export const enquiryUpdateSchema = z
  .object({
    status: z.enum(ENQUIRY_STATUS_VALUES).optional(),
    assignedAdminId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.assignedAdminId !== undefined, {
    message: "Nothing to update",
  });

export type EnquiryUpdateInput = z.infer<typeof enquiryUpdateSchema>;
