# Progress Log

## 2026-10-02
- **ERD approved** (v0.2 — 42 models / 24 enums, Prisma schema validates). D3 (multi-role)
  and D5 (operator-first) confirmed by product owner.
- Phase 0 complete: docs, decisions, architecture, ERD, monorepo scaffold, seed.
- **Build increment started: Auth / Users / RBAC** (per ARCHITECTURE.md sequence step 3).
  Scope: register/login/logout/session, email verification, password reset, role guards,
  admin bootstrap, rate limiting; web /login + /register.
- **Auth / Users / RBAC increment COMPLETE.** API: global session guard + RBAC
  (@Public/@Roles), scrypt password hashing, opaque hashed session tokens in httpOnly
  cookies, email verification + password reset flows (no account enumeration), rate
  limiting, admin bootstrap via env, unified error contract, zod shared-validation pipe.
  Web: /login, /register, /forgot-password, /reset-password, /verify-email, /account
  (session-aware). Verified: api typecheck ✓ · web typecheck ✓ · 16 unit tests ✓.
  Prisma client moved to project-relative generated output (pnpm-safe).
  Next increment: destinations + explore (Mapbox behind MapsAdapter).

## 2026-10-03
- **Destinations + explore increment COMPLETE & verified.** API: /api/destinations
  (filters q/city/region/category/featured + pagination), /:slug, /regions, /cities;
  MapsAdapter (Mapbox static images + NullMapAdapter fallback, D4). Web: /explore
  (filters + Mapbox GL w/ OSM fallback), /destinations, /destinations/[slug] (SEO metadata
  + JSON-LD), top nav + mobile bottom nav (§35), sitemap/robots. Schema: Destination and
  Attraction slug globally unique. Seed: 16 regions, 19 cities, 20 destinations, 5 attractions.
  Verified live: /explore renders seeded destinations; /destinations/cape-coast-castle → 200
  with JSON-LD; API returns seeded data.
- **Integration tests: 6/6 PASS** (`pnpm --filter @travelghana/api test:int`) — full
  register → session cookie → mailer link → verify → single-use replay (400) → login → /me
  → logout, plus duplicate-email 409 and wrong-password 401. Root cause of earlier 500s:
  Vitest's esbuild transform doesn't emit `design:paramtypes`, so Nest DI broke; fixed by
  routing both vitest configs through SWC (`vitest.shared.ts` + `.swcrc`, decoratorMetadata).
  Unit tests 16/16 still green; api + web typecheck clean.
- **Auth flow walked end-to-end against live stack** (embedded Postgres :5432, API :4000,
  web :3000): register → 201 + tg_session cookie → ConsoleMailer verification link in API
  console → verify → replay rejected → logout → 401 → login → /me with emailVerified true.
- D10 documented: embedded Postgres replaces Docker locally (WSL unavailable on this machine).
- **Operator onboarding + listings increment COMPLETE & verified** (D5, D11). API
  `/api/operator`: POST /providers (self-onboarding, grants RBAC role by type, 409
  PROVIDER_EXISTS on second), GET/PATCH /me/provider; tours + experiences CRUD under
  /me/tours and /me/experiences with slug generation, publish flag, ownership scoping
  (foreign id → 404, no existence oracle), city validation, zod shared schemas (integer
  minor units, D8). New `AnyRole` decorator (any-of RBAC) alongside all-of `@Roles`;
  guard updated. Web: /operator dashboard (onboard form → provider card + listing
  overview), /operator/tours + /new + /[id] (edit), same for experiences; publish toggle,
  delete, "For operators" nav link. Tests: 29 unit ✓ (13 new operator service tests),
  13 integration ✓ (7 new Postgres-backed: RBAC 403 before onboarding, onboarding → role,
  tour CRUD + publish, ownership). Verified live: register → 403 → onboard → create +
  publish tour → patch price → list → /me shows TRAVELER+TOUR_OPERATOR; all operator web
  pages 200. api + web typecheck ✓.
  Open question #11 raised: should publishing require admin verification?
- **Reusable reusable listings (D11) complete & verified.** API GET/POST/PATCH/DELETE /listings/me, GET /me/:id, PATCH /me/:id/status (provider DRAFT→PENDING_REVIEW only), GET /admin, PATCH /admin/:id/review (APPROVE→PUBLISHED, REJECT→DRAFT, SUSPEND→PAUSED). Schema D8 integer minor units + GHS default; ListingStatus DRAFT|PENDING_REVIEW|PUBLISHED|PAUSED|ARCHIVED; city/region names resolved via separate findMany lookups (no inverse relation in generated client). Tests: 34 unit ✓; integration blocked on external Postgres (no server). Web: /operator/listings (filter), /new (create), /[id] (edit), reusable listing-form component. api + web typecheck ✓.
  Open question #12 raised: admin-moderation gating — provider should not self-publish listings (suggested gate: DRAFT→PENDING_REVIEW then admin-only PUBLISHED/PAUSED); currently provider can self-publish via published: true.
- **Fixes from browser testing:** (1) CORS blocked the LAN origin — `WEB_APP_URL` now
  accepts a comma-separated origin list (first entry = email-link base; shared helper
  `common/config/app-urls.ts`), API restarted with `http://10.44.196.95:3000` added;
  verified allowed/allowed-reflected/blocked cases via curl. (2) favicon 404 — added
  `apps/web/src/app/icon.svg` (Next app-icon convention), now served and linked.
