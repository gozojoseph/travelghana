import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@travelghana/database";
import type {
  AdminInsightEventDto,
  AdminInsightSessionDetail,
  AdminInsightSessionsResult,
  AdminInsightSessionSummary,
  AdminInsightsResult,
  InsightFunnelStep,
} from "@travelghana/types";
import type {
  AdminInsightSessionsQuery,
  AdminInsightsQuery,
  TrackEventInput,
} from "@travelghana/validation";

import { PrismaService } from "../../common/prisma.service";

/** Range keys shared with validation (`24h` | `7d` | `30d`). */
const RANGE_HOURS = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;

/** Funnel labels shared by the SQL aggregation (order matters). */
export const FUNNEL_STEP_LABELS = [
  "Visited the site",
  "Browsed packages or destinations",
  "Opened a specific package",
  "Started a booking",
  "Created a booking",
] as const;

/** Pure funnel builder so rate math is testable away from the raw SQL. */
export function buildFunnel(counts: number[]): InsightFunnelStep[] {
  const first = counts[0] ?? 0;
  return counts.map((sessions, index) => ({
    label: FUNNEL_STEP_LABELS[index] ?? `Step ${index + 1}`,
    sessions,
    rate: first > 0 ? Math.round((sessions / first) * 1000) / 10 : 0,
  }));
}

/**
 * First-party clickstream (D37): writes browser-reported batches and serves
 * the /admin/insights aggregates. Funnel truth for the final step comes from
 * the PackageBooking table (server-side), not from client-claimed events.
 */
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a batch; tracking must never break UX, so failures only warn. */
  async record(events: TrackEventInput[], userId: string | null): Promise<number> {
    try {
      const result = await this.prisma.pageView.createMany({
        data: events.map((event) => this.toRow(event, userId)),
      });
      return result.count;
    } catch (error) {
      this.logger.warn(
        `Track batch rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /** KPIs + funnel + top lists for one date range. */
  async summary(query: AdminInsightsQuery): Promise<AdminInsightsResult> {
    const since = this.since(query.range);
    const filter = this.whereSql(since, query.includeAdmins === true);

    const [kpiRow, funnelRow, step5Row, topPathRows, referrerRows, deviceRows, bookings] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ visitors: number; sessions: number; events: number }>>(
          Prisma.sql`SELECT
            (COUNT(DISTINCT "pv"."visitorId"))::int AS visitors,
            (COUNT(DISTINCT "pv"."sessionId"))::int AS sessions,
            (COUNT(*))::int AS events
            FROM "PageView" "pv" WHERE ${filter}`,
        ),
        this.prisma.$queryRaw<
          Array<{ step1: number; step2: number; step3: number; step4: number }>
        >(
          Prisma.sql`SELECT
            (COUNT(DISTINCT "pv"."sessionId"))::int AS step1,
            (COUNT(DISTINCT "pv"."sessionId") FILTER (WHERE "pv"."path" LIKE '/packages%'
              OR "pv"."path" LIKE '/destinations%' OR "pv"."path" LIKE '/tours%'))::int AS step2,
            (COUNT(DISTINCT "pv"."sessionId") FILTER (WHERE "pv"."path" ~ ${"^/packages/[^/]+$"}))::int AS step3,
            (COUNT(DISTINCT "pv"."sessionId") FILTER (WHERE "pv"."kind" = 'action'
              AND "pv"."name" = 'booking_started'))::int AS step4
            FROM "PageView" "pv" WHERE ${filter}`,
        ),
        this.prisma.$queryRaw<Array<{ step5: number }>>(
          Prisma.sql`SELECT (COUNT(DISTINCT "pv"."sessionId"))::int AS step5
            FROM "PageView" "pv"
            WHERE ${filter}
              AND "pv"."userId" IS NOT NULL
              AND "pv"."userId" IN (
                SELECT "b"."userId" FROM "PackageBooking" "b"
                WHERE "b"."createdAt" >= ${since} AND "b"."userId" IS NOT NULL
              )`,
        ),
        this.prisma.$queryRaw<Array<{ path: string; views: number }>>(
          Prisma.sql`SELECT "pv"."path" AS path, (COUNT(*))::int AS views
            FROM "PageView" "pv"
            WHERE ${filter} AND "pv"."kind" = 'view'
            GROUP BY "pv"."path" ORDER BY views DESC, path ASC LIMIT 10`,
        ),
        this.prisma.$queryRaw<Array<{ referrer: string; sessions: number }>>(
          Prisma.sql`SELECT COALESCE(NULLIF("pv"."referrer", ''), 'direct') AS referrer,
            (COUNT(DISTINCT "pv"."sessionId"))::int AS sessions
            FROM "PageView" "pv" WHERE ${filter}
            GROUP BY 1 ORDER BY sessions DESC LIMIT 8`,
        ),
        this.prisma.$queryRaw<Array<{ device: string; sessions: number }>>(
          Prisma.sql`SELECT "pv"."device" AS device, (COUNT(DISTINCT "pv"."sessionId"))::int AS sessions
            FROM "PageView" "pv" WHERE ${filter}
            GROUP BY "pv"."device" ORDER BY sessions DESC, device ASC`,
        ),
        this.prisma.packageBooking.count({ where: { createdAt: { gte: since } } }),
      ]);

    const funnel = buildFunnel([
      funnelRow[0]?.step1 ?? 0,
      funnelRow[0]?.step2 ?? 0,
      funnelRow[0]?.step3 ?? 0,
      funnelRow[0]?.step4 ?? 0,
      step5Row[0]?.step5 ?? 0,
    ]);

    return {
      range: query.range,
      since: since.toISOString(),
      kpis: {
        visitors: kpiRow[0]?.visitors ?? 0,
        sessions: kpiRow[0]?.sessions ?? 0,
        events: kpiRow[0]?.events ?? 0,
        bookings,
      },
      funnel,
      topPaths: topPathRows.map((row) => ({ path: row.path, views: Number(row.views) })),
      topReferrers: referrerRows.map((row) => ({
        referrer: row.referrer,
        sessions: Number(row.sessions),
      })),
      devices: deviceRows.map((row) => ({
        device: row.device,
        sessions: Number(row.sessions),
      })),
    };
  }

  /** Paginated session list (most recently active first). */
  async sessions(query: AdminInsightSessionsQuery): Promise<AdminInsightSessionsResult> {
    const since = this.since(query.range);
    const filter = this.whereSql(since, query.includeAdmins === true);
    const offset = (query.page - 1) * query.pageSize;

    const [totalRow, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`SELECT (COUNT(DISTINCT "pv"."sessionId"))::int AS total
          FROM "PageView" "pv" WHERE ${filter}`,
      ),
      this.prisma.$queryRaw<
        Array<{
          sessionId: string;
          firstAt: Date;
          lastAt: Date;
          events: number;
          entryPath: string;
          lastPath: string;
          device: string | null;
          userId: string | null;
          trackedBookings: boolean;
        }>
      >(
        Prisma.sql`SELECT "pv"."sessionId" AS "sessionId",
          MIN("pv"."occurredAt") AS "firstAt",
          MAX("pv"."occurredAt") AS "lastAt",
          (COUNT(*))::int AS events,
          (ARRAY_AGG("pv"."path" ORDER BY "pv"."occurredAt" ASC, "pv"."id" ASC))[1] AS "entryPath",
          (ARRAY_AGG("pv"."path" ORDER BY "pv"."occurredAt" DESC, "pv"."id" DESC))[1] AS "lastPath",
          (ARRAY_AGG("pv"."device" ORDER BY "pv"."occurredAt" DESC))[1] AS device,
          (ARRAY_AGG("pv"."userId" ORDER BY "pv"."occurredAt" DESC))[1] AS "userId",
          BOOL_OR("pv"."kind" = 'action' AND "pv"."name" LIKE 'booking%') AS "trackedBookings"
        FROM "PageView" "pv"
        WHERE ${filter}
        GROUP BY "pv"."sessionId"
        ORDER BY "lastAt" DESC
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      ),
    ]);

    const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => id !== null))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(users.map((user) => [user.id, user.email]));

    const total = totalRow[0]?.total ?? 0;
    const items: AdminInsightSessionSummary[] = rows.map((row) => ({
      sessionId: row.sessionId,
      firstAt: row.firstAt.toISOString(),
      lastAt: row.lastAt.toISOString(),
      events: Number(row.events),
      entryPath: row.entryPath,
      lastPath: row.lastPath,
      device: row.device ?? "other",
      userId: row.userId,
      email: row.userId ? emailById.get(row.userId) ?? null : null,
      trackedBookings: Boolean(row.trackedBookings),
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
    };
  }

  /** Full event timeline for one session, oldest first. */
  async sessionTimeline(sessionId: string): Promise<AdminInsightSessionDetail> {
    const rows = await this.prisma.pageView.findMany({
      where: { sessionId },
      orderBy: { occurredAt: "desc" },
      take: 300, // defensive cap: anomaly sessions stay inspectable
    });
    rows.reverse();

    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => id !== null))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(users.map((user) => [user.id, user.email]));

    const events: AdminInsightEventDto[] = rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      visitorId: row.visitorId,
      userId: row.userId,
      email: row.userId ? emailById.get(row.userId) ?? null : null,
      path: row.path,
      referrer: row.referrer,
      device: row.device,
      kind: row.kind,
      name: row.name,
      meta: (row.meta as unknown) ?? null,
      occurredAt: row.occurredAt.toISOString(),
    }));

    return { sessionId, events };
  }

  private toRow(event: TrackEventInput, userId: string | null): Prisma.PageViewCreateManyInput {
    const row: Prisma.PageViewCreateManyInput = {
      sessionId: event.sessionId,
      visitorId: event.visitorId,
      userId,
      path: event.path,
      referrer: event.referrer ?? null,
      device: event.device,
      kind: event.kind,
      name: event.name ?? null,
    };
    if (event.meta) row.meta = { ...event.meta };
    return row;
  }

  private since(range: AdminInsightsQuery["range"]): Date {
    return new Date(Date.now() - RANGE_HOURS[range] * 3_600_000);
  }

  /** Shared WHERE fragment; admin browsing stays out of the numbers by default. */
  private whereSql(since: Date, includeAdmins: boolean): Prisma.Sql {
    const adminClause = includeAdmins ? Prisma.empty : Prisma.sql` AND "pv"."path" NOT LIKE '/admin%'`;
    return Prisma.sql`"pv"."occurredAt" >= ${since}${adminClause}`;
  }
}
