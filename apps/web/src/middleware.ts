import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-aware routing for the separate admin console site (D21).
 *
 * Feature-flagged by ADMIN_HOST: when set (e.g. "admin.travelghana.com" in
 * production, or "admin.localhost:3001" for a local second server), ONE build
 * serves two sites:
 *
 *   main host    -> the public site; /admin* redirects (308) to the admin host
 *   admin host   -> /admin* ranges, the auth pages and the assets those pages
 *                   need; every other path is funnelled to /admin, and every
 *                   response is marked noindex
 *
 * Without ADMIN_HOST the middleware is a no-op, so local single-origin dev
 * behaves exactly as before. Note this is presentation routing only - the
 * security boundary stays the API, where every admin request is authorized
 * with @AnyRole(Role.ADMIN). A visitor reaching /admin on any host without an
 * ADMIN session simply gets 401s from the API.
 */

/** Auth pages an admin-site visitor may still open (the admin gate links here). */
const AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

/** Static asset prefixes/exact paths the above pages depend on at runtime. */
const ASSET_PREFIXES = ["/_next", "/icons"];
const ASSET_PATHS = new Set([
  "/manifest.webmanifest",
  "/icon.png",
  "/apple-icon.png",
  "/robots.txt",
  "/hero-sky.svg",
  "/Travel Ghana Logo.png",
  "/Travel%20Ghana%20Logo.png",
]);

/** ADMIN_HOST may carry a scheme and/or a port for local runs; both tolerated. */
function readAdminHost(): string | null {
  const raw = (process.env.ADMIN_HOST ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return raw || null;
}

function adminHostName(host: string): string {
  return host.split(":")[0]!.toLowerCase();
}

/** Origins with an explicit port are local/test instances served over http;
 * bare DNS hostnames are production and need https. */
function adminOrigin(adminHost: string): string {
  const scheme = /:\d+/.test(adminHost) ? "http" : "https";
  return `${scheme}://${adminHost}`;
}

function isAllowedOnAdminSite(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    AUTH_PAGES.has(pathname) ||
    ASSET_PATHS.has(pathname) ||
    ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function middleware(request: NextRequest): NextResponse {
  const adminHost = readAdminHost();
  if (!adminHost) return NextResponse.next();

  const requestHost = (request.headers.get("host") ?? "").toLowerCase();
  const onAdminSite =
    requestHost.length > 0 &&
    adminHostName(requestHost) === adminHostName(adminHost);

  if (onAdminSite) {
    // Some runtimes hand middleware the encoded path (the logo URL carries a
    // space), others the decoded one - allow-list matches both.
    const raw = request.nextUrl.pathname;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // Malformed escape - the raw check below still applies.
    }
    if (!isAllowedOnAdminSite(raw) && !isAllowedOnAdminSite(decoded)) {
      // Old branded links and stray paths funnel to the console.
      return NextResponse.redirect(new URL("/admin", adminOrigin(adminHost)), 307);
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/")
  ) {
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      adminOrigin(adminHost),
    );
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
