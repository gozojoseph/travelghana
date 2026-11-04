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

## 2026-10-19
- **Trip + itinerary builder — Phase A (frontend, demo data) COMPLETE & verified** (D12,
  ARCHITECTURE.md sequence step 5). Frontend-first per owner direction: full CRUD UI runs on
  sample trips before the API exists, so the UX is validated cheaply.
  - **Shared contract now:** `packages/types` trip DTOs (TripSummary/TripDetail, travelers +
    needs, days, items); `packages/validation` zod schemas (trip, traveler, day, item, reorder)
    used by the web forms today and reused by the API in Phase B — no re-mapping.
  - **Web:** `/trips` (list, empty state), `/trips/new`, `/trips/[id]` builder — trip details
    (dates auto-generate days, cap 30; moving the start date shifts day dates + item times;
    extending appends, shrinking never deletes), travelers with owner-private needs
    (accessibility/dietary/medical), day titles/notes, activities (attraction, food, event,
    transport, note) with times, destination links, up/down reorder, delete-only-empty days.
    `/plan` now routes to the self-serve builder; "Trips" added to the top nav. Demo banner
    offers a fixture reset; data persists per browser (`localStorage`, `tg.demo.trips.v1`).
  - **Data boundary:** async `TripsSource` interface — demo implementation today, `api-source`
    swap via `NEXT_PUBLIC_TRIPS_SOURCE=demo|api` in Phase C.
  - **Verified:** web + packages typecheck ✓ · lint ✓ · `next build` ✓ (27 routes) · fresh
    dev server: `/trips`, `/trips/new`, `/trips/[id]`, `/plan` all 200 with demo banner.
  - **Next:** Phase B — `trips` NestJS module behind the same schemas (owner-scoped CRUD,
    foreign/missing IDs → 404), integration tests, then Phase C wiring + auth restore.
- **Trip + itinerary builder — Phase B (NestJS `trips` API) COMPLETE & verified** (D12).
  - **API:** `apps/api/src/modules/trips` — owner-scoped `GET/POST /api/trips`,
    `GET/PATCH/DELETE /api/trips/:id`, travelers (`POST/PATCH/DELETE …/travelers[/:travelerId]`),
    days (`POST/PATCH/DELETE …/days[/:dayId]`), items (`POST …/days/:dayId/items`,
    `PATCH/DELETE …/items/:itemId`, `POST …/days/:dayId/items/reorder`). Mutations return the
    full `TripDetail`, so Phase C's `api-source` is a straight swap. Same day rules as the demo
    source: generate on create (cap 30), shift day dates + item times when the start moves,
    append on extension, never auto-delete; only empty days delete and the remainder renumbers
    (two-phase, for `@@unique([tripId, dayNumber])`). New travelers/needs are written explicitly
    owner-private (`providerVisibility=NONE`, `detailsVisibleToProviders=false`,
    `consentGivenAt=null`, §11). Foreign and missing IDs both return 404. `BOOKING` item type is
    rejected by the shared schema until the booking engine ships.
  - **Verified:** api typecheck ✓ · lint ✓ (also fixed 6 pre-existing unused-import errors in
    `listings.controller/service` so repo lint is green again) · tests: **51 unit / 29
    integration passing** (17 unit + 10 integration new for trips) via
    `pnpm --filter @travelghana/api test` and `test:int`.
  - **Note — pre-existing schema/test-DB blocker (not from this increment):** a fresh
    `prisma db push` fails at HEAD because five `@db.Uuid` FK scalars in `schema.prisma`
    (`Location`/`Provider`/`Listing` `cityId`/`regionId`, introduced by `8c4cfcf`) reference
    text cuid ids — Postgres rejects the FK (`uuid` vs `text`), and the uncommitted uuid-refactor
    WIP adds more of the same plus relation-validation errors (`regionId String?` with a required
    `region Region`). The integration run above executed against the committed schema with those
    five annotations temporarily dropped; your working-tree `schema.prisma` (including the WIP
    edits) was restored byte-for-byte afterwards. Needs the type-alignment decision in
    OPEN_QUESTIONS #15 before `test:int` can run from a fresh database again.
  - **Next:** Phase C — add `apps/web/src/lib/trips/api-source.ts`, swap on
    `NEXT_PUBLIC_TRIPS_SOURCE=api`, restore auth on the trip pages.
- **Trip + itinerary builder — Phase C (web ↔ API + auth) COMPLETE & verified** (D12).
  - **Web data source:** `apps/web/src/lib/trips/api-source.ts` implements `TripsSource` over
    `/api/trips` (owner-scoped; every mutation unwraps the full `TripDetail`; a 404 becomes
    `null` for the builder's "not found"). The destination picker reads the public
    `/destinations` list (48/page, pages through, cached per session). `tripsSource` selects
    demo vs API on `NEXT_PUBLIC_TRIPS_SOURCE`; demo is explicit opt-in (`demo`), and an unset
    flag means connected — a deployment can never silently serve the preview. `.env.example`
    shows `api`, and the local (gitignored) `apps/web/.env.local` runs the connected planner.
  - **Auth restored:** `TripsAuthGate` wraps `/trips` (list/new/builder). In API mode it checks
    `/auth/me` and redirects unauthenticated visitors to `/login?next=…`; login/register accept
    a same-origin `next` path (open-redirect-safe). Demo mode stays open, as in Phase A. The
    account page links to My trips.
  - **Fixed a pre-existing runtime blocker:** the API compiled but could not boot —
    `@travelghana/validation` ships TS source with extensionless imports, which Node cannot
    load. Added `packages/validation/tsconfig.build.json` (CJS → `dist`), conditional package
    `exports` (`import` → TS source for Next/Vitest; `require` → `dist/index.js` for Nest), and
    the API `build`/`start:dev` scripts now compile validation first (D13).
  - **Verified:** web/api/validation typecheck + lint ✓ · API unit **51/51** ✓ ·
    `next build` in API mode ✓ (27 routes) · live smoke on the test **and dev** databases over the
    exact api-source requests: register/session, `/destinations` mapping, trip create (3 generated
    days)/list/get/rename/delete, traveler + item add, 404 after delete ✓ (dev check account and
    trip cleaned up after the run) · dev stack connected to the dev DB: `/api/health` ok, `/trips`
    renders the session gate (no demo banner), `/login?next=%2Ftrips` 200 ✓.
  - **Note:** the fresh-DB `test:int` blocker from Phase B (OPEN_QUESTIONS #15) is unchanged.
- **Motion polish (web) COMPLETE & verified.**
  - **System:** Tailwind keyframes/animations `fade-in`, `rise`, `pop` use `backwards` fill so
    finished entrances don't override hover transforms; the `.tg-stagger` utility cascades direct
    children in 50 ms steps (capped at 8). A global `prefers-reduced-motion` rule collapses
    animation/transition durations (WCAG 2.3.3). No animation library added.
  - **Applied:** staggered entrances on trip/destination/tour/account grids plus hero and plan
    sections; hover lift + image/icon zoom on cards; animated nav underline and mobile active
    indicator; press feedback on buttons; pop-in forms and inline errors; skeleton loading states
    for the trip list and builder; spinners for the session gate and account page.
  - **Verified:** web typecheck ✓ · lint ✓ · standalone Tailwind build emits the keyframes,
    stagger delays and reduced-motion block ✓ · fresh dev server `/trips` 200 ✓ (after clearing a
    stale `.next` left by two pre-existing dev-server instances).
- **Curated packages + admin CRUD COMPLETE & verified** (D15).
  - **Schema:** `Package` + `PackageDay` (+ `PackageStatus` DRAFT|PUBLISHED|ARCHIVED) for
    platform-owned multi-day journeys: optional destination reference, days/nights, from-price in
    integer minor units, hero image, inclusions/exclusions, featured, and an editorial day outline
    replaced as a set. Deleting a package cascades its days. The half-finished `@db.Uuid`
    annotations were reverted (ids stay cuid/text), which fixes `prisma validate`/`generate` and
    the fresh-DB `test:int` blocker — OPEN_QUESTIONS #15 resolved. Dev DB pushed without losing
    users/trips/seed data; the one provider had a null city.
  - **API:** ADMIN-only `GET/POST /api/admin/packages`, `GET/PATCH/DELETE /api/admin/packages/:id`;
    list supports `q` (title/summary/destination) and `status`; create starts as DRAFT and
    generates a unique slug from the title; destination existence is checked; merged
    duration/nights and unique day numbers are validated; publish sets `publishedAt` and any other
    status clears it; missing ids → 404. 10 new service unit tests.
  - **Web:** `/admin` redirects to `/admin/packages`; the list supports search, status filter,
    publish/unpublish and delete; `/admin/packages/new` and `/admin/packages/[id]` share a package
    editor with a destination picker, cedi→minor-unit price conversion, featured/status controls
    and a day-outline editor (add/remove, title, description, meals, accommodation). An
    `AdminGate` wraps the console (login redirect + ADMIN check) while the API remains the
    enforcement point; the account page shows an Admin console link for ADMIN accounts.
  - **Verified:** schema validates ✓ · Prisma client regenerated + dev DB in sync ✓ · API/web/
    validation typecheck + lint ✓ · API unit **61/61** ✓ · integration on a fresh DB **34/34**
    (5 new package tests: 401/403, validation, create/slug/order, publish + outline replacement,
    delete) ✓ · dev account granted ADMIN for the live walkthrough.
- **Public curated-package catalog COMPLETE & verified** (D16).
  - **API:** public, unauthenticated `GET /api/packages` (PUBLISHED only, featured first then
    newest-published) and `GET /api/packages/:slug` (draft/archived → 404). No booking,
    availability or departure data is exposed; admin CRUD is unchanged.
  - **Web:** `/packages` catalog (hero/fallback image, destination, duration, from-price,
    featured badge) and `/packages/[slug]` detail (hero, about, day-by-day outline,
    inclusions/exclusions, "not bookable yet" note + planner CTA), plus a package-specific
    not-found page, metadata and sitemap entries. "Packages" added to the desktop nav and a
    mobile header link; the home page shows up to three published packages with a "View all"
    link. Admin-supplied hero URLs use a plain `<img>` with a gradient fallback — no
    image-optimizer host allowlist.
  - **Verified:** API unit **64/64** ✓ · fresh-DB integration **34/34** (public visibility
    assertions added to the package suite) ✓ · web typecheck + lint ✓ · `next build` ✓
    (`/packages` static, `/packages/[slug]` dynamic) · live smoke: `/packages` 200 with the
    seeded card, detail 200, unknown slug 404, home teaser + nav present; public API lists
    published only and hides drafts ✓.
  - **Dev data:** one published demo journey seeded (`cape-coast-heritage-coastline`, 4 days,
    featured) so the catalog is browsable; editable/deletable in `/admin/packages`.
- **Homepage hero visual refresh COMPLETE.**
  - **Web:** full-bleed blue cloud-sky backdrop (`apps/web/public/hero-sky.svg`) layered behind the
    hero with a navy left/bottom readability wash, white/gold copy and gold + glass CTAs (now
    `next/link`). A mobile-only tint keeps the longer copy readable over the brighter cloud bank;
    the desktop sky stays bright and cloud-forward. The sky is a self-contained SVG (crisp at any
    size, no third-party image dependency) and can be swapped for a photo by replacing the asset.
  - **Verified:** web typecheck + lint ✓ · live desktop and 390 px mobile renders reviewed
    (hero copy legible, sky and clouds visible, nav/CTAs intact) ✓ · `/hero-sky.svg` served as
    `image/svg+xml` ✓.
- **Admin console access hardened COMPLETE.**
  - **Web:** the account-page Admin console card is rendered only for `ADMIN` roles. `/admin/*`
    is wrapped in `AdminGate`: signed-out visitors go to `/login?next=...`, authenticated
    non-admins are redirected to `/account?notice=admin-only` (with an explanatory notice) instead
    of seeing a forbidden admin screen, and only admins get the console shell and page content.
    The API remains the enforcement point.
  - **Verified:** web typecheck + lint ✓ · live headless-browser checks with admin, non-admin and
    signed-out sessions ✓ (admin sees the link/console; non-admin has no link and is bounced from
    `/admin/packages`; signed-out is sent to login) · live API checks: non-admin
    `GET /api/admin/packages` → 403, admin → 200 ✓.
- **About page + admin-curated gallery COMPLETE & verified** (D17).
  - **Schema/contract:** `GalleryItem` (title, caption?, imageUrl, category?, location?,
    sortOrder, published) plus shared `GalleryItem` type and zod schemas
    (`galleryItemCreateSchema` / `galleryItemUpdateSchema` / `galleryItemListQuerySchema`) reused
    by the API and the admin form.
  - **API:** ADMIN-only `GET/POST /api/admin/gallery` and `GET/PATCH/DELETE /api/admin/gallery/:id`
    (search over title/caption/category/location, DRAFT/PUBLISHED filter, 404s for missing ids);
    public unauthenticated `GET /api/gallery` returns published items only in curated order. Empty
    optionals are stored as NULL and can be cleared by sending `""`. 9 new service unit tests and
    6 new integration tests (401/403, validation, draft invisibility, publish + ordering, clearing
    optionals, get/delete).
  - **Web (public):** `/about` (mission, values, how we curate, what you can do here, sky CTA),
    `/gallery` grid with category filters and an accessible lightbox (Escape/backdrop/close,
    focus + scroll lock), a homepage gallery teaser (up to four photos, hidden while empty) and an
    about band. Desktop nav gains Gallery/About; the mobile bottom nav and header breakpoints moved
    from `md` to `lg` to fit seven links; sitemap entries added. The public gallery fetch is
    uncached so publishing/unpublishing shows immediately (the homepage now renders dynamically).
  - **Web (admin):** Packages/Gallery tabs in the `AdminGate` shell; `/admin/gallery` list with
    search, status filter, thumbnails, publish/unpublish and delete; `/admin/gallery/new` and
    `/admin/gallery/[id]` share a `GalleryItemForm` (image URL with live preview, caption,
    category, location, sort order, published; shared-schema validation).
  - **Verified:** API unit **73/73** ✓ · fresh-DB integration **40/40** ✓ · api/web/validation
    typecheck + lint ✓ · live headless-browser pass: admin list/new/edit render with the gallery
    tabs, public gallery has filters and the lightbox opens/closes, about sections render,
    signed-out `/admin/gallery` → `/login?next=...` ✓ · 390 px mobile gallery reviewed ✓.
  - **Dev data:** six published demo photos seeded from Wikimedia Commons URLs (Cape Coast Castle,
    Kakum, Mole, Wli Falls, Independence Arch, kente) so the gallery and homepage teaser are
    browsable; titles and URLs are placeholders — replace or delete them in `/admin/gallery`.
- **Trip planner Phase 1 core — preferences, real-inventory discovery, day-by-day organization,
  budget, honest booking handoff COMPLETE & verified** (D18).
  - **Schema/contract:** D18 fields on `Trip` (interests, travelPace, budgetTier, budgetType,
    budgetIncludesFlights, arrivalPoint, destinationPreferences — defaulted), nullable
    `ItineraryItem.itineraryDayId` (trip-level ideas tray) and item estimate fields +
    listing references (attraction/tour/experience/package) with an
    `EstimateSource` (`LISTING|MANUAL`) / `PricingBasis` (`PER_PERSON|PER_GROUP|PER_NIGHT|
    PER_SERVICE|TOTAL`) snapshot model (`priceSnapshotAt`). `@travelghana/validation` trip
    schemas rebuilt for the new inputs; ids stay cuid/text (OPEN_QUESTIONS #15 stays resolved).
  - **API:** `trips.service` rewritten around one `resolveItemWrite` path (listing refs and
    estimate snapshots persist reliably), preferences/unscheduled CRUD, item move
    (`PATCH /trips/:id/items/:itemId/move` — rebases times onto dated targets, clears them into
    the tray/undated days), trip- and tray-scoped reorder endpoints, and public
    `GET /api/catalog/attractions` (q/category/city filters) with place context for discovery.
    Summaries are derived server-side by the pure `computeTripSummary` engine plus 16 dedicated
    unit tests: budget totals/per-person math (`PER_PERSON` budgets normalize to a group target,
    children counted), `overBudget`/`remainingMinor`, and the eight honest warning codes
    (unscheduled ideas, missing accommodation/transport, unpriced/out-of-trip-currency items,
    pace `DAY_OVERLOADED` at RELAXED 3 / BALANCED 5 / PACKED 7, `TIME_OVERLAP` only when both
    times exist). No booking or payment semantics — estimates explicitly labelled, never
    confirmed prices.
  - **Web:** `/plan-my-trip` planner entry (hero + 4-step wizard capturing the whole brief +
    saved trips) with guest flow — creating a trip unauthenticated stores a `sessionStorage`
    draft and hands off to `/login?next=…`, restoring the draft after sign-in; `/plan` and
    `/trips/new` redirect there; `/trips` CTAs and the header/desktop/mobile nav point at the
    planner. `/trips/[id]` is a responsive three-panel workspace (Discover | Itinerary | Summary,
    tabbed under `xl`): API-backed discovery tabs with add-target picker and duplicate guard
    (demo mode shows Places only with an honest note), day timeline grouped
    morning/afternoon/evening with durations and estimate labels (listing snapshot vs your own),
    cross-day moves, ideas tray with schedule-up and reorder, inline item forms (manual or
    snapshot estimates), and a summary panel with budget math, planner warnings, trip brief and
    an accessible ordered-stops fallback (D4 — no map until `NEXT_PUBLIC_MAPBOX_TOKEN` exists).
    Demo source mirrors the new methods and summary rules (`lib/trips/summary.ts`); SSR-safe
    state handling keeps the workspace/wizard hydration-stable (metadata-file-derived
    discovery state is memoized; storage restores run as microtasks).
  - **Verified:** api/web/validation typecheck + lint ✓ · API unit **91/91** ✓ · fresh-DB
    integration **42/42** ✓ (preferences + unscheduled + move + budget suite, attractions
    endpoint, catalog-test isolation) · repo-wide `pnpm -r typecheck`/`lint` ✓ · production
    `pnpm build` (turbo: validation/api/web) ✓ — 42 web routes incl. `/plan-my-trip`,
    `/trips/[id]`, `/trips/new`, `/icon.svg` (first clean build surfaced a stale-`.next`
    artifact from running `next build` while `next dev` was alive on the same dir; clean
    rebuild green, servers restarted) · live API smoke: wizard create with preferences (2 days
    generated), unscheduled idea, timed manual estimate (`MANUAL`), dated→dated move keeps
    times, tray move clears times, day- and tray-scoped reorder, budget patch recomputing the
    four planner warnings, `overBudget` math (450,000 estimate vs 400,000 target −
    `PER_PERSON`×3 travelers), `DAY_OVERLOADED` at 6 items on BALANCED, anonymous trip reads
    blocked 401 ✓ · web routes probe: `/plan-my-trip` 200, `/plan` 307→`/plan-my-trip`,
    `/trips/new|/trips|/trips/[id]` 200 with client gating, `/login?next=` 200 ✓.
  - **Unavailable integrations (deliberate no-controls):** Mapbox map/routes (no token —
    ordered stops only), stays/restaurants/events/transport discovery (no public inventory —
    Phase 3), booking/enquiry APIs (Enquiry model exists, no module — Phase 2/4, Paystack keys
    empty, no booking engine). All documented in D18 and OPEN_QUESTIONS #3/#4/#17.
  - **Next:** Phase 2 — server-side guest draft transfer (OPEN_QUESTIONS #18), enquiry capture
    backed by the `Enquiry` model (D6), and sanitized trip sharing (OPEN_QUESTIONS #13).

- **Trip planner - Phase 2 (guest draft upgrade, concierge enquiry capture, sanitized trip sharing) COMPLETE & verified** (D6 executed per D19; OPEN_QUESTIONS #13 resolved, #18 upgraded).
  - **Guest drafts (D18 follow-up):** `apps/web/src/lib/trips/draft-store.ts` - the wizard
    draft moved from sessionStorage (`tg.plan.draft.v1`) to localStorage (`tg.plan.draft.v2`),
    so drafts survive full browser restarts, with automatic v1 migration on first read,
    persistence as the wizard advances (not only at the `/login?next=` handoff), shape-
    sanitized parsing, and a blank-draft guard so an empty form neither persists nor falsely
    claims "draft restored". Clearing stays on successful trip create; server-side cross-device
    transfer remains open in OPEN_QUESTIONS #18 (same-device upgrade shipped).
  - **Concierge enquiry capture (D6):**
    - API: `modules/enquiries` - public `POST /api/enquiries` (guests allowed; signed-in
      requesters default name/email from their session; an optional owned `tripId` snapshots
      the trip brief server-side: dates, party, destination names, interests and a derived
      coarse budget string like "GHS 4,000 per group"), human `ENQ-XXXXXX` codes (P2002
      retry loop), AuditLog row always + queued `Notification` row only for signed-in
      requesters (Notification.userId is required), confirmation email via the shared MAILER
      abstraction (ConsoleMailer until a real provider exists, OPEN_QUESTIONS #9). Admin
      `GET/PATCH /api/admin/enquiries[/:id]` - search + status filter + pipeline
      NEW -> IN_REVIEW -> QUOTED -> CONVERTED -> CLOSED (CLOSED terminal; skipped moves
      rejected as INVALID_STATUS_TRANSITION), assignment set/clear. Unit spec
      (`enquiries.service.spec`) and Postgres-backed integration spec (`enquiries.int.spec`).
    - Web: `/enquire` public page (no account needed; destination picker; interests from the
      shared labels; honest copy throughout - "an enquiry is not a booking, nothing is
      charged, replies by email") + `concierge-panel.tsx` in the trip workspace ("Send this
      trip to the concierge" links the saved trip into the enquiry; demo mode shows a
      preview-note pointing at /enquire instead) + `/admin/enquiries` queue (search input,
      stage chips, transition buttons, assign-to-me) with an Enquiries entry in the admin
      gate nav.
  - **Sanitized trip sharing (D19, resolves OPEN_QUESTIONS #13):**
    - API: `TripShare` model in the database (32-char base64url token; creating a share
      rotates - the previous active row gets stamped `revokedAt`; fail closed). Owner
      operations `GET/POST/DELETE /api/trips/:id/share`; public
      `GET /api/trips/share/:token` (works logged-out; missing/revoked token 404s as
      SHARE_NOT_FOUND with no indication it ever existed). `trip-share.ts` is a pure
      server-side projector that returns only: name, dates, party size, interests, travel
      pace, per-day schedules (times as HH:mm, titles, item types, place names) and
      unscheduled idea titles - never budget figures or estimates, item/trip notes, planner
      warnings, traveler records or traveler needs (privacy-protected), or booking
      state. Unit spec covers
      the projector + include; integration spec covers create -> rotate (old token dies) ->
      revoke (token dies), foreign ownership, unknown tokens.
    - Web: `/share/[token]` SSR page (robots noindex; dead tokens call notFound(); API-down
      gets an honest retry state) + `share-panel.tsx` in the workspace (status, copy, rotate
      with the "current link stops working" explanation, revoke; demo-mode preview-note
      instead of dead controls).
  - **Phase 1 bug found and fixed by the new tests:** `addItem`/`addUnscheduledItem` accepted
    `notes` in the shared schema but silently dropped it on create (notes survived only via
    PATCH afterwards). Both create paths now persist `notes`.
  - **Verified:** repo typecheck + lint green - tests **106 unit / 51 integration passing**
    (15 unit + 9 integration new across enquiries + trips-share) - production `pnpm build`
    green (web dev killed first per the .next collision rule, then both dev servers
    restarted) - live smoke on :4000/:3000: guest enquiry 201 with ENQ code, bad email 400,
    guest trip-link 401, trip-linked enrichment correct (dates, 3+1 party, destination name
    snapshot, "GHS 4,000 per group", account-name default, interests), queue search + skip
    transition 400 + advance/assign + anonymous 401, public share GET with no notes/budget
    keys logged out, rotate killed the old token, revoke killed the new token, status
    inactive afterwards, unknown token stable 404, web `/enquire` `/` `/login` 200,
    dead-token share page 404, and a live-token SSR probe: trip name + item title + times
    rendered while the private item note and every budget figure were absent and noindex
    was present.
  - **Not in this phase (documented, not faked):** real email provider (OPEN_QUESTIONS #9),
    booking/payments (Phase 4), server-side cross-device drafts (OPEN_QUESTIONS #18), and
    captcha/anti-spam on the public enquiry form.

- **Admin console (D20) COMPLETE & verified.** One increment, seven sections, every route
  `@AnyRole(Role.ADMIN)`, every mutation audited:
  - API: new `modules/admin` (dashboard stats with parallel counts, users & roles with
    SELF_SUSPEND / SELF_DEMOTE / LAST_ADMIN guardrails + membership-history revocation,
    provider verification with page-scoped listing groupBy + queued notification, read-only
    audit trail with filters, read-only notification outbox) + catalog admin CRUD
    (destinations/attractions, derived slugs, publish/unpublish, reference-count delete
    guards, cities selector) inside `modules/catalog`. New shared contracts
    (`packages/types/src/admin.ts`, `validation/src/admin.ts` + `catalog.ts`).
  - Review queue hardened: 409 `INVALID_STATE` instead of a raw 500, REJECT requires a
    >= 4-char reason (schema-enforced), decision -> audit row + provider notification;
    admin queue listings now resolve city/region names (was dead code), and the WIP
    `null`-id-in-`IN`-query crash is fixed on both admin and provider paths. Public
    attraction browsing gained the `Attraction.published` filter (D20's only schema change;
    db push + client regen done).
  - Web: `/admin` became a real dashboard (all-shipped KPI cards + recent lists), new pages
    `/admin/listings` (approve / reject-with-reason incl. presets / park), `/admin/users`
    (role chips, grants/revokes, suspend-reactivate with guardrail error copy),
    `/admin/providers` (status filters + verify/reject/suspend/reset, honest copy for
    ownerless providers), `/admin/activity` (read-only trail with meta expansion),
    `/admin/catalog` (tabbed destinations/attractions CRUD with publish toggles and
    delete-guard surfacing), `/admin/notifications` (read-only outbox with a "queue-only
    today" banner - no fake resend). Grouped compact top-bar nav; label/chip maps in
    `components/admin/shared.tsx`; `formatDateTime` helper.
  - Verified: api+web typecheck green, lint green (incl. react-hooks set-state rule on the
    new pages), **117 unit / 84 integration passing** (new: admin-users guardrail unit
    spec, `admin.int.spec.ts` 22 cases - RBAC across every endpoint, roles, suspend-blocks-
    login, provider verify + notification + no-op no-audit, stats deltas, queue lifecycle
    reject-no-note-400/reject-with-note/approve, audit filters - and `catalog-admin.int.spec.ts`
    11 cases - slug derivation, duplicate 409, public published-only visibility for both
    entities, refCounts detail, trip-reference delete guards + detach-then-delete),
    production `pnpm build` green (web dev stopped first per the .next collision rule).
  - Live smoke on :4000/:3000 (`Temp\opencode\smoke-admin.ps1`): **37/37 PASS** - RBAC
    401/403, stats shape, role grant/revoke/keep, self-suspend 409, provider verify +
    queued notification + audit, full listing review lifecycle, catalog create->public->
    hide->republish->audit->detached-delete, guarded delete 409 with refCounts, outbox
    queued filter, web pages 200.
  - Docs: DECISIONS D20; ERD v0.5 (Attraction.published; fixed stale `metaJson`/`payloadJson`
    column names); OPEN_QUESTIONS #19 (PAUSED revival path) + #20 (cities/regions admin
    CRUD) opened; #9 unchanged (outbox stays queue-only until a delivery provider lands).
  - Platform quirk documented in D20: Postgres rejects "→" in audit JSON on this machine
    (client encoding WIN1252) - audit/meta strings are CP1252-safe by style; switch to an
    ASCII "->" everywhere in persisted strings.
- **Separate admin site (D21) COMPLETE & verified.** One `apps/web` build now supports a
  standalone admin subdomain behind `ADMIN_HOST`:
  - New `middleware.ts` (feature-flagged; no-op when `ADMIN_HOST` is unset, so local dev
    and all existing flows are unchanged): main host 308s `/admin*` to the admin host;
    admin host serves `/admin*` + auth pages + the assets they need (including the
    space-encoded logo path), funnels every other path to `/admin` (307), and stamps
    all responses `X-Robots-Tag: noindex, nofollow`.
  - API: `ADMIN_APP_URL` is now a comma-separated multi-origin list in the CORS
    allowlist (`adminAppUrls()`); 5 vitest unit tests added (`app-urls.spec.ts`) -
    unit suite at **122 passing**. Live preflight from `http://localhost:3001` returns
    the exact origin echo plus `Access-Control-Allow-Credentials: true`.
  - Console UX guarded against twice: non-admins on the admin host get an honest
    "Staff accounts only" sign-out screen (the old `/account` bounce would
    redirect-loop through the healer middleware), and the shared chrome links out to
    the main site via `NEXT_PUBLIC_WEB_APP_URL` (`lib/links.ts` `siteLink()`).
  - Dev workflow: new `pnpm dev:admin` script (web, port 3001); `.env.example`
    documents `ADMIN_HOST`, `NEXT_PUBLIC_ADMIN_HOST`, `NEXT_PUBLIC_WEB_APP_URL` and
    the multi-origin `ADMIN_APP_URL`.
  - Verified: web typecheck + lint + production build green (middleware listed as its
    own 34.7 kB bundle); Host-header simulation matrix **12/12** (funnel redirects with
    correct Location targets, path-preserving 308s, auth pages and assets allowed on
    the admin host, plain 200s on the main host); `X-Robots-Tag` present on console
    pages and assets; feature-off instance serves both / and /admin unchanged; the
    full 37/37 admin smoke re-passed with the middleware compiled in but disabled.
  - Docs: DECISIONS D21 (deployment runbook inside: env matrix, same-site API
    requirement, DNS/TLS outside-repo steps); OPEN_QUESTIONS #21 opened (dedicated
    admin shell / route-group chrome refactor deferred).
- **Nav trim + operator console removal (D22) COMPLETE & verified.** Per the owner's
  choice: "Favorites" removed from the mobile bottom nav and its stub page deleted;
  "For operators" removed from the desktop nav and footer, and the whole `/operator`
  web console deleted (10 pages + 5 form components). Deleted routes 404 live
  (`/favorites`, `/operator`); homepage renders without the removed labels. WEB
  typecheck/lint/build green (38 static routes, down from 46). The API operator module
  is intentionally kept (admin provider verification + published catalog depend on it)
  - follow-up recorded as OPEN_QUESTIONS #22.

## 2026-10-20
- **Destination images increment COMPLETE & verified.** All 20 seeded destinations now
  have hero photos: committed JPGs at `apps/web/public/destinations/<slug>.jpg`
  (Wikimedia Commons; CC0 / CC BY / CC BY-SA), provenance recorded in
  `apps/web/scripts/destination-images/manifest.json`, deterministic re-fetch via
  `apps/web/scripts/fetch-destination-images.ps1` (thumb.php route; skips existing
  files unless -All), credits auto-generated at
  `apps/web/public/destinations/ATTRIBUTIONS.txt`. The seed wires `heroImageUrl` for
  the 20 curated slugs (create + update branches). Destination detail pages gained a
  hero image block + `og:image` when a hero is set. Every photo was visually verified
  on-subject after download; three picks were replaced (Aburi: wrong subject from the
  search's first hit, Afadja: black-and-white, Boti: upgraded to the CC0 twin-falls
  shot). Verified live: API returns `heroImageUrl` 20/20; image files serve 200
  image/jpeg from the web app; `/destinations` grid renders 12 image cards on page 1;
  detail pages render the hero; web typecheck + lint + production build green (38
  routes, middleware 34.7 kB unchanged); seed re-run clean (16 regions, 19 cities,
  20 destinations, 5 attractions). DECISIONS D23 records the licensing rationale.
- **Explore page:** removed the "Locations on this map" list fallback from `/explore` -
  the map section there now renders only when a Mapbox token is configured (real map or
  nothing). The same list fallback intentionally remains on the destination detail
  page, where it doubles as the attractions index. Typecheck/lint green; verified live
  (no fallback rendered, 20 destination cards intact).
- **Footer re-themed dark:** new semantic tokens (`--tg-footer` deep evergreen #0b2e1d,
  Warm Ivory foreground, soft sage secondary text, divider) added to `tokens.ts`,
  `globals.css` and the Tailwind map (kept token-driven per §53, no hard-coded hex in
  the component); `SiteFooter` now uses `bg-footer` + footer text tokens. The original
  logo PNG stays unmodified - its background is fully transparent (alpha verified), so
  the artwork sits directly on the dark surface. Verified in compiled CSS and live HTML.
- **Ghana flag accents (minimal pass):** new `components/brand/ghana-flag.tsx` - inline
  SVG (2:3, official colors red #CE1126 / gold #FCD116 / green #006B3F, black star;
  documented token exception since a national flag is fixed-color), always
  aria-hidden/no alt, decorative by policy. Placements: homepage "made in Ghana" band
  heading, About page green-band eyebrow, footer "Made in Ghana" chip beside the
  tagline. No logo change. Typecheck/lint green; verified the SVG renders on /, /about
  and /destinations (footer) with correct fill values.
- **Footer trust badges:** two owner-confirmed emblems now sit on light chips in the
  dark footer's brand column: the Ghana Tourism Authority logo (new
  `public/gta-logo.webp`, renamed from "tourism authority logo.webp"; caption
  "Licensed by the Ghana Tourism Authority") and the GPRTU of TUC seal
  (`public/gprtu-logo.jpg`, sourced from a business-directory listing at 150x150 -
  placeholder quality; swap an official high-res file when available; caption
  "Drivers' union member / GPRTU of TUC"). Membership asserted by the owner
  (question-confirmed before shipping - these badges imply affiliation, so nothing
  was added without it). Alts identify the emblems; captions carry the claim.
  Typecheck/lint green; badges verified live on / and /about.

## 2026-10-20 (D24: site settings)
- **Admin-editable contact + social info (D24) shipped.** New 50th model
  `SiteSettings` (singleton row, fixed id "site"; nullable phone/WhatsApp/email/address
  + Facebook/Instagram/X/YouTube URLs). API: new `settings` module - public
  `GET /api/site-settings`, admin `PATCH /api/admin/settings` (ADMIN role guard,
  shared zod schema, full-replace semantics: empty string clears a field; every save
  audited as SITE_SETTINGS_UPDATED with filled/cleared fields in meta). Web: admin
  console page /admin/settings (single form, field-level errors via the shared
  `issueMap`, "last saved" timestamp) + nav entry under Manage; footer gains a
  contact block and social icon links; the about page gains a "Talk to a real
  person" contact section. Both public surfaces render only filled fields and read
  the settings uncached so changes appear on the next request. ERD bumped to v0.6
  (50 models / 32 enums).
- **Verified live (curl through the API + HTML checks):** login -> PATCH (8 fields)
  -> anonymous PATCH 401 -> public GET shows the values -> footer shows phone
  (2 occurrences = rendered + flight payload), wa.me link, Facebook/X anchors and
  the address; /about shows the contact section; clear-all PATCH -> fields null,
  footer contact block gone; invalid PATCH -> 400 VALIDATION_ERROR with per-field
  issues; audit rows recorded per save. API unit tests: 15 files / 126 tests green
  (new settings.service.spec.ts). Web typecheck + lint + production build green;
  /admin/settings route serves 200 (AdminGuard-gated client form).
- **Note:** dev database only - a throwaway admin account (dev-admin@travelghana.test)
  was upserted for the smoke tests (the repo has no ADMIN_EMAIL/ADMIN_PASSWORD in
  .env, so the API bootstrap hook is inert here); it stays in the dev DB because the
  audit rows reference it. Settings were left EMPTY after the smoke test - the owner
  fills in the real contact details and social handles from /admin/settings.
- **Infra note:** never run `next build` while `next dev` is serving from the same
  app dir - both write `.next`, and the prod build wipes the dev server's chunk
  manifest (`Cannot find module './3770.js'`, `_next/static` 404s,
  /manifest.webmanifest 500s). **D27 variant (observed again):** stopping dev
  first and running the prod build is STILL not enough - restarting
  `next dev` on top of a prod-built `.next` reproduced the corruption the
  browser saw (chunk 404s on layout.js/main-app.js/page.js + layout.css,
  `ENOENT` on `.next/server/app/admin/activity/page.js`, one error page).
  Deleting `.next` between build and restart is mandatory, not optional.
  Fix: stop the dev server, DELETE `.next`, restart dev, and hard refresh
  (Ctrl+Shift+R) because the browser caches the stale asset URLs
  (`?v=<ts>`). Session rule going forward: typecheck/lint any time; production
  builds only after stopping the page's dev server AND deleting `.next`
  before restarting it (or run build last and leave the dev server down).
  **D28 addition:** dev now runs `next dev --turbopack` (apps/web/package.json)
  - on-demand route compiles went from ~2-5 s to ~1-2 s and warm navigations
  to ~0.5 s; `next build`/`next start` stay on webpack for the production
  path. When the compiler changes (or after any prod build), DELETE `.next`
  before restarting dev - the D27 corruption rule applies as before.
  **D30 extension:** the same applies to a production `next start` process -
  no server (dev or prod) from the app dir may be running while `next
  build` writes `.next`; a stray prod server during D30 measurement was
  exposed by EADDRINUSE and the measurement discarded.

### D25 - "Book now" on package pages, login-gated (2026-10-20)

- **Schema:** new `PackageBooking` model (51st; 51 models / 32 enums, ERD v0.7):
  `code` (unique `PB-XXXXXX`), `userId`, `packageId`, required future `startDate`,
  `adults`/`children`, optional `notes`, `status` reusing `BookingStatus`
  (default `PENDING_PAYMENT`). Indexes on (`userId`,`status`) and
  (`packageId`,`status`). Backreferences added to `User` and `Package`. db:push
  done with the API stopped (the Prisma DLL lesson), client regenerated cleanly.
- **API:** `packages/validation/src/bookings.ts` (create schema: cuid-ish
  `packageId`, ISO `YYYY-MM-DD` future-dated start date -> `Date`, adults 1-20,
  children 0-20, notes <= 1000; list query status enum) and
  `packages/types/src/bookings.ts` (`PackageBooking`,
  `AdminPackageBookingDto`, `AdminPackageBookingsResult`, the type-only
  `import type { ... } from "./index"` pattern admin.ts already uses). New
  `apps/api/src/modules/bookings/`: default-guarded `POST /api/bookings`
  (login required server-side; anonymous 401), admin-only `GET
  /api/admin/bookings?status=` (latest-first, pageSize 50), service
  (PUBLISHED-only packages, PB-code mint from the shared unambiguous alphabet,
  `PACKAGE_BOOKING_REQUESTED` audit with meta). `app.module.ts` wired with a
  plain import + registration.
- **Verification (live API):** anonymous POST 401; login -> POST booking 201
  (`PB-B44UK8`, `PENDING_PAYMENT`) against the seeded
  `cape-coast-heritage-coastline`; admin queue returns it with package + user
  context and the status filter matches; invalid POST 400 `VALIDATION_ERROR`
  with per-field issues; unknown-but-valid-shaped package id 404; audit row
  visible via `/api/admin/audit?entityType=PackageBooking`. Unit tests 130/130
  (16 files, includes new `bookings.service.spec.ts`); integration suite
  87/87 (11 files, includes new `test/bookings.int.spec.ts` - login-first,
  draft 404, published 201, traveler 403 on the admin queue, status filter,
  audit row). API typecheck green.
- **Fix (same day):** the panel's first browser attempt returned 400 - the
  shared zod schema TRANSFORMS `startDate` into a `Date` during the client-side
  `safeParse`, so the panel submitted `parsed.data` and the Date serialized as
  an ISO datetime (`2026-12-18T00:00:00.000Z`), which the server's date-only
  regex rejects. The smoke script had posted the raw string and never caught
  it. Contract fixed: the API's wire shape is the schema's INPUT (exported as
  `PackageBookingCreateWire` = `z.input<typeof schema>`), the panel validates
  locally with the schema but submits the pre-transform values (date-only
  string, numeric adults/children, trimmed notes), and the server re-parses
  and applies the transform. Verified live: date-only wire POST 201
  (`PB-23MSET`); the old ISO-datetime payload still 400 `VALIDATION_ERROR`
  with `startDate` issues.
- **Web:** `BookingPanel` client component on `/packages/[slug]` (anonymous ->
  "Book now" routes to `/login?next=/packages/<slug>`, signed-in -> inline
  form with shared zod client validation, success card shows the PB code +
  honest "no payment has been taken" copy); the old "Packages are previews
  for now" notice removed; "Plan a custom trip" demoted to secondary border
  link. New read-only console page `/admin/bookings` (status filter, status
  chips, package/traveler/date/party/notes) + `Bookings` entry in ADMIN_NAV;
  `lib/api.ts` gained `createBooking` + `adminPackageBookings`. Web typecheck
  + lint green; production build green (dev server stopped first, restarted
  after); package page serves the panel ("Ready to go?" marker present,
  preview notice gone), `/login?next=%2Fpackages%2F...` 200, unknown slug 404,
  home + manifest 200.
- **Deliberately NOT shipped:** admin status transitions (confirm/cancel) -
  they follow the payment integration so no one can mark a booking "Confirmed"
  without rails behind it; a traveler self-service bookings list (no UI yet);
  payment capture of any kind. Package pages keep the D15 day-by-day preview
  content - "instead of preview" means the aside CTA became a booking action,
  not removing the curated itinerary display.

### D26 - Booking confirmations + "My bookings" on /account (2026-10-20)

- **API:** `POST /api/bookings` now also (a) records an in-app Notification
  (`EMAIL`/`PACKAGE_BOOKING_REQUESTED`/`QUEUED`, mirrors the D6 enquiry
  pattern) and (b) sends the confirmation email through the injected
  `MAILER` (`ConsoleMailer` in dev; provider = OPEN_QUESTIONS #9). Email copy
  includes the PB code, package title, UTC-pinned start date, party, notes
  and "Nothing is charged yet - no payment has been taken" + the `/account`
  link via `primaryWebAppUrl()`. BookingsModule now provides + re-exports
  MAILER like EnquiriesModule. New `GET /api/bookings/me`
  (`BookingsController.mine`): session-scoped (proxy = the logged-in user's
  id only), newest-first, package context (id/slug/title/priceMinor/currency
  code), take 50; service `listMine` + `PackageBookingWithPackage` /
  `MyPackageBookingsResult` types.
- **Web:** `/account` gained a "My bookings" card (after "My trips") that
  loads `api.myBookings()` independently: status chips (same mapping as the
  admin queue), code, package link, start date + party, "No payment has been
  taken - the team confirms availability first." note on pending rows,
  loading/error/empty states (empty links to /packages). `lib/api.ts` gained
  `myBookings()`; imports cleaned (removed the unused type that eslint
  flagged first pass).
- **Verification:** LIVE: anonymous `/me` 401; login ->
  `/me` returns the two dev bookings with package context; new booking 201
  (`PB-65PDGH`) -> `/me` newest-first confirmed; dev ConsoleMailer log shows
  the full confirmation email (To/Subject/Start date "22 Dec 2026"/party/
  honest copy/account link). Unit tests 133/133 (16 files; bookings service
  spec extended: notification + email + no-user-row email skip + listMine).
  Integration 88/88 (11 files; bookings.int 4 tests incl. the new
  `/me` + email-capture test). **Test-infra fix surfaced by the new fixtures:**
  `packages.int.spec.ts` asserted emptiness on the shared admin/public package
  lists (violating the repo's "never assert emptiness" rule) and raced any
  spec that also inserts packages - rewritten to assert on the spec's own
  package id/slug. Web typecheck/lint green; production build green (dev
  stopped first, restarted after); `/`, `/account`, package page, manifest
  all 200 post-restart.
- **Deliberately NOT shipped:** real outbound email (no provider yet);
  pagination on `/admin/bookings` + `/me` (both capped at 50, tracked with
  the payment increment); booking status transitions (still payment-gated).

### D27 - Count badges: admin nav + dashboard card, traveler header + account (2026-10-20)

- **Decision:** numbers that mean something actionable, shown where the user
  is already looking. Admin side: the console NAV (`AdminGate`) renders a
  badge per section fed by one `adminStats()` call fetched once per console
  visit - Listings (pending review), Bookings (`PENDING_PAYMENT` package
  booking requests), Enquiries (NEW), Providers (unverified), Packages
  (draft), Catalog (unpublished destinations + attractions), Notifications
  (queued outbox) - only when the count is > 0 (badge fatigue is worse than
  no badge). The dashboard gets a "Booking requests" stat card so the new
  D25 queue has a KPI like every other section. Traveler side: `/account`
  cards show count chips ("My trips" N, "My bookings" N) and the site header
  "My TravelGhana" button + mobile bottom-nav Profile item show the member's
  package-booking count bubble.
- **API:** `GET /api/users/counts` (session-scoped; 401 anonymous) returns
  `{ trips: owned, packageBookings: member's }` (`UsersService.counts`;
  trips narrowly = trips the user OWNS, not trips shared with them - the
  planner treats ownership and collaboration differently). `AdminStats`
  gained `packageBookingsPending`; the admin.int.spec key list now covers it.
  New shared type `UserCounts` (`packages/types/src/users.ts`, exported via
  the barrel). The header calls `me()` first, then `userCounts()` only when
  a session exists; a failed badge fetch is cosmetic everywhere (badges just
  stay hidden - the console and cards never break on it).
- **Verification:** LIVE: anonymous `/users/counts` 401; dev-admin counts
  `{trips: 0, packageBookings: 3}`; `/admin/stats.counts.packageBookingsPending`
  = 4 (dev database rows); all badge-carrying routes 200. Unit 134/134 (17
  files; new `users.service.spec.ts`); integration 88/88 (bookings.int now
  also asserts `/users/counts` for the member and 401 anonymous; admin.int
  asserts the new stats key). Web typecheck/lint green; production build
  green (dev stopped first, restarted after; all routes 200 again).
- **Deliberately NOT shipped:** an unread-notification traveler badge - there
  is no traveler-facing notifications UI yet, so a badge would point
  nowhere (D27 counts only lead to real surfaces); header badge for trips
  (the trips card on `/account` carries that count; the header stays to the
  one actionable number); badges capped at "99+"/"9+" (mobile).

### D28 - Console cleanup deletes: notifications, enquiries, booking requests (2026-10-20)

- **Decision:** the console now offers deletion where removal is legitimate,
  refuses it where history matters, and audits every removal. New API
  endpoints (all ADMIN, all audited with the entity id retained in the audit
  row after deletion): `DELETE /api/admin/notifications/:id` for QUEUED/FAILED
  outbox records (SENT records are delivery history and reject with 409
  `SENT_RECORD_IMMUTABLE`); `DELETE /api/admin/enquiries/:id` for spam /
  personal-data cleanup (any pipeline status; audit meta keeps code, email,
  status); `DELETE /api/admin/bookings/:id` for junk package-booking REQUESTS,
  only in PENDING_PAYMENT / CANCELLED / EXPIRED (CONFIRMED, COMPLETED and
  REFUNDED are financial records and reject with 409
  `FINANCIAL_RECORD_IMMUTABLE`). Console UI: /admin/notifications gets a
  Delete action inside each row's expanded panel (skipped for SENT rows, which
  keep an honest "delivery history" note); /admin/enquiries and
  /admin/bookings get Delete buttons with `window.confirm` dialogs that name
  exactly what is destroyed; the bookings page footer explains the
  financial-record line per row. Catalog destinations/attractions, gallery
  items and packages already shipped guarded deletes with UI and stand
  unchanged.
- **API surface detail:** all three services delete via Prisma then write
  `auditLog` (actor + action + entityType + entityId + meta) - the enquiry and
  notification audit rows keep the human-readable code/email/type so activity
  pages remain meaningful after the record is unrecoverable. The bookings
  admin controller header honesty was updated: the queue stays read-only for
  STATUS decisions (payment rails decision pending), delete is data removal.
- **Tests:** new unit spec `admin-notifications.service.spec.ts` (delete
  queued/failed ok + audit, SENT refuses, unknown 404); enquiries +
  bookings unit specs gained remove blocks (audit mid-fields, refusal codes);
  int specs extend the real flows: enquiries.int deletes a guest enquiry +
  its queued notification with audit-row checks and double-delete 404s;
  bookings.int deletes the created request (traveler `/me` loses the row,
  `/users/counts` drops by exactly one), 404s the second delete, and
  verifies the financial-record guard with a CONFIRMED fixture row (deleted
  again afterwards so the suite leaves no confirmed row behind).
- **Verification:** LIVE on dev: admin-signed-in enquiry (ENQ-) -> its queued
  ENQUIRY_RECEIVED notification deleted 200 -> repeat 404; the enquiry
  deleted 200 -> repeat 404; a fresh booking request (PB-) deleted 200,
  `/me` total dropped 4 -> 3, repeat 404; anonymous deletes 401 on both
  queues; /admin/audit?action=ENQUIRY_DELETED, NOTIFICATION_DELETED and
  PACKAGE_BOOKING_DELETED each return the matching row with entityId. The
  two dev rows created by earlier failed smoke attempts (different cookie
  handling, not a product issue) were cleaned up using the new endpoints
  themselves. Unit 143/143 (18 files); integration 92/92 (11 files); API
  typecheck + lint green; web typecheck + lint green; web production build
  green (dev stopped, `.next` deleted, build, `.next` deleted again, dev
  restarted); /admin/notifications, /admin/enquiries, /admin/bookings 200.
  Honest limits: the delete buttons are client-rendered behind AdminGate, so
  route-200 checks prove the routes, not the buttons - button behavior is
  covered by the typed renders (typecheck) and the API-level live smoke of
  the exact endpoints the buttons call.
- **Deliberately NOT shipped:** admin deletion of users (suspension is the
  account mechanism; deletion needs a data-removal policy), providers
  (cascade ownership question - pending owner/liquidity-policy decision),
  any audit-trail deletion (/admin/activity stays append-only), booking
  cancel/decline status transitions (still payment-gated per D25), soft
  delete columns (nothing needs undelete; deletion paths audited instead).

### D29 - Site guide: search-listing overview page (2026-10-20)

- **Decision:** the owner shared a Bing search-results screenshot and asked
  for TravelGhana to "look similar". Rather than reshaping the branded site
  into a search engine, the agreed scope (owner-confirmed options: new page
  + branded styling) is a new `/guide` page that adopts the LISTING
  STRUCTURE in the brand: a text-first result block (small Travel Ghana
  logo + "TravelGhana" name + the real request host as the URL line, big
  green title link to `/`, two-line snippet with "Read more" -> `/about`)
  and a two-column grid of eight quick links (bold heading + one gray
  description each, no cards/borders/shadows): Destinations, Packages,
  Explore Ghana, Plan a trip, Gallery, About us, Enquire, My TravelGhana.
- **Implementation:** `apps/web/src/app/guide/page.tsx` (server component,
  `metadata` + canonical `/guide`, host from `headers()` so the URL line is
  never an invented domain), "Site guide" appended to the footer
  `FOOTER_LINKS`, `/guide` added to `/sitemap.xml` (monthly, 0.4). No
  header-nav change, no API or schema changes; pure static content.
- **Verification:** web typecheck + lint green. LIVE: `/guide` 200 with the
  H1 text, all eight section titles + hrefs, "Read more", and the host line
  `localhost:3000` (the actual request host - at launch it becomes the
  deployed domain automatically); "Site guide" appears in the footer HTML on
  `/packages`; `/sitemap.xml` contains `/guide`. Production build green
  (route table: dynamic /guide 172 B / 106 kB first load, shared chunk) with the
  mandatory cycle (dev stopped -> `.next` deleted -> build -> `.next`
  deleted again -> Turbopack dev restarted); post-restart `/`, `/packages`,
  `/admin/notifications`, `/account`, `/guide`, `/sitemap.xml` all 200 and
  all 16 requested assets return 200 (no chunk corruption). Docs entries
  D29 written in both DECISIONS.md and PROGRESS.md (ASCII-safe).
- **Notes:** dev runs `next dev --turbopack` since D28 (see infra note) -
  the page compiled in ~0.9 s, warm ~0.7 s. Honest limit: the guide page is
  fully server-rendered, so HTML checks cover everything visible on it (no
  client gating); its description copy is draft site copy, same standing as
  the rest of the site's copy (branding NOT final, homepage/branding spec
  section 12).

### D30 - Static/ISR serving: routing speed on the production path (2026-10-20)

- **Decision:** the owner asked for 10x-faster routing. The blocker was that
  every route was dynamic (f) because the root layout's footer fetched site
  settings and the gallery with `cache: "no-store"`. Both now use ISR with
  `revalidate: 60` (destinations/packages already had 300s since D-earlier).
  After the change, 34 routes are prerendered at build time (/, /about,
  /account, all /admin console shells, /packages, /gallery, /enquire,
  /trips, auth pages) and revalidate from the fetch cache; /explore,
  /destinations and the [slug] detail pages stay on-demand but ride the
  same ISR-cached data; /guide keeps its honest request-host line and
  stays dynamic by choice.
- **Measured:** BEFORE clean prod server (all dynamic SSR): warm routes
  21-45 ms each. AFTER clean prod server (static/ISR): warm routes
  5.5-12.6 ms (about 3-5x on the server). Counted against the dev surface
  the owner actually felt (Turbopack dev, warm 0.5-0.7 s per route),
  production serving is now ~50-90x faster, and static pages qualify for
  client-side Link prefetch, which removes the RSC round trip on
  navigation entirely in a real browser. Dev numbers unchanged by design
  (Next disables the route cache in development) - the speed claim is
  about production serving and real-browser navigation, NOT dev.
- **Verification:** typecheck + lint green; clean builds on both
  measurement points (prerender-manifest 34 routes); BEFORE via a prod
  `next start` on the old code, AFTER on the new code, both warm-repeat
  measured with curl. Mid-measurement hazard handled honestly: a stale
  prod server was found holding :3000 when the second server tried to
  start (EADDRINUSE), so an in-flight AFTER reading was discarded and both
  sides re-measured on clean builds; the infra rule now covers prod
  servers too. After the runs: `.next` deleted, Turbopack dev restarted,
  /, /packages, /gallery, /account, /guide all 200 and 16/16 assets 200.
- **Trade-off accepted:** admin edits to site settings (contact/social)
  and gallery publishing now surface on the public site within ~60s
  instead of instantly; destinations/packages catalog changes surface
  within ~5 minutes (pre-existing window, unchanged). No API or schema
  changes; only `lib/site-settings.ts` and `lib/gallery.ts` fetch options
  changed.

### D31 - "Curated" wording retired site-wide (2026-10-20)

- Owner request: replace the word "curated" with "created" everywhere. 25
  strings across 10 files in apps/web were swapped; the per-file list and
  reasoning live in D31 of DECISIONS.md. Grammar kept natural with verb
  phrasing where a bare participle would have read badly ("Every journey we
  create starts on the ground", "Multi-day journeys you create", "The outline
  created by TravelGhana", "..., created by TravelGhana" metadata fallbacks),
  and the packages empty state honestly says "Our journeys are being
  prepared" while the gallery empty state says "being created".
- **Verification:** zero "curated" left in apps/web/src (case-insensitive
  grep), typecheck + lint green, and six live dev routes (/, /packages,
  /about, /gallery, /guide, /packages/cape-coast-heritage-coastline) each
  returned 200 with zero "curated" in the rendered HTML and the expected
  "created" marker present. The admin dashboard hint and the account link
  were verified at source level only (client-gated HTML limits). Docs keep
  the historical "curated" wording on purpose; API source comments
  (invisible to visitors) were left as-is - no API changes.

### D32 - Sleep plans in the trip planner, leave-open allowed (2026-10-20)

- Owner ask: the planner should let travelers choose where they sleep per
  night, or leave it empty. Implemented by reusing the existing itinerary
  machinery end to end - no schema/API/validation change (see D32 in
  DECISIONS.md for the decision record). Web changes: (1) the itinerary day
  card gained a dedicated "Where to sleep - optional" block showing each Stay
  on the day with edit/remove and a night switcher, or "Not decided yet.
  Leave it open for now..." plus an "Add sleep plan" quick-add; Stay items no
  longer sit inside the Morning/Afternoon/Any-time buckets (they are not
  timed activities). (2) The item form flavors itself by type: label "Where
  to sleep", placeholder "e.g. Coastal lodge in Cape Coast", submit
  "Add/Save sleep plan", and the start/end time grid hidden for
  ACCOMMODATION entries. (3) The wizard's "One last look" step gained a
  Sleep row. (4) MISSING_ACCOMMODATION softened warning -> info with the
  copy "No sleep plans for the nights yet. Add a Stay on any day, or leave
  this open." in both trip-summary.ts (live) and the web demo-fixture copy
  (parity).
- **Verification:** web typecheck + lint green; API unit 143/143 (18 files)
  incl. the trip-summary spec (the int spec asserts the warning code, not
  the message, so the copy change is compatible); live API smoke as the dev
  admin: 2-day trip created 201, MISSING_ACCOMMODATION severity=info with
  the new message, ACCOMMODATION item added to night 1 (201), the warning
  then absent and the Stay present on the day, trip deleted 200 and a
  follow-up GET 404 (smoke row fully cleaned). /trips/[id] remains
  client-gated (HTML-verification limits): the day-card UI is compile+
  typecheck-verified plus route-200, not browser-clicked; share companion
  links show sleep plans automatically because share items pass itemType
  through.

### D33 - Neon production database wired and proven end to end (2026-10-20)

- Neon CLI 8.10.0: `neon init` linked the repo to the production project
  (branch pinned, Frankfurt) and created the neon.ts policy; AI Gateway
  removed because it is not available on the Free plan; `neon deploy`
  provisioned Postgres + Neon Auth + Object Storage (bucket "assets") +
  Functions (hello) and pulled 10 env vars into the root .env.
- Wiring: schema.prisma gained `directUrl` (DATABASE_URL_UNPOOLED);
  packages/database/.env now holds the Neon DIRECT pair for CLI/seed traffic
  while the runtime keeps the POOLED URL; the consolidated baseline migration
  `0001_baseline` replaced the legacy never-applied `0001_listing_model`;
  `migrate deploy` + `migrate status` green; seed complete (16 regions,
  19 cities, 20 destinations, 5 attractions).
- **Verification:** regions read via the API 200 (pooled connection); full
  auth + trip loop on Neon: register 201 -> ConsoleMailer link -> verify 200
  -> login (DB session row) -> trip 201 with the soft D32 warning -> stay
  item 201 -> warning gone -> trip DELETE 200 / GET 404; smoke user then
  cascade-deleted (users 0 / sessions 0 / trips 0). Functions hello endpoint
  200 with its message; object storage upload/download/delete roundtrip
  byte-identical; Neon Auth JWKS 200 (unused by the app, documented); 
  `npm run build` 3/3 green (2m29s) with the D30 route split intact;
  typecheck 7/7; lint 10/10; API unit 143/143; pages /, /packages,
  /destinations, /about all 200 with Neon-sourced content.
- New `db:inspect` utility prints row counts; .env.example documents the
  Neon vars. Dev servers now run against the production DB (console actions
  are production actions); the admin is bootstrapped from ADMIN_EMAIL/
  ADMIN_PASSWORD as soon as the owner supplies real credentials; weekly
  backup: pg_dump "<DATABASE_URL_UNPOOLED>" --format=custom -f
  travelghana-YYYYMMDD.dump. Details: D33 in DECISIONS.md.

- **Admin bootstrap activated on production (2026-10-20).** The owner supplied real
  ADMIN_EMAIL/ADMIN_PASSWORD in the root .env (Option B self-edit; password never
  printed anywhere, temp payload file deleted after use). API restart -> the
  onModuleInit bootstrap created the ADMIN user in Neon (name "TravelGhana Admin",
  scrypt-hashed password, emailVerifiedAt set, ADMIN membership). Proof: admin login
  200 with tg_session; GET /api/admin/stats 200; GET /api/admin/users 200 (1 user).
  Other side of the guard: a fresh traveler register 201 -> verify-email 200 ->
  GET /api/admin/stats 403 FORBIDDEN (RBAC enforced). Finding documented along the
  way: login does NOT gate on emailVerified by design (anti-enumeration; password +
  not-suspended is enough to issue a session; verified flag is a trust marker).
  Production DB now holds exactly 1 user (the real admin) + 1 session; catalog
  16/19/20/5 unchanged; smoke rows deleted.
- **Forgot-password reached from the UI (2026-10-20).** The reset machinery already
  existed end to end (API forgot-password/reset-password with hashed single-use
  tokens, silent success to defeat account enumeration, 1h expiry, all sessions
  revoked after a reset; web /forgot-password + /reset-password pages) - but the
  login form never linked to it, so the flow was only reachable by typing the URL.
  Added the "Forgot your password?" link on the login form (login mode only) in
  auth-form.tsx. Live proof on the production DB with a throwaway traveler:
  login with the original password 200; forgot-password 200 for BOTH an existing
  and an unknown email with identical bodies (no account enumeration); paired
  reset link extracted from the dev console mailer; reset-password 200 ("Password
  updated - please log in"); login with the NEW password 200; login with the OLD
  password 401. Throwaway deleted afterwards - production back to exactly 1 user
  (the real admin). Web typecheck + lint green; /login HTML renders the link.
  Note: emails still arrive via the dev ConsoleMailer (server console) - a real
  delivery provider (Brevo) remains the planned next mail step.
- **Transactional mail wired: BrevoMailer live (D34, 2026-10-20).** The owner
  created the Brevo account and mounted a real API key; I implemented
  `BrevoMailer` + the `buildMailer()` provider factory (MAILER_PROVIDER
  console|brevo, boot-time selection line), never-throw failure tolerance
  with masked-recipient logging, a 10s AbortSignal timeout, and 9 new unit
  tests (152 total) pinning the contract. Live: API boots with "Mailer
  provider: brevo"; register + forgot-password return 200/201 with a
  genuinely failing HTTP path and with Brevo's real key. Brevo's event log
  shows both messages accepted then internally rejected because the FROM
  address (noreply@travelghana.test) is not a verified sender - an
  asynchronous rejection invisible to the API (documented in D34). One
  owner step remains: confirm the gmail sender in Brevo, then point
  MAIL_FROM_EMAIL there and send a real password-reset mail to the admin
  inbox as the end-to-end receipt.
- **Verified-sender loop closed (2026-10-20, later same day).** The owner
  clicked Brevo's confirmation link (senders API then showed exactly one
  active sender); MAIL_FROM_EMAIL was repointed from the placeholder to the
  verified gmail (read from Brevo's API, never printed to output). End-to-end
  receipt: a real password-reset email for the admin account delivered to the
  owner's Gmail - Brevo events: requests 23:42:19 -> delivered 23:42:21
  (~2 s). Free-plan envelope detail: email "from" domain displays as
  12532054.brevosend.com (Brevo's shared relay below the friendly From =
  verified gmail); SPF/DKIM on the app's own domain arrives with domain
  purchase (OPEN_QUESTIONS #9). Two earlier 400s on the admin reset attempt
  were my PowerShell parsing of the owner-edited ADMIN_EMAIL line (trailing
  characters), fixed with a regex extraction - the API was never at fault.
  Brevo's retry pipeline also re-attempted one old invalid-sender message on
  its own (23:39:15) - automatic, no API involvement. Dev note: with
  MAILER_PROVIDER=brevo live in dev, further dev flows will attempt real
  sends; .test throwaway addresses will bounce harmlessly in Brevo. Grep of
  the API log after delivery: zero mailer warnings (silent success path).
- **Lifecycle emails redesigned: 6-digit code + fallback link + HTML template
  (D35, 2026-10-21).** Verification and reset emails now lead with a
  cryptographically random 6-digit code (hashed at rest on the same record
  as the deep-linked token; migration 0002_email_code deployed to Neon) and
  keep the link as a secondary affordance. New endpoints verify-email-code
  and reset-password-code (invalid code + unknown email share one
  INVALID_CODE shape; sentinel lookup). Shared inline-styled HTML template
  in Ghana Green with plain-text twin and code-carrying preheader.
  /verify-email and /reset-password handle both link and no-link (code)
  modes. Live: full register->verify and forgot->reset cycles against
  production Neon via console provider; unit 159/159; typecheck + lint
  green; smoke users removed (production still exactly the real admin).

- **Booking + trip-plan emails and the admin outreach panel (D36,
  2026-10-21).** Mail became a shared module (modules/mail) used by auth,
  bookings, enquiries and the trip planner. Booking receipts, trip-plan
  acknowledgements and admin notice copies of new booking requests are
  automatic; the /admin/bookings console can acknowledge, raise concerns
  and confirm/cancel payment-pending requests, each audited, notified and
  emailed. Live smoke on production Neon walked every leg through the
  console mailer (receipt + admin copy, acknowledge, concern, cancel
  decision, trip plan acknowledgement); smoke rows cleaned up afterwards
  (production again exactly 1 real admin). Decisions stay scoped to
  payment-pending rows (409 otherwise) and the confirm path is
  unit-proven only, since a live CONFIRMED row cannot be deleted. Unit
  165/165; typecheck + lint green; clean turbo build 3/3.
- **Tunnel preview fix + mobile admin console (D37, 2026-10-22).** The
  shared dev-tunnel preview now works for friends' browsers: the web app
  proxies /api/* to the API server-side (next.config rewrite, relative
  client base, first-party cookies), so the API port stays closed and cookie
  behavior is unchanged. Verified /api/health, catalog reads and a genuine
  401 through the tunnel URL. All 16 admin pages were audited for small
  screens; three real fixes shipped (scrollable admin nav, smaller bookings
  heading, tap-sized action buttons). Owner housekeeping: put port 3000 back
  to Private when the preview closes; do not forward port 4000.

- **Visitor insights, first-party (D38, 2026-10-26).** Zero budget, no
  third-party analytics: browsers send page views and booking/enquiry action
  events to our own POST /api/track (public, rate-limited, zod-capped, and
  never throwing into page UX), where signed-in requests are correlated to
  their user. Privacy at the source: no query strings, referrer origins
  only, bots and /admin dropped client-side. Production Neon hosts the
  PageView table (migrations 0003 plus corrective 0004 with userId nullable
  so anonymous visitors fit the SET NULL FK). /admin/insights shows KPIs, a
  visit-to-booking funnel whose final step is counted from the PackageBooking
  table (client events cannot inflate it), top paths/origins/devices, and a
  session timeline inspector that ends with "session ended here"; the
  dashboard shows sessions in the last 24h and the console nav gains
  Insights. Live-verified: valid and invalid tracking payloads, a
  tunnel-origin POST, and the exact aggregate SQL against Neon; smoke rows
  cleaned (table back to 0). Not verifiable without a browser: the recorder
  and the insights UI in real use - owner should browse the public site,
  then open /admin/insights. Honest limits: no scroll depth or heat maps,
  cleared storage reads as a new visitor, 90-day retention cleanup is future
  work. Unit 170/170; typecheck + lint green; clean turbo build 3/3.
- **Password-reset flow made usable from the shared preview (D39, 2026-10-26).** The reset page's no-link code entry (D35) was hidden: the forgot-password "email sent" state now links directly to it ("Enter the 6-digit code") and states the 1-hour expiry, and WEB_APP_URL is ordered tunnel-origin first so emailed reset links open through f8w4fzr3-3000.uks1.devtunnels.ms for friends and the owner alike (localhost/LAN stay in the CORS list). Env ordering is a preview-era setting to revert at Phase 2 hosting and to redo when the tunnel URL changes; forgot-password verified 200 for the real admin, email receipt owner-confirmed. Login/register breakage earlier that day was only the dead API dev process (restarted; 401/201 verified through the tunnel).
- **Feature program Phase 1 shipped (D40, 2026-10-26).** Nine owner-picked features broke into phases; Phase 1 landed additively with no migrations: the traveler inbox (/api/notifications over the existing Notification outbox rows, header bell with unread badge, /account/notifications with mark one/all read), site search (/search page plus header and mobile-nav entries over destinations, tours, experiences and curated packages), SEO structured data (Organization + WebSite + SearchAction sitewide, Product and BreadcrumbList on package pages, canonical base via NEXT_PUBLIC_SITE_URL in apps/web/.env.local - web never reads the root .env), and the WhatsApp affordances (floating button plus package CTA via wa.me, both render nothing until the number is set in /admin/settings). Verified: unit 175/175, typecheck/lint/build green, inbox + search smoke through both the localhost proxy and the tunnel with throwaway rows cleaned to baseline. Owner moves: set the real WhatsApp number to reveal the chat buttons; browse as a traveler to see the bell and inbox; publish packages so search covers journeys. Phases 2-4 (reviews, availability, listing requests, manual payments MoMo+bank, managed uploads) are specced and queued; nothing committed.
- **Feature program Phase 2 shipped (D41 + D42, 2026-10-26).** Availability and reviews landed together on one additive migration (0005 on Neon: PackageDeparture, nullable PackageBooking.departureId, PackageReview - nothing else touched). Admins put explicit departure dates with seat counts on a package editor card (plus a weekly repeat up to 12); once a package has future departures the booking form becomes a departure picker with seats-left labels and the API refuses open-dated (DEPARTURE_REQUIRED), past, or over-capacity requests (DEPARTURE_FULL); remaining seats are derived from live bookings so cancelling releases seats automatically, seat cuts/deletes that would strand bookings are refused. Reviews are gated on a team-CONFIRMED booking (REVIEW_NOT_UNLOCKED otherwise), one per traveler per package, always PENDING until /admin/reviews approves (reject keeps a required written reason; decisions audited, immutable once made); the package page shows approved reviews plus the star average and gains aggregateRating in JSON-LD only from real approved data. Verified: 195/195 unit, typecheck/lint/build green, and a full live smoke on a seeded throwaway package (departures list, seat math 4 to 2 after a real request, all gate rejections observed, review submit/hold/duplicate/status/unconfirmed 403, SSR page + JSON-LD correct) cleaned back to baseline. Owner moves: add departures on a real package and publish it; watch the review queue once real bookings confirm. Nothing committed.

- **Feature program Phase 3 shipped (D43 + D44, 2026-10-26).** Quote-only transport listing requests and manual payments on one additive migration (0006 on Neon: ListingBooking, PackageBooking.paidAt, SiteSettings.momoInstructions/bankInstructions - nothing else touched). Because the reusable Listing model had no public surface, a small one ships: /api/catalog/transport (+ detail by provider/listing slug) serves PUBLISHED listings from transport providers only (TRANSPORT_COMPANY, DRIVER_PARTNER) with every price field excluded, rendered on new /transport browse and detail pages (detail carries the request panel; /transport joined the sitemap). Signed-in travelers POST /api/listing-requests (code TB-XXXXXX; published + transport-owned 404 guard, party-above-capacity 409, future-date validation) -> the /admin/transport queue (nav badge + dashboard counter listingRequestsPending) sends the written quote by email and keeps it on the row (quoteNote/quoteAt) so the traveler re-reads it on /account; confirm/cancel close the conversation (REQUEST_STATUS_IMMUTABLE after), delete is audited ops cleanup. Manual payments: the admin settings form gained a "Payments (manual)" section (MoMo + bank transfer blocks, merged verbatim into booking confirmation emails with the booking code as reference - the platform adds no amounts anywhere), and /admin/bookings gained "Mark paid" on confirmed rows (paidAt once, audited PACKAGE_BOOKING_PAID, short "Payment received" email, status untouched; traveler /account card shows it). Discovery quirk documented: Listing has cityId without a relation, so transport browse filters on free text only. Verified: 210/210 unit tests, all typecheck/lint/build gates green, and a 30-check live flow on throwaway rows (catalog list+detail without prices, 401/409/400/404 guard behavior, TB- mint, admin quote/decision/second-decision-409, markPaid trials, SSR page, paidAt on /bookings/me) cleaned to a true zero baseline including the settings row. Watch-outs hit and handled during the phase: an orphaned nest-watch child kept holding :4000 after an OOM crash (kill by port), and running `next build` under a live dev server corrupted its turbopack chunks (stale chunk 500s - servers must restart after every build). Owner moves: fill the "Payments (manual)" section in settings, confirm the first real transport request through /admin/transport, try the /transport page in the tunnel. Nothing committed.
- **Feature program Phase 4 shipped (D45, 2026-10-26).** Managed uploads landed behind a storage abstraction with no migration: POST /api/admin/uploads (admin-only multipart, JPEG/PNG/WebP/GIF/AVIF whitelist, 5 MB cap, multer memory storage) mints gallery/<24hex>.<ext>, writes via a StorageDriver (local-disk dev driver under gitignored apps/api/uploads by default; unknown STORAGE_DRIVER values fail fast at boot, and the production provider - Cloudinary/Supabase - is only a future driver class until the owner picks one and provides keys), audits UPLOAD_STORED, and answers a first-party /api/uploads/<key> URL that Next's existing same-origin proxy serves byte-exact with a content type derived from the key and an immutable cache header - localhost, LAN and the tunnel all resolve it with no new rewrite or env. GalleryItem.imageUrl accepts the platform path alongside external https URLs (javascript:/data: refused by the shared schema), the admin gallery editor gained an upload picker that fills the URL field (paste-a-link still works), and deleting a gallery row deliberately keeps the object. Verified: 229/229 unit tests (+19 new), typecheck/lint/build green (47 routes), and a 31-check live flow on a throwaway user (auth gates, minted keys, byte-exact anonymous serving, unknown/traversal 404 misses, text/empty/oversize rejections, gallery round-trip with public list visibility, backward-compatible external URLs, audit rows, SSR /gallery, delete-keeps-file semantics) cleaned to a true zero baseline including the files on disk. Owner moves: the picker works immediately for real gallery photos; still to decide before production volume is the photo host (OQ16), which is a driver swap, not a refactor. Nothing committed.
