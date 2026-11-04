/**
 * D45 live flow (run with the API dev server on :4000 and the web dev server
 * on :3000): exercises managed uploads end to end with a throwaway user.
 *
 * Steps: public gallery reachable -> anonymous upload 401 -> traveler
 * register/login -> traveler upload 403 -> promote to ADMIN (DB) -> admin
 * upload of a real 1x1 PNG -> anonymous GET of the answered /api/uploads/...
 * path (content type + immutable cache + byte-exact) -> unknown key 404 ->
 * traversal-encoded key 404 -> .txt 409/400 type rejection -> empty file ->
 * >5 MB rejection (multer LIMIT_FILE_SIZE) -> gallery row from the uploaded
 * URL -> visible on the public list -> external https URL still accepted
 * (draft) -> javascript: URL rejected by the schema -> UPLOAD_STORED audit ->
 * SSR /gallery page serves the first-party path -> admin delete keeps the
 * file and the URL keeps serving (documented delete semantics).
 *
 * Unlike D43 there is no seed/settings step. Cleanup afterwards:
 * node scripts/d45-smoke.mjs clean. Prints one line per check.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
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
const marker = "smoketest-d45";
const galleryTitle = "Smoke D45 (throwaway)";
const password = "Sm0ke-D45-Password!";
const email = `${marker}-${Date.now()}@example.com`;
let cookie = "";
let failures = 0;

/** The classic 1x1 transparent PNG (67 bytes). */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` - ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

/** Multipart variant (D45): never sets content-type; fetch attaches the boundary. */
async function apiUpload(file, type) {
  const form = new FormData();
  const blob = new Blob([file], { type });
  form.append("file", blob, "smoke.png");
  const res = await fetch(`${API}/admin/uploads`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function anonymousGet(url) {
  // Fresh fetch without the cookie jar: serving never depends on a session.
  // upload.url is a root-relative path ("/api/uploads/..."), so it must be
  // resolved against the API ORIGIN, not concatenated onto the /api base.
  const res = await fetch(new URL(url, API.replace(/\/api$/, "")));
  const contentType = res.headers.get("content-type") ?? "";
  const cacheControl = res.headers.get("cache-control") ?? "";
  const bytes = res.status === 200 ? Buffer.from(await res.arrayBuffer()) : null;
  return { status: res.status, contentType, cacheControl, bytes };
}

try {
  // 0. Public gallery API reachable and anonymous.
  const list0 = await api("GET", "/gallery");
  check("public gallery API 200", list0.status === 200, `items=${list0.json?.items?.length}`);

  // 1. Anonymous multipart upload -> 401.
  const anon = await apiUpload(PNG_BYTES, "image/png");
  check("anonymous upload 401", anon.status === 401, anon.json?.error?.code);

  // 2. Traveler session.
  const reg = await api("POST", "/auth/register", { email, password, name: "Smoke D45" });
  check("traveler register ok", reg.status === 200 || reg.status === 201, reg.json?.user?.email);
  cookie = "";
  const login = await api("POST", "/auth/login", { email, password });
  check("traveler login ok", login.status === 200, login.json?.user?.id);

  // 3. Without an ADMIN membership the upload route is forbidden.
  const forbidden = await apiUpload(PNG_BYTES, "image/png");
  check("non-admin upload 403", forbidden.status === 403, forbidden.json?.error?.code);

  // 4. Promote the smoke user to ADMIN (throwaway) and refresh the session.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("smoke user missing");
  await prisma.roleMembership.create({ data: { userId: user.id, role: "ADMIN" } });
  cookie = "";
  await api("POST", "/auth/login", { email, password });
  const me = await api("GET", "/auth/me");
  check("session reflects the ADMIN role after promotion", me.json?.user?.roles?.includes("ADMIN") === true);

  // 5. The real upload: 1x1 PNG under the wire.
  const stored = await apiUpload(PNG_BYTES, "image/png");
  check(
    "admin multipart upload 201 (200/201 family)",
    stored.status === 200 || stored.status === 201,
    stored.json?.error?.code ?? `status ${stored.status}`,
  );
  const upload = stored.json?.upload;
  check(
    "minted key shape gallery/<24hex>.png",
    /^gallery\/[0-9a-f]{24}\.png$/.test(upload?.key ?? ""),
    upload?.key,
  );
  check(
    "answered URL is the first-party /api/uploads path",
    upload?.url === `/api/uploads/${upload?.key}`,
    upload?.url,
  );
  check("metadata echoes bytes and mime", upload?.size === PNG_BYTES.length && upload?.mimeType === "image/png");

  // 6. Anonymous serving: bytes, derived content type, immutable cache.
  const served = await anonymousGet(upload.url);
  check("public serving 200", served.status === 200);
  check("content type derived from the key (image/png)", served.contentType === "image/png", served.contentType);
  check(
    "immutable cache header",
    served.cacheControl === "public, max-age=31536000, immutable",
    served.cacheControl,
  );
  check("served bytes are byte-exact", served.bytes?.equals(PNG_BYTES) === true, served.bytes?.length);

  // 7. Unknown key 404s (message comes from our route, not Nest's default).
  const missing = await anonymousGet(`/api/uploads/gallery/${"0".repeat(24)}.png`);
  check("unknown key 404", missing.status === 404, missing.status);

  // 8. Traversal-encoded keys are just misses - no read, no leak.
  const traversal = await anonymousGet("/api/uploads/..%2F..%2Fpackage.json");
  check("traversal-encoded key rejected as a miss", traversal.status === 404, traversal.status);

  // 9. Non-image type refused before the storage layer.
  const texty = await apiUpload(Buffer.from("plain text, not an image"), "text/plain");
  check(
    "text/plain upload 400 UNSUPPORTED_FILE_TYPE",
    texty.status === 400 && texty.json?.error?.code === "UNSUPPORTED_FILE_TYPE",
    texty.json?.error?.code,
  );

  // 10. Empty file refused.
  const empty = await apiUpload(Buffer.alloc(0), "image/png");
  check("empty file 400 FILE_EMPTY", empty.status === 400 && empty.json?.error?.code === "FILE_EMPTY", empty.json?.error?.code);

  // 11. Over 5 MB -> multer's LIMIT_FILE_SIZE rejection.
  const big = await apiUpload(Buffer.alloc(6 * 1024 * 1024, 0), "image/png");
  check(
    "oversize upload refused (400/413)",
    big.status === 400 || big.status === 413,
    `${big.status} ${big.json?.error?.code ?? "(no body)"}`,
  );

  // 12. The uploaded URL becomes a first-party gallery row.
  const created = await api("POST", "/admin/gallery", {
    title: galleryTitle,
    imageUrl: upload.url,
    caption: "Uploaded by the D45 smoke.",
    published: true,
  });
  check(
    "gallery row accepts the uploaded path",
    created.status === 200 || created.status === 201,
    created.json?.error?.message,
  );
  const itemId = created.json?.item?.id;
  check("row carries the URL verbatim", created.json?.item?.imageUrl === upload.url);

  // 13. It is visible on the public gallery list.
  const publicList = await api("GET", "/gallery");
  check(
    "public gallery lists the uploaded photo",
    publicList.json?.items?.some((i) => i.id === itemId) === true,
    `items=${publicList.json?.items?.length}`,
  );

  // 14. Backward compatibility: plain https URLs stay valid (draft row).
  const external = await api("POST", "/admin/gallery", {
    title: galleryTitle,
    imageUrl: "https://picsum.photos/seed/smoke-d45/800/600",
    published: false,
  });
  check(
    "external https URL still accepted (draft)",
    external.status === 200 || external.status === 201,
    external.json?.error?.message,
  );
  const externalId = external.json?.item?.id;
  const afterExternal = await api("GET", "/gallery");
  check(
    "draft external photo stays off the public list",
    afterExternal.json?.items?.some((i) => i.id === externalId) !== true,
  );

  // 15. The schema refuses non-https, non-upload URLs.
  const bad = await api("POST", "/admin/gallery", {
    title: galleryTitle,
    imageUrl: "javascript:alert(1)",
  });
  check("javascript: URL rejected 400", bad.status === 400, bad.json?.error?.code);

  // 16. The upload was audited against the minted key.
  const audit = await prisma.auditLog.findFirst({
    where: { actorUserId: user.id, action: "UPLOAD_STORED", entityId: upload.key },
  });
  check(
    "UPLOAD_STORED audit references the key and url",
    Boolean(audit) && audit.meta?.url === upload.url && audit.meta?.scope === "gallery",
  );

  // 17. SSR /gallery serves the first-party path (ISR may lag a moment on a
  //     warm cache - retry briefly).
  let ssr = { ok: false, status: 0 };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const page = await fetch(`${WEB}/gallery`);
    const html = await page.text();
    ssr = { ok: page.status === 200 && html.includes(upload.key), status: page.status };
    if (ssr.ok) break;
    await new Promise((r) => setTimeout(r, 12_000));
  }
  check("SSR /gallery page serves the uploaded path", ssr.ok, `status=${ssr.status}`);

  // 18. Deleting the row keeps the file serving (documented semantics: the
  //     URL may be referenced elsewhere; no dangling image on live pages).
  const removed = await api("DELETE", `/admin/gallery/${itemId}`);
  check("admin delete 200", removed.status === 200, removed.json?.message);
  const afterRemoval = await api("GET", "/gallery");
  check("deleted row leaves the public list", afterRemoval.json?.items?.some((i) => i.id === itemId) !== true);
  const stillServed = await anonymousGet(upload.url);
  check("file keeps serving after the row is gone", stillServed.status === 200);

  // 19. And the file really is on local disk behind the driver.
  const abs = path.join(root, "apps", "api", "uploads", upload.key);
  const onDisk = existsSync(abs) && statSync(abs).size === PNG_BYTES.length;
  check("object exists in the local upload root", onDisk, abs);

  // Park the throwaway IDs for d45-smoke clean (marker-titled rows + audits
  // by the smoke user cover everything created here).
  console.log(`smoke gallery rows to clean: ${[itemId, externalId].filter(Boolean).join(", ")}`);
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
} finally {
  await prisma.$disconnect();
}
