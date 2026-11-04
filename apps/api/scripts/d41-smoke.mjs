/**
 * D41 smoke helper (run from apps/api so the generated client resolves).
 *
 * Three jobs, strictly scoped to throwaway rows:
 *  1. seed  - creates the PUBLISHED smoke package (title
 *             "Smoke journey D41 (throwaway)") with two departures:
 *             one future (+10 days, 4 seats), one past (-3 days).
 *  2. confirm - flips the smoke user's booking on the package to CONFIRMED,
 *             standing in for the (unit-tested) admin decide() path, so the
 *             review endpoints can be exercised end to end.
 *  3. clean - removes the whole throwaway graph (package cascades its
 *             departures, bookings and reviews; audits, sessions and the
 *             smoke user last) and verifies the baseline.
 *
 * Usage: node scripts/d41-smoke.mjs seed|confirm|clean
 * Reads the DIRECT Neon DATABASE_URL from packages/database/.env.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const envText = readFileSync(path.join(root, "packages", "database", ".env"), "utf8");

function envValue(name) {
  const line = envText
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  if (!line) return "";
  // Same discipline as the D38/D40 smoke scripts: regex + Trim + strip quotes.
  return line
    .split("=")
    .slice(1)
    .join("=")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

const require = createRequire(path.join(root, "apps", "api", "package.json"));
const { PrismaClient } = require("@travelghana/database");

const prisma = new PrismaClient({
  datasources: { db: { url: envValue("DATABASE_URL") } },
});

const mode = process.argv[2];
const userMarker = "smoketest-d41";
const slug = "travelghana-smoke-d41";

try {
  if (mode === "seed") {
    let pkg = await prisma.package.findUnique({ where: { slug } });
    if (!pkg) {
      pkg = await prisma.package.create({
        data: {
          slug,
          title: "Smoke journey D41 (throwaway)",
          summary: "Created by the D41 availability smoke; deleted right after.",
          durationDays: 3,
          durationNights: 2,
          priceMinor: 100000,
          currencyCode: "GHS",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    }
    const future = new Date();future.setUTCDate(future.getUTCDate() + 10);
    const past = new Date();past.setUTCDate(past.getUTCDate() - 3);
    future.setUTCHours(0, 0, 0, 0);
    past.setUTCHours(0, 0, 0, 0);
    for (const [date, seats] of [[future, 4], [past, 4]]) {
      const existing = await prisma.packageDeparture.findFirst({
        where: { packageId: pkg.id, date },
      });
      if (!existing) {
        const dep = await prisma.packageDeparture.create({
          data: { packageId: pkg.id, date, seats },
        });
        console.log(`seeded departure ${dep.id} ${date.toISOString().slice(0, 10)}=${seats}`);
      } else {
        console.log(`departure exists ${existing.id} ${date.toISOString().slice(0, 10)}`);
      }
    }
    console.log(`package ${pkg.id}`);
  } else if (mode === "confirm") {
    const user = await prisma.user.findFirst({ where: { email: { startsWith: userMarker } } });
    if (!user) throw new Error("smoke user missing - register+book first");
    const pkg = await prisma.package.findUnique({ where: { slug } });
    if (!pkg) throw new Error("smoke package missing");
    const booking = await prisma.packageBooking.findFirst({
      where: { userId: user.id, packageId: pkg.id },
    });
    if (!booking) throw new Error("smoke booking missing");
    const updated = await prisma.packageBooking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });
    console.log(`confirmed ${updated.code} for ${user.email}`);
  } else if (mode === "clean") {
    const users = await prisma.user.findMany({ where: { email: { startsWith: userMarker } } });
    const userIds = users.map((u) => u.id);
    const pkgs = await prisma.package.findMany({ where: { slug } });
    const pkgIds = pkgs.map((p) => p.id);

    // Audit rows: actor was the smoke user (request/review submissions) or
    // they reference the smoke entities.
    if (userIds.length || pkgIds.length) {
      const removed = await prisma.auditLog.deleteMany({
        where: {
          OR: [
            ...(userIds.length ? [{ actorUserId: { in: userIds } }] : []),
            ...(pkgIds.length ? [{ entityId: { in: pkgIds } }] : []),
          ],
        },
      });
      console.log(`audit rows removed: ${removed.count}`);
    }
    // Notifications and sessions for the smoke user.
    const notifs = await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    console.log(`notifications removed: ${notifs.count}`);
    // Bookings first: the pre-existing booking FK on Package is RESTRICT
    // (financial records must be deleted explicitly, D28). Reviews and
    // departures then cascade with the package.
    const removedBookings = await prisma.packageBooking.deleteMany({
      where: { packageId: { in: pkgIds } },
    });
    console.log(`smoke bookings removed: ${removedBookings.count}`);
    // Package deletion cascades departures and reviews (D41 schema).
    if (pkgIds.length) {
      const deletedPkg = await prisma.package.deleteMany({ where: { id: { in: pkgIds } } });
      console.log(`smoke packages removed: ${deletedPkg.count}`);
    }
    const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`smoke users removed: ${deletedUsers.count}`);

    const leftPkg = await prisma.package.count({ where: { slug } });
    const leftUsers = await prisma.user.count({ where: { email: { startsWith: userMarker } } });
    const leftReviews = await prisma.packageReview.count({
      where: { packageId: { in: pkgIds } },
    });
    console.log(`baseline: packages=${leftPkg} users=${leftUsers} reviews=${leftReviews}`);
  } else {
    const users = await prisma.user.findMany({ where: { email: { startsWith: userMarker } } });
    const pkgs = await prisma.package.findMany({ where: { slug } });
    console.log(`state: users=${users.length} packages=${pkgs.length}`);
  }
} finally {
  await prisma.$disconnect();
}
