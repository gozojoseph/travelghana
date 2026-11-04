/**
 * D40 smoke helper (run from apps/api so the generated client resolves).
 *
 * Two jobs, strictly scoped to throwaway "smoketest-d40" rows:
 *  1. seed - injects ONE Notification row (channel EMAIL, type
 *     PACKAGE_BOOKING_CONFIRMED) for the smoke user, shaped exactly like the
 *     rows the D36 booking service writes. The real writers are already
 *     unit-verified; this exercises the NEW inbox endpoints.
 *  2. clean - verifies production is back to baseline afterwards.
 *
 * Usage: node scripts/d40-smoke.mjs seed|clean
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
  // Same discipline as the D38 smoke scripts: regex + Trim + strip quotes.
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
const marker = "smoketest-d40";

try {
  if (mode === "seed") {
    const user = await prisma.user.findFirst({ where: { email: { startsWith: marker } } });
    if (!user) throw new Error("smoke user missing");
    const id = `d40smoke${Math.random().toString(36).slice(2, 10)}`;
    await prisma.notification.create({
      data: {
        id,
        userId: user.id,
        channel: "EMAIL",
        type: "PACKAGE_BOOKING_CONFIRMED",
        payload: { code: "TB-SMOKED40", packageId: "seed" },
        status: "SENT",
      },
    });
    console.log(`seeded notification ${id} for ${user.email}`);
  } else if (mode === "clean") {
    const users = await prisma.user.findMany({ where: { email: { startsWith: marker } } });
    await prisma.notification.deleteMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    const deletedUsers = await prisma.user.deleteMany({
      where: { email: { startsWith: marker } },
    });
    const left = await prisma.notification.count({
      where: { user: { email: { startsWith: marker } } },
    });
    console.log(
      `clean: removed ${deletedUsers.count} smoke user(s), notification rows left: ${left}`,
    );
  } else {
    // Baseline read for either mode.
    const users = await prisma.user.findMany({ where: { email: { startsWith: marker } } });
    const notifs = await prisma.notification.count({
      where: { user: { email: { startsWith: marker } } },
    });
    console.log(`state: users=${users.length} notifications=${notifs}`);
  }
} finally {
  await prisma.$disconnect();
}
