/**
 * Public-site URL helper (D21).
 *
 * On the standalone admin site, shared chrome (header, footer, the console
 * bar's "Back to site") must not link to paths the admin-site middleware
 * funnels back to /admin. When NEXT_PUBLIC_WEB_APP_URL is configured those
 * links become absolute main-site URLs; in single-origin setups the value is
 * empty and paths stay relative, exactly as before.
 */
export function siteLink(path: string): string {
  const base = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
