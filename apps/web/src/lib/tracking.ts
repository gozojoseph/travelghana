/**
 * First-party clickstream recorder (D37) - no third-party analytics service.
 * The browser posts tiny batches to our own /api/track. Privacy by design:
 * - paths never carry query strings (the URL search is dropped client-side);
 * - referrers are recorded as origins only, and only on the first event of a
 *   page load (so internal navigations never masquerade as sources);
 * - bots, the admin console and signed-in admins browsing /admin are skipped
 *   at the source - nothing leaves the browser.
 * Session semantics: a "session" id renews after 30 idle minutes; the visitor
 * id persists in localStorage until storage is cleared (documented limit).
 */

import { API_URL } from "@/lib/api";

export const TRACK_URL = `${API_URL}/track`;

const VISITOR_KEY = "tg_vid";
const SESSION_KEY = "tg_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 1200;
const MAX_BATCH = 20; // mirrors trackEventBatchSchema cap

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|curl|wget|python|java\/|httpclient|preview/i;

type DeviceKind = "phone" | "tablet" | "desktop" | "other";

type TrackedEvent = {
  sessionId: string;
  visitorId: string;
  path: string;
  referrer: string | null;
  device: DeviceKind;
  kind: "view" | "action";
  name?: string;
  meta?: Record<string, string>;
};

let queue: TrackedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let hideBound = false;
let referrerCaptured = false;
let lastSentKey = "";
let lastSentAt = 0;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode / storage disabled: ephemeral ids still count
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the visit still gets session-scoped ids
  }
}

function resolveVisitorId(): string {
  let id = readStorage(VISITOR_KEY);
  if (!id || id.length < 8) {
    id = newId();
    writeStorage(VISITOR_KEY, id);
  }
  return id;
}

function resolveSessionId(): string {
  const now = Date.now();
  let current: { id: string; at: number } | null = null;
  const raw = readStorage(SESSION_KEY);
  if (raw) {
    try {
      const parsed = (JSON.parse(raw) as { id?: unknown; at?: unknown });
      if (typeof parsed.id === "string" && typeof parsed.at === "number") {
        current = { id: parsed.id, at: parsed.at };
      }
    } catch {
      current = null;
    }
  }
  if (!current || now - current.at > SESSION_IDLE_MS || current.id.length < 8) {
    current = { id: newId(), at: now }; // 30 idle minutes -> a fresh session
  } else {
    current = { ...current, at: now };
  }
  writeStorage(SESSION_KEY, JSON.stringify(current));
  return current.id;
}

function classifyDevice(ua: string): DeviceKind {
  if (/iphone|ipod/i.test(ua)) return "phone";
  if (/ipad/i.test(ua)) return "tablet";
  if (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)) return "tablet"; // iPadOS Mac UA
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "phone" : "tablet";
  if (/tablet|playbook|silk|kindle/i.test(ua)) return "tablet";
  if (ua.trim() === "") return "other";
  return "desktop";
}

function normalizePath(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.slice(0, 300) || "/";
}

/** True when nothing should be recorded for this path at all. */
function skipChecks(path: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  if (BOT_PATTERN.test(window.navigator.userAgent)) return true;
  if (window.navigator.webdriver === true) return true;
  if (path.startsWith("/admin")) return true;
  return false;
}

/** External origin only (privacy: full URLs never cross the wire). */
function referrerOrigin(): string | null {
  const raw = document.referrer;
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    if (!origin || origin === "null" || origin === window.location.origin) return null;
    return origin;
  } catch {
    return null;
  }
}

function flush(useBeacon: boolean): void {
  if (queue.length === 0) return;
  const events = queue.splice(0, MAX_BATCH);
  const payload = JSON.stringify({ events });
  try {
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: "application/json" }));
      if (queue.length === 0) return;
    }
  } catch {
    // beacon unavailable -> fall through to fetch (e.g. queued > 64 KB)
  }
  void fetch(TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "include",
  }).catch(() => undefined); // analytics must never surface errors
}

function schedule(): void {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    flush(false);
  }, FLUSH_DELAY_MS);
}

function bindHideFlush(): void {
  if (hideBound) return;
  hideBound = true;
  window.addEventListener(
    "pagehide",
    () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      flush(true); // sendBeacon so closing the tab does not lose the queue
    },
    { capture: true },
  );
}

function emit(arg: {
  path: string;
  kind: "view" | "action";
  name?: string;
  meta?: Record<string, string>;
}): void {
  const now = Date.now();
  // Same navigation firing twice (HMR / double effects) within 1.5 s -> one row.
  const key = `${arg.kind}:${arg.name ?? ""}:${arg.path}`;
  if (key === lastSentKey && now - lastSentAt < 1500) return;
  lastSentKey = key;
  lastSentAt = now;

  const event: TrackedEvent = {
    sessionId: resolveSessionId(),
    visitorId: resolveVisitorId(),
    path: arg.path,
    referrer: referrerCaptured ? null : referrerOrigin(),
    device: classifyDevice(navigator.userAgent),
    kind: arg.kind,
    ...(arg.name !== undefined ? { name: arg.name } : {}),
    ...(arg.meta !== undefined ? { meta: arg.meta } : {}),
  };
  referrerCaptured = true;
  bindHideFlush();
  queue.push(event);
  while (queue.length > 100) queue.shift(); // safety: drop the oldest entries
  schedule();
}

/** Records a page view for an SPA route change. */
export function trackView(pathname: string): void {
  const path = normalizePath(pathname);
  if (skipChecks(path)) return;
  emit({ path, kind: "view" });
}

/** Records a funnel milestone or other client action on the current path. */
export function trackEvent(name: string, meta?: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  const path = normalizePath(window.location.pathname);
  if (skipChecks(path)) return;
  const normalized = meta
    ? Object.fromEntries(
        Object.entries(meta)
          .slice(0, 8)
          .map(([key, value]) => [key, String(value)]),
      )
    : undefined;
  emit({ path, kind: "action", name, meta: normalized });
}

/** Test hook: clears module state between specs (not used by pages). */
export function __resetTrackingState(): void {
  queue = [];
  timer = null;
  referrerCaptured = false;
  lastSentKey = "";
  lastSentAt = 0;
}
