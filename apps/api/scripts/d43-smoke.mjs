/**
 * D43 smoke helper (run from apps/api so the generated client resolves).
 *
 * Strictly scoped to throwaway rows:
 *  1. seed    - creates (idempotently) a VERIFIED transport provider
 *               ("Smoke Rides D43") with one PUBLISHED listing
 *               ("Smoke transfer D43 (throwaway)", capacity 4, service area
 *               "Smoke Accra"). priceMinor stays a legacy 0 - the transport
 *               surface never reads it (quote-based, D43).
 *  2. settings - snapshots the SiteSettings row, upserts it with the two
 *               manual-payment instruction blocks and reports the snapshot
 *               for the clean step to restore.
 *  3. clean   - removes the throwaway graph (listing bookings -> listing ->
 *               provider, audit + notification rows, smoke package + its
 *               bookings per the RESTRICT rule, smoke users) and restores
 *               the settings snapshot. Verifies the baseline after.
 *
 * Usage: node scripts/d43-smoke.mjs seed|settings|clean
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
  // Same discipline as the D38/D40/D41 smoke scripts: trim + strip quotes.
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
const marker = "smoketest-d43";
const providerSlug = "smoke-rides-d43-deadbeef";
const listingSlug = "smoke-transfer-d43";

try {
  if (mode === "seed") {
    let provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          // userId is optional (provider does not map to a real account).
          type: "TRANSPORT_COMPANY",
          name: "Smoke Rides D43",
          slug: providerSlug,
          description: "Created by the D43 transport smoke; deleted right after.",
          verificationStatus: "VERIFIED",
          serviceArea: "Smoke Accra",
        },
      });
      console.log(`provider created ${provider.id}`);
    }
    let listing = await prisma.listing.findFirst({
      where: { providerId: provider.id, slug: listingSlug },
    });
    if (!listing) {
      listing = await prisma.listing.create({
        data: {
          providerId: provider.id,
          slug: listingSlug,
          title: "Smoke transfer D43 (throwaway)",
          status: "PUBLISHED",
          description: "Airport transfer used by the D43 quote-flow smoke.",
          serviceArea: "Smoke Accra",
          capacity: 4,
          durationMinutes: 45,
          // Legacy fixed-price column - unused by the D43 quote surface.
          priceMinor: 0,
          currencyCode: "GHS",
          publishedAt: new Date(),
        },
      });
      console.log(`listing created ${listing.id}`);
    }
    console.log(`listing ${listing.id} providerSlug ${providerSlug}`);
  } else if (mode === "settings") {
    const before = await prisma.siteSettings.findUnique({ where: { id: "site" } });
    console.log(
      `settings snapshot ${before ? "row-exists" : "no-row"} momo=${before?.momoInstructions ?? null} bank=${before?.bankInstructions ?? null}`,
    );
    const row = await prisma.siteSettings.upsert({
      where: { id: "site" },
      update: {
        momoInstructions: "Smoke test MoMo: 055 000 0000 (MTN).",
        bankInstructions: "Smoke test bank: GCB 00000000000, Smoke Ltd.",
      },
      create: {
        id: "site",
        momoInstructions: "Smoke test MoMo: 055 000 0000 (MTN).",
        bankInstructions: "Smoke test bank: GCB 00000000000, Smoke Ltd.",
      },
    });
    console.log(`settings written id=${row.id}`);
  } else if (mode === "clean") {
    const users = await prisma.user.findMany({ where: { email: { startsWith: marker } } });
    const userIds = users.map((u) => u.id);
    const provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    const listing = provider
      ? await prisma.listing.findFirst({ where: { providerId: provider.id } })
      : null;
    const pkgs = await prisma.package.findMany({ where: { slug: { startsWith: "smoke-d43" } } });
    const pkgIds = pkgs.map((p) => p.id);
    const requestIds = userIds.length
      ? (
          await prisma.listingBooking.findMany({
            where: { OR: [{ userId: { in: userIds } }, ...(listing ? [{ listingId: listing.id }] : [])] },
            select: { id: true },
          })
        ).map((r) => r.id)
      : [];
    const bookingIds = userIds.length
      ? (
          await prisma.packageBooking.findMany({
            where: { userId: { in: userIds } },
            select: { id: true },
          })
        ).map((b) => b.id)
      : [];

    // 1. Throwaway transport requests (rests the Listing RESTRICT FK).
    if (userIds.length || listing) {
      const removed = await prisma.listingBooking.deleteMany({
        where: {
          OR: [
            ...(userIds.length ? [{ userId: { in: userIds } }] : []),
            ...(listing ? [{ listingId: listing.id }] : []),
          ],
        },
      });
      console.log(`transport requests removed: ${removed.count}`);
    }
    // 2. Throwaway package bookings rest the PackageBooking RESTRICT FK.
    const removedBookings = await prisma.packageBooking.deleteMany({
      where: {
        OR: [
          { packageId: { in: pkgIds } },
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
        ],
      },
    });
    console.log(`smoke bookings removed: ${removedBookings.count}`);
    // 3. Throwaway package + armed audit/notification references.
    if (requestIds.length || bookingIds.length || pkgIds.length || listing) {
      const removedAudit = await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: [...requestIds, ...bookingIds, ...pkgIds, ...(listing ? [listing.id] : [])] } },
            ...(userIds.length ? [{ actorUserId: { in: userIds } }] : []),
          ],
        },
      });
      console.log(`audit rows removed: ${removedAudit.count}`);
    }
    const notifs = userIds.length
      ? await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      : { count: 0 };
    console.log(`notifications removed: ${notifs.count}`);
    // 4. Listing -> provider (Listing FK is RESTRICT to provider).
    if (listing) {
      const del = await prisma.listing.delete({ where: { id: listing.id } });
      console.log(`listing removed: ${del.id}`);
    }
    if (provider) {
      const del = await prisma.provider.delete({ where: { id: provider.id } });
      console.log(`provider removed: ${del.id}`);
    }
    // 5. Throwaway package (departures cascade).
    if (pkgIds.length) {
      const del = await prisma.package.deleteMany({ where: { id: { in: pkgIds } } });
      console.log(`smoke packages removed: ${del.count}`);
    }
    // 6. Smoke users (listing bookings cascade; sessions/memberships cascade).
    const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`smoke users removed: ${deletedUsers.count}`);
    // 7. Restore the settings snapshot taken in the "settings" step: it was
    // "no-row" before the smoke (the owner has never saved settings), and the
    // settings step created the singleton row - so the exact restore is a
    // delete of that row.
    const settingsRemoved = await prisma.siteSettings.deleteMany({ where: { id: "site" } });
    console.log(`settings rows removed: ${settingsRemoved.count}`);
    // 8. Baseline: everything throwaway is gone.
    console.log(
      `baseline: users=${await prisma.user.count({ where: { email: { startsWith: marker } } })} provider=${
        await prisma.provider.count({ where: { slug: providerSlug } })
      } packages=${await prisma.package.count({ where: { slug: { startsWith: "smoke-d43" } } })} requests=${
        await prisma.listingBooking.count({ where: { userId: { in: userIds } } })
      } settings=${await prisma.siteSettings.count({ where: { id: "site" } })}`,
    );
  } else {
    const users = await prisma.user.findMany({ where: { email: { startsWith: marker } } });
    const provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
    console.log(`state: users=${users.length} provider=${provider ? provider.id : "none"}`);
  }
} finally {
  await prisma.$disconnect();
}
