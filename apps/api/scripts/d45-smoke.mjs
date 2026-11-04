/**
 * D45 smoke helper (run from apps/api so the generated client resolves).
 *
 * Strictly scoped to throwaway rows + uploaded files:
 *  1. clean - deletes gallery items titled "Smoke D45 (throwaway)", the smoke
 *             users (email starts with the marker), their notifications and
 *             audit rows, and unlinks every uploaded file recorded in those
 *             audit rows (meta.url -> key -> apps/api/uploads/<key>). Files
 *             referenced by audit rows of real admins are never touched.
 *             Verifies the baseline after.
 *  2. state (default) - reports how much throwaway graph is still around,
 *             including any leftover files in the uploads directory.
 *
 * Unlike D43 there is no seed/settings step: uploads need no settings row and
 * no provider rows - the live flow registers its own throwaway user.
 *
 * Usage: node scripts/d45-smoke.mjs clean|state
 * Reads the DIRECT Neon DATABASE_URL from packages/database/.env.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const envText = readFileSync(path.join(root, "packages", "database", ".env"), "utf8");

function envValue(name) {
  const line = envText
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  if (!line) return "";
  // Same discipline as the D38..D43 smoke scripts: trim + strip quotes.
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

const mode = process.argv[2] ?? "state";
const marker = "smoketest-d45";
const galleryTitleMarker = "Smoke D45 (throwaway)";
const uploadsDir = path.join(root, "apps", "api", "uploads");

function listStoredFiles() {
  if (!existsSync(uploadsDir)) return [];
  const out = [];
  const walker = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walker(abs, relPath);
      else out.push(`${relPath} (${statSync(abs).size}b)`);
    }
  };
  walker(uploadsDir, "");
  return out;
}

try {
  if (mode === "clean") {
    const users = await prisma.user.findMany({ where: { email: { startsWith: marker } } });
    const userIds = users.map((u) => u.id);

    // 0. Map uploaded files back via the smoke users' UPLOAD_STORED audits
    //    (meta.url is the first-party /api/uploads/<key> path) BEFORE the
    //    audit rows go, so interrupted runs still reclaim their files.
    const audits = userIds.length
      ? await prisma.auditLog.findMany({
          where: { actorUserId: { in: userIds }, action: "UPLOAD_STORED" },
          select: { id: true, meta: true },
        })
      : [];
    const keys = [];
    for (const audit of audits) {
      const url = audit.meta?.url;
      if (typeof url === "string" && url.startsWith("/api/uploads/")) {
        keys.push(url.slice("/api/uploads/".length));
      }
    }
    // 1. Uploaded files on disk (only ones our smoke actors minted).
    let filesRemoved = 0;
    for (const key of keys) {
      const abs = path.join(uploadsDir, key);
      try {
        unlinkSync(abs);
        filesRemoved += 1;
      } catch {
        /* already gone */
      }
    }
    console.log(`uploaded files removed: ${filesRemoved}`);

    // 2. Audit rows of the smoke actors (never audits of real admins).
    const removedAudit = userIds.length
      ? await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } })
      : { count: 0 };
    console.log(`audit rows removed: ${removedAudit.count}`);

    // 3. Gallery rows by their throwaway title marker.
    const removedGallery = await prisma.galleryItem.deleteMany({
      where: { title: galleryTitleMarker },
    });
    console.log(`gallery items removed: ${removedGallery.count}`);

    const notifs = userIds.length
      ? await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      : { count: 0 };
    console.log(`notifications removed: ${notifs.count}`);

    // 4. Smoke users (sessions + memberships cascade).
    const deletedUsers = userIds.length
      ? await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      : { count: 0 };
    console.log(`smoke users removed: ${deletedUsers.count}`);

    // 5. Baseline: everything throwaway is gone. (Audit rows deleted above
    //    are already counted; after user deletion their actor is unqueryable.)
    console.log(
      `baseline: users=${await prisma.user.count({ where: { email: { startsWith: marker } } })} gallery=${
        await prisma.galleryItem.count({ where: { title: galleryTitleMarker } })
      }`,
    );
    const leftovers = listStoredFiles();
    console.log(
      leftovers.length
        ? `uploads dir still has: ${leftovers.join(", ")}`
        : "uploads dir empty or absent",
    );
  } else {
    const users = await prisma.user.count({ where: { email: { startsWith: marker } } });
    const gallery = await prisma.galleryItem.count({ where: { title: galleryTitleMarker } });
    console.log(`state: users=${users} gallery=${gallery}`);
    const leftovers = listStoredFiles();
    console.log(
      leftovers.length
        ? `uploads dir has: ${leftovers.join(", ")}`
        : "uploads dir empty or absent",
    );
  }
} finally {
  await prisma.$disconnect();
}
