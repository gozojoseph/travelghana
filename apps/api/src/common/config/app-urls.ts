/**
 * Web-app URL configuration. WEB_APP_URL may hold a comma-separated list of
 * allowed browser origins (e.g. localhost + LAN IP during development). The
 * FIRST entry is the canonical base used for email links; the full list feeds
 * the CORS allowlist in main.ts.
 */
export function webAppUrls(): string[] {
  const raw = process.env.WEB_APP_URL ?? "http://localhost:3000";
  const urls = raw
    .split(",")
    .map((u) => u.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return urls.length > 0 ? urls : ["http://localhost:3000"];
}

export function primaryWebAppUrl(): string {
  return webAppUrls()[0]!;
}

/**
 * Origins of the standalone admin console site (D21). ADMIN_APP_URL parses
 * exactly like WEB_APP_URL: a comma-separated list (e.g. the production
 * subdomain plus the local `dev:admin` instance), so one API deployment
 * serves the main app, LAN testers and the console at once.
 */
export function adminAppUrls(): string[] {
  const raw = process.env.ADMIN_APP_URL ?? "http://localhost:3001";
  const urls = raw
    .split(",")
    .map((u) => u.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return urls.length > 0 ? urls : ["http://localhost:3001"];
}
