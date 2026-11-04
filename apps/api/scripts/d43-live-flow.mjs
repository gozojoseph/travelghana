/**
 * D43 live flow (run with the API dev server on :4000):
 * exercises the transport quote flow end to end with throwaway rows.
 *
 * Steps: catalog transport list -> detail (asserts NO price fields escape)
 * -> anonymous request attempt 401 -> traveler register/login -> create the
 * TB- request -> /me -> party-above-capacity 409 -> promote to ADMIN (DB)
 * -> admin queue/quote/decision flow -> second decision 409 -> markPaid
 * check on a throwaway package booking -> SSR /transport page check.
 *
 * Usage: node scripts/d43-live-flow.mjs
 * Requires `node scripts/d43-smoke.mjs seed && node scripts/d43-smoke.mjs settings`
 * beforehand and cleanup after (`clean`). Prints one line per check.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const envText = readFileSync(path.join(root, "packages", "database", ".env"), "utf8");
function envValue(name) {
  const line = envText.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return "";
  return line.split("=").slice(1).join("=").trim().replace(/^"(.*)"$/, "$1");
}

const require = createRequire(path.join(root, "apps", "api", "package.json"));
const { PrismaClient } = require("@travelghana/database");
const prisma = new PrismaClient({ datasources: { db: { url: envValue("DATABASE_URL") } } });

const API = process.env.API_BASE ?? "http://localhost:4000/api";
const WEB = process.env.WEB_BASE ?? "http://localhost:3000";
const marker = "smoketest-d43";
const providerSlug = "smoke-rides-d43-deadbeef";
const listingSlug = "smoke-transfer-d43";
const password = "Sm0ke-D43-Password!";
const email = `${marker}-${Date.now()}@example.com`;
let cookie = "";
let failures = 0;

function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` - ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

try {
  // 1. The public transport list contains the smoke listing.
  const list = await api("GET", "/catalog/transport");
  const smokable = list.json?.items?.find((x) => x.provider?.slug === providerSlug);
  check(
    "catalog transport lists the smoke listing",
    list.status === 200 && Boolean(smokable),
    `total=${list.json?.total}`,
  );
  if (!smokable) throw new Error("smoke listing missing - seed first");
  check(
    "list payload carries no price fields",
    smokable.priceMinor === undefined && smokable.currencyCode === undefined,
  );

  // 2. Detail by provider slug + listing slug.
  const detail = await api(
    "GET",
    `/catalog/transport/${providerSlug}/${listingSlug}`,
  );
  check("transport detail 200", detail.status === 200, detail.json?.title);
  check(
    "detail payload carries no price fields",
    detail.json?.priceMinor === undefined,
  );
  check("detail carries provider context", detail.json?.provider?.type === "TRANSPORT_COMPANY");
  const listingId = detail.json.id;

  // 3. Missing slug pair 404s.
  const missing = await api("GET", `/catalog/transport/no-such/deep`);
  check("unknown transport detail 404", missing.status === 404);

  // 4. Anonymous request attempt -> 401 (session guard).
  const anon = await api("POST", "/listing-requests", {
    listingId,
    startDate: "2026-12-05",
    partySize: 2,
  });
  check("anonymous transport request 401", anon.status === 401, anon.json?.error?.code);

  // 5. Traveler session + the request flow.
  const reg = await api("POST", "/auth/register", {
    email,
    password,
    name: "Smoke D43",
  });
  check("traveler register ok", reg.status === 200 || reg.status === 201, reg.json?.user?.email);
  cookie = "";
  const login = await api("POST", "/auth/login", { email, password });
  check("traveler login ok", login.status === 200, login.json?.user?.id);
  check("traveler cannot be the driftless admin yet", !login.json?.user?.roles?.includes("ADMIN"));

  const startDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const created = await api("POST", "/listing-requests", {
    listingId,
    startDate,
    partySize: 3,
    notes: "Flight lands 14:20, please meet at arrivals (smoke)",
  });
  check("request created TB-", created.status === 201, created.json?.request?.code);
  check(
    "code shape TB-XXXXXX",
    /^TB-[A-Z2-9]{6}$/.test(created.json?.request?.code ?? ""),
    created.json?.request?.code,
  );
  check("status starts PENDING", created.json?.request?.status === "PENDING");

  const mine = await api("GET", "/listing-requests/me");
  check(
    "traveler /me lists their request",
    mine.status === 200 &&
      mine.json?.items?.some((r) => r.id === created.json.request.id),
    `total=${mine.json?.total}`,
  );

  const overload = await api("POST", "/listing-requests", {
    listingId,
    startDate,
    partySize: 9,
  });
  check(
    "party above capacity 409 REQUEST_ABOVE_CAPACITY",
    overload.status === 409 && overload.json?.error?.code === "REQUEST_ABOVE_CAPACITY",
    overload.json?.error?.code,
  );

  const past = await api("POST", "/listing-requests", {
    listingId,
    startDate: "2020-01-02",
    partySize: 2,
  });
  check("past travel date rejected 400", past.status === 400);

  // 6. Promote the smoke user to ADMIN for the console half (throwaway).
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("smoke user missing");
  await prisma.roleMembership.create({ data: { userId: user.id, role: "ADMIN" } });
  // Fresh login so the session mapper rebuilds roles from memberships.
  cookie = "";
  await api("POST", "/auth/login", { email, password });
  const me = await api("GET", "/auth/me");
  check("session reflects the ADMIN role after promotion", me.json?.user?.roles?.includes("ADMIN") === true);

  // 7. Admin queue + quote + decision.
  const queue = await api("GET", "/admin/listing-requests?status=PENDING");
  check(
    "admin queue lists the pending request",
    queue.status === 200 &&
      queue.json?.items?.some((r) => r.code === created.json.request.code),
    `total=${queue.json?.total}`,
  );
  const quote = await api("POST", `/admin/listing-requests/${created.json.request.id}/quote`, {
    message: "Smoke quote: GHS 350 all-in, fuel and driver included.",
  });
  check("quote accepted", quote.status === 200 || quote.status === 201, quote.json?.message);

  const withQuote = await prisma.listingBooking.findUnique({
    where: { id: created.json.request.id },
  });
  check(
    "quote kept on the row (quoteNote/quoteAt)",
    Boolean(withQuote?.quoteNote && withQuote?.quoteAt),
  );
  const notifCount = await prisma.notification.count({
    where: { userId: user.id, type: "LISTING_REQUEST_QUOTED" },
  });
  check("quote queued an in-app notification", notifCount === 1);

  const decided = await api("POST", `/admin/listing-requests/${created.json.request.id}/decision`, {
    decision: "CONFIRMED",
    message: "Smoke confirm - driver meets you at Arrivals.",
  });
  check(
    "confirm decision returns the row",
    (decided.status === 200 || decided.status === 201) &&
      decided.json?.request?.status === "CONFIRMED",
    decided.json?.request?.status,
  );
  const decidedNotif = await prisma.notification.count({
    where: { userId: user.id, type: "LISTING_REQUEST_CONFIRMED" },
  });
  check("confirm queued its notification", decidedNotif === 1);

  const again = await api("POST", `/admin/listing-requests/${created.json.request.id}/decision`, {
    decision: "CANCELLED",
  });
  check(
    "second decision 409 REQUEST_STATUS_IMMUTABLE",
    again.status === 409 && again.json?.error?.code === "REQUEST_STATUS_IMMUTABLE",
    again.json?.error?.code,
  );

  // 8. Manual payments (D44): throwaway package booking -> confirm -> paid.
  let pkg = await prisma.package.findUnique({ where: { slug: "smoke-d43-package" } });
  if (!pkg) {
    pkg = await prisma.package.create({
      data: {
        slug: "smoke-d43-package",
        title: "Smoke package D43 (throwaway)",
        durationDays: 2,
        durationNights: 1,
        priceMinor: 100000,
        currencyCode: "GHS",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }
  let booking = await prisma.packageBooking.findUnique({ where: { code: "PB-SMOKED43" } });
  if (!booking) {
    booking = await prisma.packageBooking.create({
      data: {
        code: "PB-SMOKED43",
        userId: user.id,
        packageId: pkg.id,
        startDate: new Date(startDate),
        adults: 1,
        notes: null,
      },
    });
  } else {
    // Keep every later check scoped to THIS run's smoke user.
    await prisma.packageBooking.update({ where: { id: booking.id }, data: { userId: user.id } });
    booking = await prisma.packageBooking.findUnique({ where: { id: booking.id } });
  }
  // Idempotent reruns: reset the throwaway booking to the payment-pending
  // state the mark-paid sequence below expects (a prior partial run may have
  // confirmed it or already recorded paidAt).
  await prisma.packageBooking.update({
    where: { id: booking.id },
    data: { status: "PENDING_PAYMENT", paidAt: null },
  });
  const paidTooEarly = await api("POST", `/admin/bookings/${booking.id}/paid`);
  check(
    "mark paid refuses a payment-pending booking",
    paidTooEarly.status === 409 && paidTooEarly.json?.error?.code === "BOOKING_NOT_CONFIRMED",
    paidTooEarly.json?.error?.code,
  );
  // Settings blocks were written by the smoke "settings" step: adding them
  // exercises the confirm-email payment path end to end (unit tests assert
  // the body composition).
  await prisma.packageBooking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED" },
  });
  const paid = await api("POST", `/admin/bookings/${booking.id}/paid`);
  check(
    "mark paid records paidAt once",
    (paid.status === 200 || paid.status === 201) && Boolean(paid.json?.booking?.paidAt),
    paid.json?.booking?.paidAt,
  );
  const paidAgain = await api("POST", `/admin/bookings/${booking.id}/paid`);
  check(
    "second mark paid 409 BOOKING_ALREADY_PAID",
    paidAgain.status === 409 && paidAgain.json?.error?.code === "BOOKING_ALREADY_PAID",
    paidAgain.json?.error?.code,
  );
  const paidNotifs = await prisma.notification.count({
    where: { userId: user.id, type: "PACKAGE_BOOKING_PAID" },
  });
  check("mark paid queued its notification", paidNotifs >= 1);

  // 9. The SSR transport page serves the smoke listing.
  const page = await fetch(`${WEB}/transport`);
  const html = await page.text();
  check(
    "/transport SSR page lists the smoke service",
    page.status === 200 && html.includes("Smoke transfer D43"),
  );

  // 10. Traveler bookkeeping shape: paidAt rides on /bookings/me now.
  const myBookings = await api("GET", "/bookings/me");
  const smokeBooking = myBookings.json?.items?.find((b) => b.code === "PB-SMOKED43");
  check(
    "traveler bookings expose paidAt",
    smokeBooking?.paidAt !== undefined && smokeBooking?.paidAt !== null,
    smokeBooking?.paidAt,
  );

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
} finally {
  await prisma.$disconnect();
}
