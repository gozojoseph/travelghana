/**
 * Admin visitor-insights types (D37). The API aggregates the first-party
 * clickstream (PageView); all timestamps are ISO strings, all pagination
 * follows the AdminAudit shape.
 */

export interface InsightFunnelStep {
  label: string;
  /** Distinct sessions that reached this step. */
  sessions: number;
  /** Share of the first step sessions (1 decimal precision on the client). */
  rate: number;
}

export interface InsightTopPath {
  path: string;
  views: number;
}

export interface InsightTopReferrer {
  /** Origin only ("direct" for empty referrers). */
  referrer: string;
  sessions: number;
}

export interface InsightDeviceSplit {
  device: string;
  sessions: number;
}

export interface AdminInsightsResult {
  range: "24h" | "7d" | "30d";
  since: string;
  kpis: {
    visitors: number;
    sessions: number;
    events: number;
    /** Server-truth bookings created in range (PackageBooking rows). */
    bookings: number;
  };
  funnel: InsightFunnelStep[];
  topPaths: InsightTopPath[];
  topReferrers: InsightTopReferrer[];
  devices: InsightDeviceSplit[];
}

export interface AdminInsightSessionSummary {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  events: number;
  /** First non-referrer path visited in the session. */
  entryPath: string;
  /** Last path visited - where they stopped. */
  lastPath: string;
  device: string;
  userId: string | null;
  email: string | null;
  /** Booking actions recorded inside the session (best signal of intent). */
  trackedBookings: boolean;
}

export interface AdminInsightSessionsResult {
  items: AdminInsightSessionSummary[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface AdminInsightEventDto {
  id: string;
  sessionId: string;
  visitorId: string;
  userId: string | null;
  email: string | null;
  path: string;
  referrer: string | null;
  device: string;
  kind: string;
  name: string | null;
  meta: unknown;
  occurredAt: string;
}

export interface AdminInsightSessionDetail {
  sessionId: string;
  events: AdminInsightEventDto[];
}
