import { z } from "zod";

/**
 * First-party clickstream (D37). The web recorder reports one row per browsed
 * page or tracked action; Paid identifiers (query strings) never leave the
 * browser: the client strips them, and the path value here is trusted only
 * within these bounds. Sessions are 30-minute buckets the client maintains.
 */

export const INSIGHT_RANGES = ["24h", "7d", "30d"] as const;

const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);

export const trackEventSchema = z.object({
  /** Browser session bucket (new after 30 min idle; client-owned). */
  sessionId: z.string().trim().min(8).max(64),
  /** Persistent per-browser visitor id (cleared storage = new visitor). */
  visitorId: z.string().trim().min(8).max(64),
  /** Path without query string (the client strips it before sending). */
  path: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^\/[^\s]*$/, { message: "Path must start with /" }),
  /** Referrer as ORIGIN only (privacy: no full URLs cross the wire). */
  referrer: z.string().trim().max(200).nullable().optional(),
  device: z.enum(["phone", "tablet", "desktop", "other"]),
  kind: z.enum(["view", "action"]),
  name: z.string().trim().min(1).max(80).optional(),
  /** Values are stringified by the recorder (schema parity across zod/JSONB). */
  meta: z.record(z.string(), z.string()).optional(),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;

export const trackEventBatchSchema = z
  .object({
    events: z.array(trackEventSchema).min(1).max(20),
  });

export type TrackEventBatchInput = z.infer<typeof trackEventBatchSchema>;

export const adminInsightsQuerySchema = z.object({
  range: z.enum(INSIGHT_RANGES).default("7d"),
  // URL-friendly boolean: coerces "true"/"false" strings properly (a bare
  // z.coerce.boolean() would turn the string "false" into true).
  includeAdmins: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .optional(),
});

export type AdminInsightsQuery = z.infer<typeof adminInsightsQuerySchema>;

export const adminInsightSessionsQuerySchema = z.object({
  range: z.enum(INSIGHT_RANGES).default("7d"),
  includeAdmins: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type AdminInsightSessionsQuery = z.infer<typeof adminInsightSessionsQuerySchema>;

export const insightSessionParamSchema = z.object({
  sessionId: z.string().trim().min(8).max(64),
});

export type InsightSessionParam = z.infer<typeof insightSessionParamSchema>;
