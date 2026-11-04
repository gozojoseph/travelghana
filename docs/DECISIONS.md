# Decision Log

Format per Â§55: Decision / Date / Reason / Alternatives considered / Consequences.
Dates: 2026-10-01.

---

## D1. Payment collection â€” Platform merchant of record
- **Decision:** Traveler always pays TravelGhana (Paystack first). Platform owes providers via a
  payout ledger (`Payment â†’ Transaction â†’ Refund`, `Commission`, `ProviderPayout`).
- **Date:** 2026-10-01
- **Reason:** Single payment flow; easiest refunds, disputes, commission control; strongest
  traveler trust and cleanest ops story.
- **Alternatives:** Paystack subaccount auto-split; providers collect themselves (rejected â€”
  weak control, poor trust).
- **Consequences:** Payout workflow + ledger reconciliation is a platform obligation; payments
  module must track platform liabilities per booking. Paystack subaccounts NOT required at MVP.

## D2. Currency â€” Charge in GHS, USD display estimates
- **Decision:** All charges denominated in GHS (minor units). USD shown as display estimates for
  international travelers. `currencyCode` columns retained everywhere; multi-currency later
  without migration pain.
- **Date:** 2026-10-01
- **Alternatives:** GHS-only display; multi-currency day 1 (rejected â€” complexity).
- **Consequences:** Need a rates strategy (manual admin rates to start, FX API later); Money
  must never mix display-converted and charge-converted amounts.

## D3. Roles â€” One account, many roles (recommended by Buffy; confirm)
- **Decision:** RBAC with role membership table so one `User` can hold several roles
  (traveler + driver, hotel manager + tour operator) with a role switcher.
- **Date:** 2026-10-01
- **Reason:** Realistic for Ghana's market (guides who drive; providers who travel). Chosen by
  Buffy under delegation ("recommend").
- **Alternatives:** One role per account (rejected â€” forces duplicate accounts).
- **Consequences:** Every permission check scoped per role; UI needs role-switch affordance.
- **Status:** CONFIRMED by you â€” 2026-10-02.

## D4. Maps â€” Mapbox first, behind an abstraction
- **Decision:** Mapbox for map UI, geocoding, directions. All map access via a `MapsAdapter`
  interface so the provider can be swapped.
- **Date:** 2026-10-01
- **Alternatives:** Google Maps Platform (cost); Leaflet + OSM (data/styling).
- **Consequences:** Mapbox token required in env; adapter keeps us free to add Google later.

## D5. Launch model â€” Operator-first marketplace (recommended by Buffy; confirm)
- **Decision:** MVP ships with TravelGhana ops creating/managing vetted inventory through Admin.
  Provider self-onboarding/verification portal moves to Phase 2.
- **Date:** 2026-10-01
- **Reason:** Fastest path to validating the traveler experience; the data model stays
  marketplace-shaped (Provider-owned services) so nothing needs rewriting.
- **Alternatives:** Marketplace day 1 (rejected for MVP â€” doubles scope).
- **Status:** CONFIRMED by you â€” 2026-10-02.

## D6. Custom trip enquiries â€” Concierge team
- **Decision:** Enquiries go to a TravelGhana ops (concierge) workflow; ops builds the itinerary
  and coordinates providers. Enquiry may convert into a Trip.
- **Date:** 2026-10-01
- **Alternatives:** Broadcast to providers; ops triage + optional providers (Phase 2+ option).
- **Consequences:** Admin needs an enquiry queue workflow; SLA/response expectations to define.

## D7. Monorepo & tooling (Buffy, recommended)
- **Decision:** pnpm + Turborepo; Next.js web + admin, NestJS API (modular monolith), shared
  packages (ui, database, types, validation, config). Sessions via httpOnly cookies (Redis).
- **Alternatives:** npm/yarn; single app; JWT tokens.
- **Consequences:** Standard workspace tooling; JWT can be added later for the mobile era.

## D8. Money representation (Buffy, recommended)
- **Decision:** All monetary amounts stored as integer minor units (Ghana pesewas) with an
  explicit `currencyCode`; conversion to display strings only at the UI edge.
- **Alternatives:** Decimal strings; floats (never).
- **Consequences:** Formatting helpers required in packages/ui; no float arithmetic anywhere.

## D9. Temporary assumptions (documented, not user-confirmed)
| Topic | Temporary assumption | Change when |
|---|---|---|
| Hosting | Vercel (web/admin) + managed Postgres/Redis (e.g. Railway/Render) | deployment phase |
| Payments provider | Paystack first; Flutterwave second via same adapter | before live payments |
| Auth | Email+password, email verification, reset; social login later | Phase 2 |
| Storage | Cloudflare R2 (S3-compatible) for media later; placeholders now | media module |
| FX display | Manual admin-set USD rates at MVP | Phase 2 |
| Timezone | Africa/Accra for business-day logic | never likely to change |
| Search | Postgres full-text first; Meilisearch later | scale requires it |

## D10. Local dev database â€” embedded Postgres (temporary)
- **Decision:** Local development uses an embedded Postgres 17 on localhost:5432
  (`infrastructure/local-db.mjs`, data dir `node_modules/.local-postgres/data`) instead of
  Docker Compose. `infrastructure/docker-compose.yml` is kept for machines where Docker works.
- **Date:** 2026-10-03
- **Reason:** Docker Desktop is installed but its engine fails (500) because WSL is not
  installed on this machine; installing WSL requires admin + reboot, which is the product
  owner's call. Embedded Postgres was the least-invasive way to get a real database.
- **Alternatives:** Install WSL/Docker (blocked â€” needs admin/reboot); SQLite (rejected â€”
  must validate against Postgres semantics).
- **Consequences:** Dev DB is wiped/recreated via `prisma db push`; team members with working
  Docker should use the compose file. Remove this workaround once WSL/Docker is available.

## D11. Operator MVP scope â€” tours + experiences, four onboarding types (Buffy, recommended)
- **Decision:** Operator self-service covers provider onboarding (one provider per account,
  1:1) plus Tour and Experience listing CRUD with publish/unpublish. Onboarding types are
  limited to those with a matching `Role`: TOUR_OPERATOR, HOTEL, EXPERIENCE_PROVIDER,
  TRANSPORT_COMPANY. Hotels (rooms), transport (vehicles/drivers), events, restaurants and the
  public catalog ship in later increments. Added `AnyRole` decorator (any-of authorization)
  alongside the all-of `@Roles`.
- **Date:** 2026-10-03
- **Reason:** Tours and experiences share one shape (title/price/city/published) â€” smallest
  slice that makes the marketplace two-sided. DRIVER_PARTNER belongs to the driver module;
  EVENT_ORGANIZER/RESTAURANT have no RBAC role yet.
- **Alternatives:** All listing types day 1 (rejected â€” large surface, thin value); all-of
  role check per route (rejected â€” would force operators to hold every operator role).
- **Consequences:** Operators self-publish at MVP (open question #11 covers whether admin
  verification should gate that); slug generation is name/title-based with numeric suffixes;
  ownership scoping returns 404 (no existence oracle) for foreign listings.

## D12. Trip planner â€” frontend-first over an async `TripsSource`, owner-private needs (Buffy, recommended)
- **Decision:** The trip + itinerary increment ships in three phases: **A** demo UI (now) over
  fixtures in `localStorage` behind an async `TripsSource` interface; **B** NestJS `trips`
  module reusing the same shared zod schemas/DTOs; **C** web swaps to `api-source` via
  `NEXT_PUBLIC_TRIPS_SOURCE=demo|api` and restores auth.
  Day rules: generating from trip dates (cap 30 days), append on extension, never auto-delete,
  delete only empty days (renumber the rest), and shifting `startDate` moves existing day dates
  and item times by the same delta. Dates are `YYYY-MM-DD` at UTC midnight. UI item types:
  ATTRACTION, RESTAURANT, EVENT, NOTE, TRANSPORT (`BOOKING` stays disabled until the booking
  engine). Reorder is up/down buttons (keyboard-accessible), not drag-and-drop. Travelers and
  sensitive needs are created owner-private â€” no provider visibility or consent until sharing
  ships.
- **Date:** 2026-10-19
- **Reason:** Owner-directed frontend-first sequencing â€” validate the planner UX before paying
  for API + auth wiring; the shared schemas written now are the Phase B contract, so no UI
  rework. Owner-private needs keeps Â§11 sensitive data strictly with the traveler until the
  sharing rules are designed.
- **Alternatives:** API-first (rejected â€” slower feedback on a UX-heavy feature); shipping
  demo data as throwaway mocks (rejected â€” the `TripsSource` seam makes Phase C a swap, not a
  rewrite); drag-and-drop reorder (rejected â€” extra dependency for marginal MVP value);
  auto-deleting days when dates shrink (rejected â€” silent data loss).
- **Consequences:** Demo trips are per-browser and disposable; Phase B must mirror the source
  interface (owner-scoped CRUD, foreign/missing IDs â†’ 404). Needs stay invisible to providers
  until questions #13/#14 are answered. `BOOKING` items and sharing/booking handoff are
  deferred to the booking engine increment.

## D13. Shared packages: TS source for bundlers, compiled `dist` for the Node API (Buffy, recommended)
- **Decision:** `@travelghana/validation` exposes conditional entries â€” `types`/`import` point
  at `src/index.ts` (Next `transpilePackages` and Vitest keep consuming source), `require`
  points at `dist/index.js`, built by `tsc -p tsconfig.build.json`. The API `build` and
  `start:dev` scripts build the package first.
- **Date:** 2026-10-19
- **Reason:** The API compiles to CommonJS and runs on Node; its `require` of the TS-source
  package hit extensionless ESM imports and crashed at boot (`ERR_MODULE_NOT_FOUND`) â€” the API
  could compile and pass tests but never start. Bundlers already handle the source, so a build
  step for web dev is unnecessary.
- **Alternatives:** Pointing `main` at `dist` for everyone (rejected â€” forces a validation build
  before `next dev`); running the API through ts-node/tsx (rejected â€” decorator metadata and
  production `node dist/main` still broken); bundling the API with webpack (rejected â€” heavier
  config for the same result).
- **Consequences:** `packages/validation/dist` is a runtime artifact (gitignored) produced
  automatically by the API scripts and by `turbo build` (`^build`). Changes to validation while
  the API watcher is running require a rebuild + API restart. New shared packages with runtime
  code should follow the same dual-entry pattern; type-only packages can stay source-only.

## D14. Motion â€” CSS-only entrances, staggered lists, reduced-motion respected (Buffy, recommended)
- **Decision:** UI motion is CSS/Tailwind only (`fade-in`, `rise`, `pop` keyframes) â€” no animation
  library. List/grid children use the `.tg-stagger` utility (50 ms cascade, capped at 8).
  Entrances use `animation-fill-mode: backwards` so completed animations never pin `opacity` or
  `transform` over hover styles. A global `prefers-reduced-motion: reduce` rule collapses
  animation and transition durations.
- **Date:** 2026-10-19
- **Reason:** Micro-interactions make the planner feel responsive (cards, forms, loading states)
  without adding bundle weight or a React animation runtime. `backwards` fill avoids a subtle
  bug where a finished `translateY` entrance blocks card hover lift. Motion is decoration, so it
  must never fight accessibility settings.
- **Alternatives:** Framer Motion (rejected â€” dependency weight for entrances only); CSS
  transitions on data change (rejected â€” no mount animation for new list items); `both` fill
  mode (rejected â€” persists the end transform and breaks hover transforms).
- **Consequences:** New UI should reuse the three animation utilities and `.tg-stagger`; entrance
  animations must stay subtle (â‰¤ 0.5 s) and must not encode information. Page transitions rely on
  per-section entrances, not a root `template.tsx` (which would remount the trips auth gate on
  every navigation).

## D15. Curated packages â€” admin-managed editorial product, not provider inventory (Buffy, recommended)
- **Decision:** Add platform-owned `Package` + `PackageDay` models for multi-day curated journeys:
  title/slug, optional destination, duration (days/nights), from-price in minor units, hero image,
  summary/description, inclusions/exclusions, featured flag, and `DRAFT | PUBLISHED | ARCHIVED`
  status. ADMIN-only CRUD via `/api/admin/packages` and `/admin/packages` in the web app. The
  day-by-day outline is editorial text and is replaced as a set on update. Packages are not
  bookable, have no public catalog page yet, and no provider can own or edit them. The
  half-finished `@db.Uuid` annotations were dropped so ids stay cuid/text and the schema
  validates again (resolves OPEN_QUESTIONS #15).
- **Date:** 2026-10-19
- **Reason:** The marketplace already has provider inventory (tours, experiences, listings) but no
  platform-curated product. A multi-day package is a different sales shape â€” the outline is the
  product â€” and admins need to author it without inventing provider accounts. Keeping it separate
  from `Listing` avoids pretending editorial content is bookable inventory before availability
  and package pricing exist.
- **Alternatives:** Bundle existing tours/experiences via a join table (deferred â€” useful once
  booking/composition rules exist, but it would not give admins an outline to write today);
  simple single-record product with no itinerary (rejected â€” the multi-day outline is the point);
  reuse `Listing` with a platform provider (rejected â€” wrong ownership/lifecycle semantics and a
  hacky extension payload); finish the uuid migration first (deferred â€” no functional benefit for
  this increment and a 47-model migration).
- **Consequences:** Publish/unpublish controls visibility only; booking, availability, per-person
  pricing and a public package catalog/SEO remain future increments. Deleting a package cascades
  its outline days. The admin UI is gated client-side for UX and enforced server-side by the
  `ADMIN` role. Any future uuid migration must include `Package`/`PackageDay` and the existing
  cuid/text ids.
  **Update (2026-10-19):** the published-only public catalog/SEO surface shipped in D16; booking,
  availability and per-person pricing remain deferred.

## D16. Public package catalog â€” published-only read surface, still not bookable (Buffy, recommended)
- **Decision:** Expose curated packages publicly through `GET /api/packages` and
  `GET /api/packages/:slug`, plus `/packages` and `/packages/[slug]` in the web app. Only
  `PUBLISHED` packages are visible; drafts and archived packages return 404. The public list is
  ordered featured-first, then newest-published. Published package pages are linked from the top
  nav (and a mobile header link), the home page (up to three), and the sitemap. Booking,
  availability, departure dates and payment remain out of scope.
- **Date:** 2026-10-19
- **Reason:** Admin-authored packages had no traveler-facing surface. Publishing is already the
  editorial visibility switch, so exposing exactly that status is the smallest safe read model:
  users can browse journeys while admins keep a private draft workspace. Server-rendered pages
  give SEO and stable shareable URLs without introducing a booking flow.
- **Alternatives:** Public access to all statuses (rejected â€” drafts are unfinished editorial
  work); admin-only preview links (deferred â€” useful for review, not discovery); client-side fetch
  (rejected â€” weaker SEO/first paint); making packages bookable now (rejected â€” no availability,
  departures or per-person pricing model yet).
- **Consequences:** Publish/unpublish is the visibility control; unpublishing intentionally breaks
  shared links with a 404. Package detail content is editorial, not availability. Future booking
  work must add departure/availability and price rules. Hero images are arbitrary admin URLs
  rendered without the Next image optimizer, so media upload/storage remains a separate
  increment.

## D17. Gallery + About â€” admin-curated images with a published-only public page (Buffy, recommended)
- **Decision:** Add a platform-owned `GalleryItem` model (title, caption?, imageUrl, category?,
  location?, sortOrder, `published` boolean) with ADMIN-only CRUD via `/api/admin/gallery` and
  `/admin/gallery`, plus a public, unauthenticated `GET /api/gallery` and `/gallery` page that
  exposes published items only, ordered by `sortOrder` then newest. Add a static `/about` page,
  link both from the desktop nav, homepage and sitemap, and add Packages/Gallery tabs to the admin
  console. Images cross the wire as URLs â€” there is no upload/storage pipeline yet.
- **Date:** 2026-10-19
- **Reason:** The catalog had destinations and curated packages but no "why us" story and no
  visual surface for Ghana photography. A small editorial model keeps authoring cheap (paste a
  URL, write a caption) while a published-only read preserves a private draft workspace, mirroring
  the package pattern (D15/D16). A plain boolean is enough for single-surface, low-stakes content
  â€” no `ARCHIVED` lifecycle or review queue is needed.
- **Alternatives:** Reuse `Listing`/attraction media (rejected â€” the gallery is editorial, not
  bookable inventory); hardcode images in the web app (rejected â€” admins could not curate);
  upload/storage pipeline now (deferred â€” needs object storage and media processing; URL-only
  unblocks curation); per-image public detail pages (rejected â€” the gallery is one visual surface).
- **Consequences:** Gallery media is externally hosted, so broken links are possible until managed
  storage ships (OPEN_QUESTIONS #16). Unpublishing or deleting hides an item from `/gallery` and
  the homepage teaser immediately because the public gallery read is uncached (the homepage is
  rendered dynamically as a result). Category is free text used for client-side filters, so
  typos create new filter chips. No booking or commerce semantics. Any public surface may show
  gallery content, so future media work must include `GalleryItem`.

## D18. Trip planner core â€” preferences, unscheduled ideas, listing-snapshot estimates, derived summaries (Buffy, recommended)
- **Decision:** Upgrade the trip planner (D12) to the Phase 1 production core:
  1. **Planner preferences on `Trip`** â€” wizard-captured signals (`interests[]`, `travelPace`,
     `budgetTier`, `budgetType`, `budgetIncludesFlights`, `arrivalPoint`,
     `destinationPreferences[]`) stored with safe defaults so pre-wizard trips and API-created
     trips stay valid.
  2. **Trip-level unscheduled items** â€” `ItineraryItem.itineraryDayId` became nullable; rows
     with a null day are the traveler's "ideas tray", reorderable and schedulable later.
  3. **Estimates, not prices** â€” items carry `estimatedCostMinor`/`currencyCode`/`pricingBasis`
     (`PER_PERSON|PER_GROUP|PER_NIGHT|PER_SERVICE|TOTAL`)/`estimateSource`
     (`LISTING|MANUAL`)/`priceSnapshotAt`. Adding a listing-linked item snapshots its published
     price at that moment (`pricingBasis` default `PER_SERVICE`); editing the numbers converts
     the estimate to `MANUAL` and the server must never overwrite a traveler's own estimate.
     Items priced in a currency other than the trip's are excluded from totals and surface a
     `CURRENCY_NOT_CONVERTED` warning â€” no FX conversion is ever invented.
  4. **Derived summaries** â€” budget totals, per-person math and planner warnings
     (`TRIP_DATES_MISSING`, `DAY_OVERLOADED`, `TIME_OVERLAP`, `UNSCHEDULED_ITEMS`,
     `MISSING_ACCOMMODATION`, `MISSING_TRANSPORT`, `ITEMS_WITHOUT_PRICE`,
     `CURRENCY_NOT_CONVERTED`) are computed by a pure, unit-tested `computeTripSummary` in the
     API on every read â€” never stored. The demo source mirrors the same rules in
     `apps/web/src/lib/trips/summary.ts`.
  5. **Times stay honest** â€” the trip's items can be scheduled per day with optional
     start/end times; moving an item between dated days rebases stored timestamps onto the
     target date, while moving to an undated day or the tray clears the times (no invented
     anchors). Pace is a heuristic: day-load limits (RELAXED 3 / BALANCED 5 / PACKED 7 timed
     items) warn instead of blocking; overlaps only warn when both times exist.
  6. **Entry & guest flow** â€” `/plan-my-trip` is the planner entry (hero, 4-step wizard, saved
     trips); `/plan` and `/trips/new` redirect there. Guests can use the wizard without an
     account: creating the trip stores a short-lived `sessionStorage` draft and hands off to
     `/login?next=â€¦`; after sign-in the wizard restores the draft.
  7. **Honest booking handoff** â€” there is still no booking engine or confirmation state; the
     summary panel shows estimates, warnings and accessible stops (no maps/routes until a Mapbox
     token exists â€” D4 fallback is the ordered-stops list). The `Enquiry` model (D6) exists in
     the schema but has no API yet; enquiry capture and sanitized sharing are Phase 2, and
     booking/payments remain Phase 4 (D1) pending keys and a booking engine.
- **Date:** 2026-10-19
- **Reason:** The D12 planner proved the data model but made no room for *how* people actually
  plan: interests, how packed they like days, how budgets are stated, and half-formed ideas that
  belong somewhere before they have a day. Real inventory (D5/D11) also enabled real "add to my
  trip" discovery, which demands an honest estimate model: a snapshot that cannot silently
  mutate into a confirmed price. Deriving summaries on read keeps the trip graph the single
  source of truth and keeps the rules unit-testable.
- **Alternatives:** Store summaries/budget rows (rejected â€” stale caches and two truths);
  live-quote discovery estimates from listings on every render (rejected â€” displays become
  network-coupled and price drift untracked); require times for scheduling (rejected â€”
  travelers plan loosely); hard-block overpacked days (rejected â€” pace is a suggestion);
  convert foreign-currency estimates with a hardcoded rate (rejected â€” invented data);
  anonymous server-side trip drafts instead of `sessionStorage` (rejected for MVP â€” needs a
  storage/garbage-collection design; deferred to Phase 2 as a transfer question,
  OPEN_QUESTIONS #18).
- **Consequences:** Listing snapshots can drift from the listing's current price â€” the UI must
  keep saying "estimate at add time", and re-pricing logic (or re-snapshot on edit) is a
  Phase 2+ need. `CURRENCY_NOT_CONVERTED` means budgets can look understated when a traveler
  mixes currencies â€” acceptable while inventory is GHS-only in practice. The demo source must
  stay in lockstep with API summary rules (two implementations of one truth â€” kept in sync by
  tests and by labeling them in PROGRESS). Budget `PER_PERSON` vs `PER_GROUP` normalization
  happens only in the summary, so budget entries stay as-typed even after people edit them.
  Discovery in demo mode exposes Places only â€” live tours/experiences/packages discovery needs
  the API-backed planner. Stays, restaurants, events and transport discovery surface in the
  planner only when their inventory phases land (Phase 3).

## D19. Phase 2 - trip sharing (sanitized companion view), concierge enquiry capture, on-device guest draft (Buffy, recommended)
- **Decision:** Three increments land together as the Phase 2 layer between "you can plan" and
  "you can book" (which stays Phase 4):
  1. **Trip sharing = a sanitized, token-gated companion view (this resolves OPEN_QUESTIONS #13).**
     `TripShare` rows hold a random 32-char base64url token; creating a share revokes the
     previous active one (rotation), and revocation is a stamped `revokedAt` (fail closed: a
     dead token 404s as `SHARE_NOT_FOUND` with no indication it ever existed). The public
     `GET /api/trips/share/:token` renders a **derived, sanitized server-side view**
     (`trips.share.buildTripShareView`, pure + unit-tested): name, dates, party size,
     interests, travel pace, per-day schedules (times "HH:mm", titles, item types, place names)
     and unscheduled idea titles. It deliberately excludes budget figures and estimates, item
     and trip notes, planner warnings, traveler records and every traveler need (Â§11), and
     booking state. The web renderer (/share/[token], `robots: noindex`) can only show what
     the endpoint returns. Owned operations: `GET/POST/DELETE /api/trips/:id/share`.
     Rationale for "curated outline, not bookings": no booking engine exists (Phase 4) and
     sharing "only confirmed bookings" would share nothing today; silently exposing private
     fields would violate Â§11.
  2. **Enquiry capture executes D6 with no invented booking semantics.** `POST /api/enquiries`
     is public (guest or signed-in; SessionGuard populates the user even on `@Public()`
     routes, so contact fields default from the account). An optional `tripId` links the
     enquiry to an *owned* trip and snapshots the trip brief server-side (dates, party,
     destination names, interests, and a coarse derived budget string; traveler provides no
     more personal detail than they typed). Every enquiry gets a human `ENQ-XXXXXX` code, an
     AuditLog row, a confirmation email through the shared `MAILER` abstraction (ConsoleMailer
     until a real provider exists, OPEN_QUESTIONS #9), and - for signed-in requesters - a
     queued `Notification` row (guest notifications are impossible; `Notification.userId` is
     required). Admin pipeline `/api/admin/enquiries` (list + `PATCH` status/assignment)
     enforces NEW â†’ IN_REVIEW â†’ QUOTED â†’ CONVERTED â†’ CLOSED (CLOSED terminal; skips rejected
     as `INVALID_STATUS_TRANSITION`). An enquiry is explicitly **not a booking** in every UI
     string that matters.
  3. **Guest drafts moved from `sessionStorage` to `localStorage` (`tg.plan.draft.v2`).**
     Drafts now survive browser restarts, continue to travel through `/login?next=â€¦`,
     migrate automatically from the legacy `v1` sessionStorage key, and are persisted as the
     wizard advances (not only on the auth handoff). A blank wizard never persists or falsely
     claims "draft restored". Server-side cross-device drafts stay open (OPEN_QUESTIONS #18)
     - this ships the same-device upgrade only.
- **Alternatives:** Shareable full-detail views including prices (rejected - prices are
  estimates and trip notes are frequently private); sharing via login-required read-only
  workspace access (rejected - the point is frictionless coordination); booking-derived shares
  (rejected/deferred - no bookings); anonymous server-side draft rows with minted tokens for
  drafts (rejected for now - garbage collection + abuse surface for little gain);
  per-field consent flags on sharing (rejected for MVP - complexity without a request);
  auto-linking "the owner's only trip" on empty enquiry bodies (rejected - ambiguity; the
  workspace form always links explicitly).
- **Consequences:** Share tokens are unguessable but bearer links: whoever holds the URL sees
  the outline forever until rotated/revoked - the panel says so. Future "shared with me"
  lists would need a token index (not built). Enquiry budget strings deliberately bypass
  `formatMoney` (server-side derivation) and therefore do not localize; acceptable for a
  string snapshot. Trip-linked enquiries snapshot data at send time - later trip edits do not
  rewrite the enquiry. The public enquiry endpoint is throttle-protected by the global guard
  but otherwise anonymous; spam from guest submissions stays possible until a captcha/rate
  review (deferred). Demo-mode trips cannot share or link enquiries (localStorage sources);
  the workspace shows honest preview-mode notes pointing at /enquire.

## D20. Admin console - dashboard, listing review, users/roles, provider verification, audit, catalog CRUD, notification outbox (Buffy, recommended)
- **Decision:** Ship the full seven-section console as one increment (D20 Phases 1-7),
  under a single enforced rule: **every admin endpoint is `@AnyRole(Role.ADMIN)`**
  (single-role model - D3's multi-role RBAC keeps admin exactly one branch; no "super-admin"
  tier). The web `AdminGate` is UX only and never the security boundary. Structure:
  1. **`/admin` dashboard** (`GET /api/admin/stats`): one KPI counter per shipped section
     (listings in review, new + unassigned enquiries, unverified providers, unpublished
     destinations+attractions, draft packages, queued notifications, active users) plus a
     live `recent` snapshot (latest pending listings, enquiries, audit rows). No counters
     exist for unbuilt sections - dashboard numbers are always actionable.
  2. **Listing review** (replaces the WIP admin-listings dead code): the queue refuses to
     touch anything that is not `PENDING_REVIEW` (409 `INVALID_STATE`, replacing a raw
     `new Error` 500). `APPROVE` -> `PUBLISHED` (stamps `publishedAt`), `REJECT` -> `DRAFT`
     (**reason required, >= 4 chars, schema-enforced**; clears `publishedAt`) and
     `SUSPEND` -> `PAUSED` ("parked" - out of the queue; PAUSED cannot be resubmitted by
     the provider today, see OPEN_QUESTIONS #19). Every decision writes an
     `AuditLog` row (`LISTING_REVIEWED`, with `meta.decision/to/note`) and queues a
     `LISTING_REVIEW_DECISION` notification for the provider's owning account (skipped for
     ownerless providers). Closed two WIP gaps while shipping this: the admin queue now
     resolves city/region names into the listing summaries, and both admin/provider
     paths no longer feed `null` city/region ids into Prisma `IN` queries (a crash bug
     carried by half-finished code).
  3. **Users & roles** (`GET/PATCH /api/admin/users`): roles are `RoleMembership` rows -
     grant = upsert (missing -> create ACTIVE; SUSPENDED -> reactivate), revoke = flip an
     ACTIVE membership to `SUSPENDED` (row kept as history). Suspension is enforced by the
     existing auth layer (login rejects `ACCOUNT_SUSPENDED`; the session guard drops
     sessions of suspended users), so no extra session deletion is done here. Written
     guardrails: **no self-suspend (SELF_SUSPEND), no self-demotion (SELF_DEMOTE), never
     removing the last active ADMIN (LAST_ADMIN)**; a PENDING ADMIN membership never
     counts toward the last-admin calculation. All changes audited (`USER_UPDATED`).
  4. **Provider verification** (`GET/PATCH /api/admin/providers`): list with search +
     status filter + per-provider listing counts (page-scoped `groupBy`, not per-row);
     PATCH flips `verificationStatus`, audits `PROVIDER_VERIFICATION_UPDATED` and queues a
     `PROVIDER_VERIFICATION` notification for the owning account; a no-op PATCH audits nothing.
  5. **Activity** (`GET /api/admin/audit`): read-only trail with action/entity/actor filters.
  6. **Catalog CRUD** (`/api/admin/catalog/...`): destinations + attractions create/update/
     delete with derived kebab slugs (explicit slug optional), publish/unpublish, and
     **guarded deletes**: referenced rows (packages / itinerary items / linked
     attractions) 409 with counts (codes `REFERENCED_BY_CONTENT`, `REFERENCED_BY_TRIPS`)
     and the copy explicitly steers to unpublish instead of breaking trips. Public browse
     filters unpublished rows (`Destination.published`, new `Attraction.published` -
     destinations default draft, attractions default visible). Cities/regions are
     **read-only** in this increment (selector only - OPEN_QUESTIONS #20). Slug/P2002
     violations map to 409 `DUPLICATE_SLUG`; everything else rethrows. Catalog mutations
     audited (`DESTINATION_/ATTRACTION_ CREATED|UPDATED|DELETED`).
  7. **Notification outbox** (`GET /api/admin/notifications`): deliberately **read-only**
     with an honest banner: notifications are queued records and no delivery provider is
     wired yet (OPEN_QUESTIONS #9), so there is NO resend/retry button - it would be fake.
- **Alternatives:** Splitting listing review into a separate APPROVE/REJECT endpoint pair
  (rejected - one decision surface matches the queue UX and keeps one audit shape); deleting
  sessions on suspension (rejected - the guard already fails closed on user status; deleting
  would hide revocation behaviour);
  letting admins hard-delete referenced catalog rows (rejected - SetNull FKs would silently
  empty saved trips/packages; unpublish is the honest operation); a fake "resend" on the
  outbox (rejected - violates the no-fake-state rule); pending-then-confirm flows for role
  grants (rejected - memberships are the existing unit of truth, audit covers history);
  per-page server pagination controls in the web console (deferred - fixed 50/100/page
  fetch with client filtering is fine at current volume; revisit with data growth).
- **Consequences:** All admin mutations land in `AuditLog` visible on /admin/activity; the
  console is honest about parked listings (PAUSED is a genuine dead end until #19 is
  decided), queued notifications, and unassigned enquiries. Role revocation semantics
  ("SUSPENDED membership kept as history") means revoked roles re-appear on future grants
  as **activation**, preserving the row lineage. TEST data notes: the suite now runs against
  the isolated `travelghana_test` DB only, and one platform quirk was enshrined in code
  style: **audit `meta` content and user-visible strings must be CP1252-safe** (no "→",
  which Postgres rejects when the local client encoding is WIN1252; use "->").
  The provider-side `publishedAt` stamping quirk (operators submit from PENDING_REVIEW)
  remains WIP-by-design from the listings increment and is unrelated to review decisions.

## D21. Separate admin console site (admin subdomain) via host-aware middleware (Buffy, recommended)
- **Decision:** The same `apps/web` build now serves two sites when `ADMIN_HOST` is
  configured. A new `middleware.ts` routes by Host header: the main host serves the
  public site and redirects `/admin*` 308 to the admin host; the admin host serves
  only `/admin*` ranges, the auth pages (login/register/forgot/reset/verify-email) and
  the assets those pages need (`/_next` chunks, icons, the PWA manifest, the logo,
  robots.txt), funnels every other path to `/admin` (307), and stamps every admin-host
  response `X-Robots-Tag: noindex, nofollow`. Supporting pieces: `ADMIN_APP_URL`
  became a comma-separated list of admin origins in the API CORS allowlist (dev: the
  `pnpm dev:admin` console on `http://localhost:3001`; production: the subdomain);
  `NEXT_PUBLIC_ADMIN_HOST` mirrors the value to the browser so the web `AdminGate` can
  branch; `NEXT_PUBLIC_WEB_APP_URL` makes the shared site chrome (header, footer,
  "Back to site") link to the main app from the admin host. Two edge cases were fixed
  so the subdomain cannot break: a signed-in non-admin on the admin host now gets an
  honest "Staff accounts only - sign out" screen instead of the `/account` bounce
  (which the middleware would send straight back into a redirect loop), and session-less
  visitors still flow to `/login?next=...`, which is allow-listed. Security stays where
  it was: the middleware is presentation routing only, and every admin request remains
  authorized by the API's `@AnyRole(Role.ADMIN)` guard on the session cookie
  (`SameSite=Lax`, host-bound to the API host). Production requirement: keep the API on
  the same registrable domain (e.g. `api.travelghana.com`, or serve it same-origin via a
  reverse proxy) so the cookie flows as-is; hosting the API on a different domain would
  require `SameSite=None` plus third-party cookie workarounds and was rejected.
  Deployment runbook (steps outside the repo): point DNS `admin.travelghana.com` at the
  same deployment as `travelghana.com` (multi-domain on one project, or nginx
  `server_name travelghana.com admin.travelghana.com` to one upstream), terminate TLS,
  and set env `WEB_APP_URL=https://travelghana.com`,
  `ADMIN_APP_URL=https://admin.travelghana.com`, `ADMIN_HOST=admin.travelghana.com`,
  `NEXT_PUBLIC_ADMIN_HOST=admin.travelghana.com`,
  `NEXT_PUBLIC_WEB_APP_URL=https://travelghana.com`. Local simulation without DNS:
  `pnpm --filter @travelghana/web dev:admin` with
  `ADMIN_HOST`/`NEXT_PUBLIC_ADMIN_HOST=admin.travelghana.com:3001` (an explicit port
  implies http for redirect targets) and a hosts-file entry
  `127.0.0.1 admin.travelghana.com`.
- **Alternatives:** A separate `apps/admin` package (rejected - it would duplicate the
  shared theme, fonts and components the workspace already owns); a dedicated admin
  chrome via the route-group refactor (deferred - OPEN_QUESTIONS #21; the shared
  header/footer works today with its links aimed at the main site); `SameSite=None`
  cookies to pair with a cross-domain API (rejected - third-party cookie blocking makes
  it unreliable); returning a 404 for `/admin` on the main host (rejected for now - the
  308 keeps old bookmarks alive; revisit only if hiding the surface matters);
  reverse-proxy-only rerouting with no repo code (rejected - the split needs an
  allow-list and the noindex stamp).
- **Consequences:** One deployment serves both surfaces, so the public bundle still
  contains admin code - unreachable from the main host once routed away and never
  linked; acceptable at this scale. Everything is feature-flagged by `ADMIN_HOST`, so
  local dev, tests and existing flows are unchanged until it is set (verified: the full
  admin smoke passes 37/37 with the middleware compiled in but disabled, and the 12-case
  Host matrix passes with it enabled). Old `/admin` bookmarks keep working through the
  main-host 308. The admin host is noindexed and hidden from the public sitemap's
  intent; its existence is a UX nicety, not access control. Local Windows quirk stays
  respected: all persisted copy in this entry is CP1252-safe ASCII.

## D22. Removed "Favorites" nav stub and the operator console from the public site (Buffy)
- **Decision:** The mobile bottom nav loses "Favorites" and the desktop top nav / footer
  lose "For operators"; the `/favorites` placeholder page and the entire `/operator` web
  console (operator landing, tours, experiences, listings pages and their five form
  components under `components/operator`) are deleted. No page, nav entry or footer link
  references either route afterwards; both URLs now 404.
- **Scope boundary:** only the WEB surface is removed. The API operator module
  (`/operator/*`: provider onboarding, my tours/experiences, my listings) stays live and
  fully tested - the admin console's provider-verification flow is fed by onboarding
  through it, and the public catalog serves the inventory it published. `lib/api.ts`
  keeps its operator client methods (harmless dead code today, reusable if onboarding
  returns in another surface).
- **Alternatives:** keeping the favorites stub until the trips increment lands
  (rejected - an always-empty page in the primary nav misleads users); hiding only the
  links and adding an account-page entry card (rejected - the owner chose less surface,
  not relocation); deleting the API operator module as well (rejected now - it would
  strand admin provider verification and force test/smoke rewrites with no product
  benefit yet; revisit via OPEN_QUESTIONS #22).
- **Consequences:** operators can no longer onboard or manage listings from the site -
  provider onboarding is currently API-only (manual), so admin verification queues will
  show historically onboarded providers going forward. Traveller features are
  unaffected: trips, discover and share flows consume the public `/catalog/*`
  endpoints, not the operator endpoints. Desktop nav is now six links (Explore,
  Destinations, Packages, Gallery, Plan a trip, About) and the mobile bottom nav has
  four items (Home, Explore, Plan, Profile).

## D23. Destination hero photos - curated Wikimedia Commons set, committed files
- **Decision:** All 20 seeded destinations get a hero photo. Photos are committed at
  `apps/web/public/destinations/<slug>.jpg`, sourced from Wikimedia Commons via the
  Commons API (search + imageinfo with full license/author metadata). The verbatim API
  resolution is recorded in `apps/web/scripts/destination-images/manifest.json`; the
  deterministic script `apps/web/scripts/fetch-destination-images.ps1` re-downloads the
  set through `commons.wikimedia.org/w/thumb.php` (thumb.php?f=<file>&width=min(1600,
  original width)) and regenerates `public/destinations/ATTRIBUTIONS.txt`. The seed
  wires `heroImageUrl = /destinations/<slug>.jpg` for the 20 curated slugs in both the
  create and update branches of its upsert. The destination detail page shows the hero
  image when set (plus `openGraph.images` metadata); cards already rendered it.
- **Date:** 2026-10-20
- **Reason:** destination cards and detail pages shipped imagery-ready (D-explore) but
  every seeded destination rendered the MapPin fallback; a tourism product needs real
  imagery. Commons gives freely-licensed, verifiable photos with author/license
  metadata (CC0 / CC BY / CC BY-SA in this set; attribution kept in ATTRIBUTIONS.txt
  and the manifest).
- **Alternatives:** hotlinking upload.wikimedia.org URLs straight from the DB (rejected
  - remote dependency, hotlink instability, no local control); generated placeholder
  art (rejected - not honest imagery); admin-entered URLs only (rejected - manual work,
  no provenance capture).
- **Consequences:** attribution obligations travel with the repo: ATTRIBUTIONS.txt
  lists author + license + Commons file page per photo, satisfying CC BY / CC BY-SA
  when the files ship publicly with the site. Admin-entered destinations can still set
  any image URL through the catalog console; reseeding resets only the 20 curated
  rows' heroImageUrl to the canonical local path. Every committed photo was visually
  verified on-subject after download; three first picks were replaced from the search
  candidates (Aburi: wrong subject, Afadja: black-and-white, Boti: upgraded to a CC0
  twin-falls shot). Infra note: the upload.wikimedia.org CDN was under a persistent
  429 IP limit during sourcing; thumb.php on the commons host was unaffected and is
  what the committed script uses, so reproduction does not depend on CDN luck.

## D24. SiteSettings singleton - admin-editable contact + social info in the footer and about page (Buffy, requested)
- **Decision:** One singleton SiteSettings row (fixed id "site") holds the public
  contact fields (phone, WhatsApp, email, address) and social links (Facebook,
  Instagram, X/Twitter, YouTube URLs - all nullable). Admins edit it as one form at
  /admin/settings; the PATCH is a full replace - every field is sent on every save
  and an empty string clears the stored value. The API exposes a public read-only
  GET /api/site-settings; an admin PATCH /api/admin/settings guarded to the ADMIN
  role and audited (SITE_SETTINGS_UPDATED, meta lists filled + cleared fields).
  Footer + about page render only what is filled in; empty fields are simply not
  shown - no placeholders.
- **Date:** 2026-10-20
- **Reason:** the owner asked for contact info and social handles on the footer and
  about page that the admin can change at any time. Storing it in the database (not
  env/config) keeps the change path the same as all other owner content: the console,
  one form, live immediately (verified: footer + about pick up a change on the next
  request after saving).
- **Alternatives:** env vars / a README checklist for "contact details" (rejected -
  not editable by the admin at runtime); a flexible key-value table (rejected - loses
  type safety and per-field zod validation); per-field sparse PATCH (rejected - an
  omitted field must NOT keep its old value in a full-form editor, or clearing a
  field becomes impossible; full replace makes the form and the API agree trivially).
- **Consequences:** adding a new social platform or contact channel later means a
  schema field + form field + footer block (small, explicit change) rather than
  schema surgery on JSON. No fork: single-origin dev and the admin host share the
  same footer component. WhatsApp is stored as a phone-format string and rendered
  through a wa.me link built from digits only. Dev verification used a throwaway
  admin account (dev-admin@travelghana.test) upserted in the dev database only;
  the shipping data path was exercised end to end (login -> PATCH -> public GET ->
  footer/about rendering -> clear -> gone -> validation 400s guard and audit rows).

## D25 - "Book now" on packages, gated by login (2026-10-20)

- **Decision:** curated package pages get a real booking action. A new lean
  `PackageBooking` model (51st) records a traveler's booking request for one
  published package: `code` (human reference `PB-XXXXXX`, unambiguous mint
  alphabet shared with enquiry codes), `userId`, `packageId`, `startDate`
  (required, future-dated), `adults`/`children`, optional `notes`, and a
  `status` reusing the existing `BookingStatus` enum (starts
  `PENDING_PAYMENT`). The API ships `POST /api/bookings` (session required -
  NOT `@Public()`, so "login first" is enforced server-side, not only in the
  UI) and a read-only `GET /api/admin/bookings?status=` console queue
  (ADMIN role, latest-first). Creation is audited as
  `PACKAGE_BOOKING_REQUESTED` with the package/date/party in `meta` and only
  accepts `status = PUBLISHED` packages (drafts and unknown ids 404).
- **Web flow:** the package detail page's aside replaces the old
  "Packages are previews for now - booking is not enabled yet" notice with a
  `BookingPanel` client component. Anonymous visitors see a "Book now" button
  that routes to `/login?next=/packages/<slug>` (same-origin `next=` mechanism
  the auth form already uses); after signing in they land back on the package
  and the panel shows the form (start date, adults, children, notes). Success
  shows the minted `PB-` code and honest copy: no payment has been taken; the
  team confirms availability and follows up. The admin console gains a
  read-only `/admin/bookings` queue (code, package link, traveler, start date,
  party, notes, status chip, status filter) with a `Bookings` entry in
  ADMIN_NAV.
- **Alternatives:** extending the D1 `Booking` model with a `packageId`
  (rejected - that model is provider-scoped bookable inventory with slots and
  payments; packages are platform-owned editorial journeys with no provider,
  so it would have required optional-izing `providerId` and rewriting approved
  commerce semantics); routing bookings through the D6 `Enquiry` model
  (rejected - enquiries are free-form custom-trip requests with
  destinations/interests/budget, not concrete package intents); a separate
  status enum (rejected - `BookingStatus` reuse keeps the future payment path
  `PENDING_PAYMENT -> CONFIRMED` intact with zero enum growth).
- **Consequences:** booking requests are read-only in the admin console until
  payment rails land - status transitions (confirm/cancel/refund) are
  deliberately deferred to that work rather than letting an admin click
  "Confirmed" with no payment or human check behind it. The traveler has no
  self-service booking list yet (`GET /api/bookings/me` was skipped since no
  UI consumes it); when a "My bookings" surface ships, it reads existing rows.
  Wire contract: the create schema transforms `startDate` into a `Date`
  server-side, so clients submit the schema's INPUT shape (exported
  `PackageBookingCreateWire`, date-only `YYYY-MM-DD`) and never the parsed
  output; the first browser run 400-ed exactly because the panel sent the
  transformed value and it serialized as an ISO datetime.
  Package bookings do not snapshot `priceMinor` at request time; the queue
  shows the package's current price, so price changes retroactively affect
  what a stored row displays (acceptable for a request-without-payment flow;
  revisit if bookings start carrying amounts). Integration coverage:
  `test/bookings.int.spec.ts` (login-first 401, draft 404, published 201,
  admin-only queue, status filter, audit row).

## D26 - Booking confirmations + the traveler's own booking list (2026-10-20)

- **Decision:** a booking request now answers the traveler two ways: at
  creation the API records an in-app `Notification` (`EMAIL` channel, status
  `QUEUED`, type `PACKAGE_BOOKING_REQUESTED`) and sends a plain-text
  confirmation through the `MAILER` abstraction (the `ConsoleMailer` logs it in
  development; a real provider is still OPEN_QUESTIONS #9). The email gives
  the `PB-` code, package, UTC-pinned start date, party, any notes, and says
  plainly that nothing is charged yet - wording matches the web panel. The
  signed-in traveler can also see their own requests: `GET /api/bookings/me`
  (session-scoped, newest first, package context) rendered as a "My bookings"
  card on `/account` with status chips and an empty state that links to the
  packages catalog.
- **Alternatives:** staying silent until payment rails land (rejected - the
  `PB-` code is real state; a traveler who acted on "Book now" gets nothing
  back, which reads as broken); showing every booking from the admin queue to
  the traveler (rejected - `/me` is strictly filtered by the session user id,
  not by role).
- **Consequences:** no outbound mail exists yet, so nothing on the site claims
  an email was delivered - the honest claim is that the request is recorded
  and a human follows up. When a mail provider lands, the same `mailer.send`
  call goes live with no caller changes (labs in `sentEmails` in the int spec
  already assert subject/copy). Booking emails are sent best-effort after the
  row exists; if the user row cannot be read the booking still succeeds
  without an email (unit-tested, not hidden). All list tests in the shared
  Postgres integration DB now assert on the spec's own fixtures instead of
  emptiness - `packages.int.spec.ts` collapsed exactly on this when bookings
  rows existed alongside it (the repo's "never assert emptiness" rule caught
  up with it); other specs with emptiness assertions on tables only their
  suite writes to remain as-is and stay green.

## D27 - Count badges for admin + traveler surfaces (2026-10-20)

- **Decision:** pending counts appear as small badges in the admin console
  nav (one `adminStats()` fetch per console visit; per-section > 0 only) and
  a "Booking requests" dashboard card; on the traveler side the account page
  cards ("My trips", "My bookings") and the header "My TravelGhana" button +
  mobile Profile item get member-scoped count bubbles from a new
  `GET /api/users/counts` (owned trips + the member's package bookings,
  401 anonymous).
- **Alternatives:** showing a big card grid as the only counts (kept - the
  D20 dashboard already had it; badges additionally carry those numbers to
  every console page without the dashboard detour); hiding badges until the
  user opens a section (rejected - the point of a badge is knowing there is
  something BEFORE navigating); counting shared trips for the traveler badge
  (rejected for now - the planner separates ownership from collaboration, so
  "owned" is the stable, unambiguous number until a shared-with-you view
  defines the other number).
- **Consequences:** badges are strictly derived from shipped sections; a
  failed counts fetch degrades gracefully (badge hidden, page works). The
  header fetches `me()` + counts per page view - consistent with the
  multi-fetch pattern the footer/about already use. The traveler
  notifications count waits for a notifications UI; nothing leads to a
  dead destination.

## D28 - Console cleanup deletes: notifications, enquiries, booking requests (2026-10-20)

- **Decision:** every delete on the admin console is audited, and where
  history matters deletion is refused, not just hidden. Shipped:
  `DELETE /api/admin/notifications/:id` (QUEUED/FAILED only - SENT records are
  delivery history and immutable, `SENT_RECORD_IMMUTABLE`), `DELETE
  /api/admin/enquiries/:id` (spam / personal-data cleanup in any pipeline
  status; audit row keeps code, email and status after the row is gone), and
  `DELETE /api/admin/bookings/:id` for junk booking REQUESTS
  (PENDING_PAYMENT/CANCELLED/EXPIRED only; CONFIRMED/COMPLETED/REFUNDED rows
  are financial records and refuse with `FINANCIAL_RECORD_IMMUTABLE`). The
  console gets Delete buttons on /admin/notifications (in the row expansion;
  hidden for SENT rows), /admin/enquiries (with a confirm naming the contact
  details being removed) and /admin/bookings (with a per-status footer
  explaining what is deletable). Catalog destinations/attractions, gallery
  items and packages already had guarded deletes with UI (D8/D16-era) - those
  stand unchanged.
- **Alternatives:** soft-delete columns on every table (rejected - nothing in
  the product needs undelete today, and it would multiply the "which rows
  count" logic into every query); admin deletion of users (rejected -
  suspension is the account mechanism, and users carry FKs from bookings,
  sessions and audits; a hard delete would require a data-removal policy
  decision beyond today's scope); admin deletion of providers (rejected until
  a provider data-removal policy exists - providers own listings, listings
  are reviewed history, and the verification audit trail references them);
  deletion from the audit trail (rejected outright - /admin/activity is the
  integrity evidence nothing else on the console can survive without); a
  cancel/decline status action on booking requests (the D25 line still holds:
  booking STATUS decisions wait for payment rails, and this delete is data
  removal, not a booking decision).
- **Consequences:** deleting a queued notification means that entry never
  arrives anywhere - the honest outbox only ever claimed "queued", so removal
  is legitimate cleanup the dashboard stats reflect on the next fetch. Every
  new delete writes an audit row with the entity id preserved AFTER the row
  is gone (code/email/status/packageTitle in meta), so /admin/activity shows
  who removed what even though the record itself is unrecoverable. The
  traveller-facing /me and notification surfaces simply stop listing deleted
  rows - no tombstones. Verified live: signed-in enquiry + its queued
  notification + a fresh booking request were each created, deleted (200),
  re-deleted (404), counted, seen in the audit trail and guarded (anonymous
  deletes 401; unknown ids 404).

## D29 - Site guide: a search-listing overview page (2026-10-20)

- **Decision:** a new `/guide` page mirrors the structure of a search-engine
  results listing (the owner's reference screenshot was a Bing result page):
  one text-first "result" block (small logo + site name + URL line, big
  title link -> `/`, two-line snippet with "Read more" -> `/about`) followed
  by a two-column grid of quick links - bold headings + one gray description
  line each, no cards, borders or shadows. It is a BRANDED TRANSLATION,
  not a copy: brand green links instead of the listing's purple, the normal
  site header/footer stays, and the Travel Ghana logo asset is used as-is
  (the logo is never redesigned or recolored). Every link targets a real
  shipped page (/destinations, /packages, /explore, /plan-my-trip,
  /gallery, /about, /enquire, /account) - nothing points at future work.
- **Alternatives:** rebuilding the home page in this style (rejected - the
  hero/cards homepage is the travel identity; a search-engine look as the
  front door would trade brand recognition for novelty); a near-identical
  treatment (purple listing colors, no site chrome - rejected, reads as a
  search-engine clone, not a travel site); restyling Explore results as text
  rows (deferred - can follow if the owner likes the guide look); optimizing
  the site's Bing SEARCH LISTING instead (a separate SEO matter - metadata
  and webmaster tooling, not a page design; not in scope today).
- **Consequences:** the URL line renders the ACTUAL request host via
  `headers()` - localhost:3000 in dev, the deployed domain automatically at
  launch; nothing ever claims a domain the owner has not confirmed. Fully
  server-rendered static content (no API data dependency beyond the standard
  footer settings fetch), so the whole page is honestly verifiable in HTML -
  no client gating. Wired into the footer (`FOOTER_LINKS` + "Site guide")
  and `/sitemap.xml` (priority 0.4) so it is discoverable and crawlable;
  kept out of the main nav to avoid nav clutter. On the admin host the
  existing D21 middleware funnels /guide to the console like any other
  main-site path.

## D30 - Static/ISR serving for the public site: the routing-speed change (2026-10-20)

- **Decision:** stop re-rendering every page on every request. The footer
  (root layout) fetched site settings and the gallery with `cache:
  "no-store"`, which classified EVERY route as dynamic (`f`) and prevented
  both per-request data reuse and client-side `<Link>` prefetching. Both
  reads are now ISR-cached with a 60s revalidate window
  (`lib/site-settings.ts`, `lib/gallery.ts`); destinations and packages
  already shipped 5-minute revalidate (300s). Result: 34 routes render at
  build time (/, /about, /account, the whole /admin console SHELL set,
  /packages, /gallery, /enquire, /trips, auth pages) and refresh from the
  cache after each window; pages remain correct-by-revalidation.
- **Alternatives:** caching site settings for 5 minutes like the catalog
  (rejected - contact/social edits within a minute is close to the D24
  instant-update promise while still unlocking static serving); forcing
  static on /explore and /destinations via client-side filtering (deferred -
  they use searchParams per request, yet their data IS ISR-cached so they
  stay in the ms class); making /guide static by dropping the request-host
  URL line (rejected - the honest-host rule from D29 wins over a few ms).
- **Measured (production server, clean build each side, warm repeat):**
  BEFORE (all dynamic): / 41ms, /packages 26ms, /gallery 31ms, /about 37ms,
  /login 30ms, /account 21ms, /admin 32ms. AFTER (prerendered): / 12.6ms,
  /packages 5.9ms, /gallery 5.5ms, /about 8.2ms, /login 7.6ms,
  /account 7.2ms, /admin 8.7ms - roughly 3-5x on the server. Dynamic pages
  (/explore, /destinations, /guide, [slug] details) stay 20-40ms with
  ISR-cached data. Against the DEV experience the user actually complained
  about (warm 0.5-0.7s per route under Turbopack dev), production serving
  is now ~50-90x; and in the browser, static/ISR pages are eligible for
  `<Link>` prefetch, so navigation POPS in from the cache instead of
  awaiting an RSC round trip.
- **Honest limits:** dev still renders per request by design (Next disables
  the route cache in development), so the dev numbers do NOT improve - the
  10x claim is about production serving and real-browser navigation; the
  fidelity trade-off is that admin edits to site settings and gallery
  publishing now appear on the public site within ~60s instead of instantly
  (destinations/packages were already on 5-minute windows). A prod server
  was accidentally left running across a rebuild during measurement
  (EADDRINUSE exposed it) - invalid mid-run numbers were discarded and both
  measurement points redone cleanly; the infra rule is updated to cover
  prod `next start` the same as dev: no server from the app dir may be
  serving while `next build` writes .next.

## D31 - Site copy: "curated" retired site-wide in favor of "created" wording (2026-10-20)

- **Decision:** the owner read "curated" on the site and chose a whole-site
  replace of the word with "created". All 25 occurrences across 10 web files
  now use "created" wording: home (section heading "Created packages" +
  closing line), /packages (metadata title "Created packages", description
  "created by TravelGhana", eyebrow "Created by TravelGhana"; the empty
  catalog state honestly says "Our journeys are being prepared"), package
  detail (metadata fallback "...-day journey in Ghana, created by
  TravelGhana." + day-by-day caption "The outline created by TravelGhana."),
  gallery (metadata, hero line, empty state "Our gallery is being created"),
  about (description, value cards, both CTAs), /guide (description + body
  line), account ("Browse our created journeys"), admin dashboard ("Draft
  packages" hint now "Created but not published yet"), admin packages (page
  intro "Multi-day journeys you create." + "Create the first journey...")
  and a booking-panel source comment that now says "published package"
  (accurate per the D25 bookable rule).
- **Alternatives:** fixing only the one spot that caught the owner's eye
  (rejected - the owner chose a whole-site replace); swapping in a different
  synonym such as "handpicked" or "designed" (rejected - the owner's own word
  was "created", so the site uses that consistently); mechanical find/replace
  of every instance (rejected - a few spots would have read badly, so those
  sentences were rephrased around the verb instead, e.g. "Every journey we
  create starts on the ground").
- **Scope limits:** apps/web only, no API/schema/data changes. API-side
  source comments and the docs themselves retain earlier wording on purpose -
  docs are historical records describing decisions as they were made at the
  time. Rendered verification: /, /packages, /about, /gallery, /guide and a
  package detail page each returned 200 with zero "curated" occurrences and
  the expected "created" markers present; client-gated surfaces (admin
  dashboard hint, account link) verified at source level only, per the
  HTML-verification limits rule.

## D32 - "Where to sleep" per night: reuse ACCOMMODATION items instead of a new table (2026-10-20)

- **Decision:** implement the owner's request (choose where to sleep for each
  night of a planned trip, or leave it empty) with zero schema changes. The
  ERD already carried `ItineraryItemType.ACCOMMODATION`, shared validation,
  the `MISSING_ACCOMMODATION` summary note and share-view passthrough -
  nothing was missing at the data layer, only the affordances in the UI.
  The planner day editor now has a dedicated "Where to sleep - optional"
  block per night backed by Stay items; the wizard's final step explains the
  choice happens in the itinerary (one Stay per night, or leave nights
  open); leaving nights open is first-class, surfaced as an info-level
  reminder rather than a warning.
- **Alternatives:** a `trip-day.lodging` text column (rejected - duplicates
  the item model, would desync the MISSING_ACCOMMODATION logic and the
  budget roll-up that already handles ACCOMMODATION items with estimates and
  pricing basis); a lodging select sourced from provider listings (deferred -
  no lodging listings exist to select yet; revisit when provider
  accommodation listings ship); a mandatory pre-confirmation sleep field
  (rejected - sleep choices are not bookings, so they stay informative and
  optional).
- **Limits honored:** stay entries remain estimates-only - an optional cost
  estimate contributes to the trip budget like any other item and is never a
  confirmed booking; the token-gated share view gains only already-public
  plan-outline data (a lodging name is not a price, private note or need).


## D33 - Infrastructure: Neon Postgres as the production database (2026-10-20)

- **Context:** zero-budget production stack, Neon-first decision. Executed with
  the neon CLI 8.10.0: `neon init` linked the repo to project
  square-poetry-48521757 (org org-icy-fog-43699121, branch production pinned,
  Frankfurt region) and generated the `neon.ts` service policy; `neon deploy`
  applies the policy to the branch.
- **Free-plan constraint:** the AI Gateway is not available on the Free plan
  and `neon deploy` refuses while it is declared. Removed `aiGateway: true`
  from neon.ts; deploy then succeeded. Provisioned: Postgres, Neon Auth
  (Stack-auth-backed), Object Storage (declared bucket "assets"; the CLI also
  shows an auto-named "travelghana" bucket on the branch) and Functions
  (scaffolded "hello" sample). `neon deploy` pulls the env vars into the root
  .env automatically.
- **Connection split (pooled vs direct):** DATABASE_URL at the repo root is
  the Neon POOLED host (-pooler) and is read by the API runtime and web server
  components. DATABASE_URL_UNPOOLED is the direct host; schema.prisma gained
  `directUrl = env("DATABASE_URL_UNPOOLED")`, and packages/database/.env (the
  gitignored file the prisma CLI and seed resolve) now holds the direct pair,
  because transaction-mode pooling breaks prepared statements in
  migrations. Process env wins over .env files at runtime, so the long-running
  API keeps the pooled URL while CLI/seed traffic goes direct.
- **Migration strategy:** no `db push` on production. The stale legacy
  `0001_listing_model` migration (never applied to any deployed database) was
  deleted and replaced by a single consolidated baseline `0001_baseline`
  generated from the current 51-model schema via
  `prisma migrate diff --from-empty --to-schema-datamodel ... --script`
  (1,434 lines, 51 tables + 32 enums, pure ASCII). `prisma migrate deploy`
  against Neon returned "All migrations have been successfully applied" and
  `migrate status` reports "Database schema is up to date!".
- **Seed + content policy:** db:seed ran against Neon with its idempotent
  upserts: 16 regions, 19 cities, 20 destinations, 5 attractions. Packages,
  gallery and site settings stay EMPTY (owner content entered via Admin);
  production starts with zero users - the admin is bootstrapped from
  ADMIN_EMAIL/ADMIN_PASSWORD when the owner provides real values (the
  throwaway dev admin remains only in the old local dev database).
- **Proven end to end (live stack):** GET /api/destinations/regions reads the
  seeded 16 through the pooled runtime connection; full write path register
  201 -> ConsoleMailer link -> verify-email 200 -> login 200 (tg_session =
  DB-backed session row inside Neon) -> trip 201 (2 days) with
  MISSING_ACCOMMODATION severity=info carrying the D32 copy -> ACCOMMODATION
  item on night 1 (201) -> warning gone and the Stay present -> trip DELETE
  200 -> GET 404; the smoke user was then cascade-deleted (users 0,
  sessions 0, trips 0). Functions: GET of the hello base URL returned 200
  "Hello from Neon Functions". Object storage: upload -> list -> download
  (byte-identical roundtrip) -> delete -> list empty via
  `neon buckets object` (S3 credentials valid). Neon Auth: JWKS endpoint 200
  (one signing key), deliberately NOT consumed by app code - the app keeps
  its own session auth (users, sessions, hashed tokens); switching identity
  systems is a future decision. Build/quality: `npm run build` (turbo) 3/3
  green with the D30 static/ISR route split intact; typecheck 7/7; lint
  10/10; API unit suite 143/143. Web pages /, /packages, /destinations,
  /about all 200 against Neon data (destinations render seeded rows;
  packages shows the honest empty state).
- **New ops utility:** `pnpm --filter @travelghana/database db:inspect`
  prints row counts (catalog / owner content / identity / activity) against
  the configured database for quick operational checks.
- **Env + discipline notes:** neon deploy replaced DATABASE_URL in the root
  .env (pre-change copy kept as .env.pre-neon.bak, untracked). .env.example
  documents the Neon vars with empty values. All dev servers now run against
  the production database - console actions are production actions. The local
  embedded Postgres remains for integration tests only (TEST_DATABASE_URL
  with its *_test-suffix refusals unchanged). Weekly backup one-liner from
  the repo root: pg_dump "<DATABASE_URL_UNPOOLED>" --format=custom -f
  travelghana-YYYYMMDD.dump.
- **Not wired (deliberate):** ai-gateway (unavailable on the Free plan);
  Neon Auth (own auth system already covers it); object storage SDK in app
  code (gallery/images are URL-based today - the bucket and credentials are
  ready for a future upload pipeline); Functions beyond the scaffolded hello
  sample. The optional "github-copilot-cli" agent plugin install failed twice
  inside `neon init` (a VS Code plugin install environment issue, unrelated
  to the database work) and the project setup completed fine with
  --no-agent-setup.

## D34 - Transactional email: BrevoMailer behind the MAILER token (2026-10-20)

- **What shipped:** a real delivery provider for signup verification,
  resend, and password-reset mail. `BrevoMailer` implements the existing
  `Mailer` interface (no caller changes) and POSTs Brevo's transactional API
  (api.brevo.com/v3/smtp/email) with sender, to, subject, textContent and
  optional htmlContent. Provider selection at DI time via a new
  `buildMailer()` factory: MAILER_PROVIDER="console" (default) or "brevo".
  Env: BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME (optional name;
  defaults to "TravelGhana"), BREVO_TIMEOUT_MS (optional; default 10 000 ms,
  applied via AbortSignal so a hanging provider cannot stall requests).
- **Failure-tolerance contract (the load-bearing rule):** send() RESOLVES
  even when delivery fails - a bad key, HTTP error, network failure or a
  provider hang can never break or lose a signup/forgot-password/booking
  flow. Failures are logged with recipient masked (2 chars + domain),
  subject and HTTP status only; message bodies are credential-bearing
  (verification/reset links) and are never written to logs by the Brevo
  path. Unit tests pin the contract: correct payload and headers, html
  mapping, resolve-not-throw on 401/429/ECONNREFUSED (152 API unit tests
  green, 9 new). Typecheck + lint green.
- **Degradation instead of hard failure:** an unknown MAILER_PROVIDER value,
  or brevo selected without BREVO_API_KEY/MAIL_FROM_EMAIL, boots with the
  console mailer plus a loud warning - the API starts mail-provider-
  agnostically. The selection (and fallbacks) is logged at boot: "Mailer
  provider: brevo (BrevoMailer active)" / console variants.
- **Live finding - rejects are asynchronous:** with the owner's real key
  mounted, live API smoke (register, forgot-password) returned 200/201
  without any warning in the API log, while Brevo's event log
  (GET /v3/smtp/statistics/events) showed the message accepted at HTTP level
  (two "requests" events) and then internally rejected:
  "Sending has been rejected because the sender you used <from> is not
  valid. Validate your sender or authenticate your domain." Consequence:
  sender misconfiguration cannot be surfaced synchronously by the API; it
  lives in Brevo's dashboard/events. Delivery monitoring stays a Brevo-side
  concern on the free tier; the API only surfaces transport-level failures.
- **Remaining owner step (out of my reach):** confirm the gmail sender
  inside Brevo (click the confirmation link Brevo emailed) so
  MAIL_FROM_EMAIL can point at a verified sender. Until a custom domain is
  bought, one verified sender is enough (SPF/DKIM for bookings@travelghana
  only becomes possible together with domain purchase; see
  OPEN_QUESTIONS.md #9 for that milestone).
 
## D35 - Lifecycle emails: 6-digit code as the primary affordance, link as fallback, real HTML templates (2026-10-21)

- **What shipped:** verification and password-reset emails now show a
  prominent 6-digit code (users can act without ever clicking a link) plus
  the existing deep link as a fallback. A shared table-based HTML template
  (inline styles only, safe in Gmail/Outlook/mobile) in the brand palette
  (Ghana Green #006b3f) with a plain-text twin that always carries code +
  link; the hidden preheader puts the code into the inbox preview. New
  module apps/api/src/modules/auth/email-templates.ts; templates return
  EmailTemplate = Omit<MailMessage, "to"> and the caller attaches the
  recipient, so the Brevo/Console mailers stay interchangeable.
- **Schema + migration 0002_email_code:** nullable codeHash TEXT columns on
  EmailVerificationToken and PasswordResetToken, deployed to Neon (migrate
  deploy + status green, 2 migrations). Codes are sha256-hashed like their
  256-bit link twins and ride on the SAME record: exactly one active
  request per email, consumable through either channel, 1h TTL unchanged.
- **New API:** POST /api/auth/verify-email-code {email, code} and
  POST /api/auth/reset-password-code {email, code, password}; shared
  lifecycleCodeSchema (^\d{6}$ via trim) in @travelghana/validation. Wrong
  code and unknown email return the identical INVALID_CODE body; unknown
  emails get a sentinel-id lookup with identical work - no enumeration.
  Reset by code kills all sessions exactly like the link path.
- **Security posture:** code space is 10^6, hashed at rest, single-use,
  1h expiry; public endpoints sit behind the existing rate limiter. A
  per-record wrong-attempt counter is the natural future hardening
  (deliberately not built yet - not worth the extra column at this scale).
- **Live smoke (production Neon, console provider for observability):**
  register -> 6-digit code -> verify-email-code 200; wrong code -> 400;
  unknown email -> 400 (identical shape); forgot-password ->
  reset-password-code 200 -> login with the new password 200 -> old
  password 401; smoke user cascade-deleted. 7 new unit tests, 159 total
  green; typecheck + lint green across api/web/validation.
- **Web:** /verify-email and /reset-password are dual-mode. With a token
  param they behave exactly as before (auto-verify / one-field form);
  without one they render a code form (email + 6-digit code, numeric
  keyboard, one-time-code autocomplete; reset also takes the new password
  and links back to /forgot-password).
- **Owner-visible receipt:** after the sender confirmation, a real reset
  email for the admin account was received with the new template (see
  PROGRESS). MAILER_PROVIDER in dev is brevo; console remains the default
  in .env.example until the owner wants mail in a given environment.

## D36 - Booking + trip-plan lifecycle email (receipt, acknowledgement, approval, concern) + admin notices (2026-10-21)

- **What shipped:** every traveler event already emails the user from the
  shared template system, and the admin console can now act on bookings
  with the traveler's mailbox in the loop:
  - Automatic, on create: booking request receipt (bookingEventEmail kind
    "received"; upgrades the previous plain-text note to the HTML layout),
    a trip-plan acknowledgement (tripPlanEmail - private draft, nothing
    booked), and an admin notice copy of each new booking request
    (bookingAdminNoticeEmail to ADMIN_EMAIL when that is set, linking to
    the console queue).
  - Admin-triggered, per booking: ACKNOWLEDGE (we're on it; optional
    note), CONCERN (a written question/note sent to the traveler), and
    the availability DECISION (confirm / cancel with optional reason;
    emails a "confirmed" or "cancelled" event with the reason quoted).
  Each admin action writes an auditLog row, a queued in-app Notification
  (PACKAGE_BOOKING_ACKNOWLEDGED / _CONCERN / _CONFIRMED / _CANCELLED),
  and sends the email - bookkeeping first, mail last (the never-fail
  mailer contract from D34 means a mail outage cannot undo an action).
- **Endpoints:** POST /api/admin/bookings/:id/acknowledge {message?},
  :id/concern {message}, :id/decision {decision: CONFIRMED|CANCELLED,
  reason?} with schemas adminBookingAcknowledgeSchema,
  adminBookingConcernSchema, adminBookingDecisionSchema in
  @travelghana/validation. The decision stays scoped to PENDING_PAYMENT
  rows: anything else gets 409 BOOKING_STATUS_IMMUTABLE because
  completed/refunded transitions belong to the payment rails (same
  boundary as the D28 delete guard). PackageBooking carries no
  cancel-reason column, so the cancellation reason lives in the audit
  meta, the notification payload, and the email only.
- **Mail module refactored into shared infrastructure:** the mailer token,
  providers and templates moved from modules/auth into
  apps/api/src/modules/mail (mailer.ts, email-templates.ts,
  mail.module.ts). Auth/bookings/enquiries/trips all import MailModule;
  the per-module `{ provide: MAILER, useClass: ConsoleMailer }`
  duplication is gone - one provider instance resolves at DI time via
  buildMailer(). The Trip planner got the mail hook (its module had none).
- **Web console:** /admin/bookings rows now have an "Email the traveler"
  panel - optional message textarea plus Send acknowledgement / Send
  concern (concern requires text) and, for payment-pending rows, Confirm
  booking / Cancel booking (the textarea doubles as the reason). Decisions
  replace the row in place; acknowledge/concern refresh nothing because
  they change no status. api.ts gained adminAcknowledgeBooking,
  adminConcernBooking, adminDecideBooking.
- **Live smoke (production Neon, console provider for observability):**
  trip created -> plan acknowledgement email; package created/published
  via the admin API (D36 Smoke Package), booking A -> receipt + admin
  copy logged, acknowledge -> email logged, concern -> email logged, then
  D28 delete; booking B -> receipt + admin copy, decision CANCELLED with
  reason -> status flipped + email, D28 delete; prisma cleanup removed
  the smoke user/trip/package (audit rows auto-nulled via the optional
  actor relation). Production back to exactly 1 real admin, 0 smoke rows.
  All 7 mail legs appear in the console log with the template bodies.
- **Honest gaps:** the CONFIRM path is unit-proven (subject, body, audit,
  update payload) but not live-proven, because a live CONFIRMED row has
  no delete path (D28 refuses financial records, and decisions are
  PENDING_PAYMENT-only) - it would have left junk in the owner's queue.
  The owner will see the first real confirmation email when they approve
  a real booking. Under brevo, future actions send REAL mail from the
  verified gmail sender; throwaway .test addresses bounce harmlessly.
  Env-note: the owner's .env keeps ADMIN_EMAIL / ADMIN_PASSWORD values
  quote-wrapped (with stray spaces around keys); the API's dotenv loader
  handles that fine, but raw regex scraping must Trim() and strip quotes
  exactly as the smoke scripts did.
- **Gates:** unit 165/165 (6 new booking-service tests + the moved
  mailer spec), typecheck + lint green (api/web/validation), full clean
  turbo build 3/3. New mail files are ASCII-clean; my own page additions
  use ASCII ellipsis/dashes uniformly.
## D37 - Tunnel-safe preview: same-origin API proxy + small-screen admin console (2026-10-22)

The owner shares the dev-tunnel URL (f8w4fzr3-3000.uks1.devtunnels.ms; port
3000 only, public/anonymous while the preview is open) with friends. Browsers
there broke before, because the web client called the API on an absolute
localhost origin.

- **Decision: one tunnel, same-origin proxy.** /api/:path* on the web app is
  rewritten server-side to the API origin (API_PROXY_TARGET, default
  http://127.0.0.1:4000) in next.config.ts, and the browser client
  (lib/api.ts) now defaults to the relative /api base. Session cookies stay
  first-party and the API port is never exposed. Server-side fetchers
  (packages, gallery, catalog, destinations, site-settings) keep their
  absolute http://localhost:4000/api fallback because Node-side relative
  URLs fail; that split needs a revisit for Phase 2 hosting. A second tunnel
  for the API was rejected: third-party cookie blocking plus SameSite=Lax
  would keep logging friends out.
- **Verified through the tunnel:** /api/health, /api/packages and a genuine
  unauthenticated /api/auth/me 401 round-trip through the proxy; pages 200.
- **Admin console on small screens:** audited all 16 admin pages; real fixes
  only: the admin nav becomes one horizontally scrollable strip on mobile
  (group labels hidden below sm), the bookings heading steps down at small
  widths, and console action buttons get tap-sized padding back (py-2).
- **Housekeeping for the owner when the preview closes:** set port 3000
  visibility back to Private in VS Code; never forward port 4000.

## D38 - Visitor insights: first-party clickstream, no third-party analytics (2026-10-26)

Zero budget and privacy-first: "how do people actually use TravelGhana?" is
answered in-house - no third-party script, no external service.

- **Model + migrations:** PageView (sessionId = 30-minute browser bucket;
  visitorId persistent per browser; optional userId sent server-resolved
  only; path stored without query strings; optional referrer origin; device;
  kind view|action; optional action name; meta JSONB; occurredAt; indexes on
  (sessionId, occurredAt), visitorId, path, userId). Migration 0003 shipped
  with userId NOT NULL by mistake; 0004 corrects the column to nullable -
  the FK is ON DELETE SET NULL and anonymous visitors legitimately have no
  user row. The Prisma model stays the authoritative shape.
- **Collector:** POST /api/track is public (global ThrottlerGuard rate
  limit; zod caps paths at 300 chars, stringified meta values, batches at
  20 events). Because the global session guard still resolves cookies on
  public routes, signed-in browsing is correlated to its userId server-side.
  record() never throws: storage failures log a warning and report
  accepted=0, so tracking can never break page UX.
- **Recorder (lib/tracking.ts + BehaviorTracker island in the root
  layout):** route-change views and explicit action events only. Query
  strings never leave the browser; the referrer is transmitted as origin
  only, and only on the first event of a page load; bots (UA regex,
  webdriver) and /admin paths are dropped at the source. visitorId persists
  in localStorage; a session id renews after 30 idle minutes. Events batch
  after 1.2 s and pagehide flushes the queue via sendBeacon, so closing the
  tab loses nothing; duplicate fires within 1.5 s collapse into one row.
- **Milestones:** booking_started fires when the anonymous "Book now" button
  is clicked and when the signed-in form appears; booking_created (with the
  confirmation code) fires on a successful create; enquiry_created on
  concierge submissions (public form and trip panel). The funnel's final
  step does NOT trust those client events: step 5 counts distinct sessions
  whose resolved userId appears in PackageBooking rows created inside the
  window - server truth only. Session ids are client-owned, so the server
  cannot stamp funnel rows itself; the bookings table stays the
  anti-spoofing source.
- **/admin/insights:** 24h/7d/30d window plus an include-admin-browsing
  toggle (admin paths excluded from aggregates by default). KPI cards
  (visitors; sessions and events; server-truth bookings in the window),
  the five-step funnel with per-step drop-offs, top paths and arrival
  origins and device split, and a session inspector: recent sessions
  (entry path, last path, event count, device, booking-action badge,
  linked email) expanding into the full timeline with per-step gaps and an
  explicit "session ended here" note. The dashboard gains a "Visitor
  sessions (24h)" card and the console nav gains Insights.
- **Verified live:** valid batches through the web proxy (accepted 4 then
  1), invalid payloads rejected with 400, a remote POST through the
  dev-tunnel URL accepted, and the exact aggregate SQL (FILTER batches,
  regex step-match, COALESCE referrer origins, ARRAY_AGG entry/last paths,
  BOOL_OR booking-action flags) executed against production Neon with the
  expected numbers; all smoke rows deleted afterwards (back to 0). Not
  verifiable here: the recorder's behaviour and the /admin/insights UI
  inside a real browser - the owner should browse the public site and watch
  their own session appear in the inspector.
- **Known limits (documented, by design):** page- and click-level only (no
  scroll depth or heat maps), cleared browser storage reads as a new
  visitor, no data exists before deployment day, and a 90-day retention
  cleanup is future work.
- **Gates:** unit 170/170 (5 new insights-service tests), typecheck + lint
  green across all packages, clean turbo build 3/3 with both dev servers
  stopped.

## D39 - Password-reset flow: discoverable code entry + preview-friendly email links (2026-10-26)

The owner reported that after the reset email arrives "the user has no place
to reset the password". Investigation: the /reset-password page already
supports exactly that (no-token mode = email + 6-digit code + new password,
shipped in D35) - but the flow keeps it hidden, and the email link is dead in
the tunnel preview.

- **Reported breakage, reproduced honestly (no code forced the failure):**
  earlier the same day the login/register failure was the dead API dev
  process (restarted, verified 401/201 responses through the tunnel). The
  reset complaint then turned out to be two design gaps, not a crash:
  1) /forgot-password's "email sent" state never mentions the 6-digit code
     and never links to the code-entry form, so a user who cannot use the
     emailed link has no visible path; 2) the email slug is built from
     WEB_APP_URL's FIRST entry, which was http://localhost:3000 - correct on
     the owner's machine, dead link for anyone opening the preview through
     the dev-tunnel URL.
- **Fix 1 (discoverability):** the forgot-password "sent" state now states
  that the email carries both a link and a 6-digit code (1-hour expiry) and
  offers "Enter the 6-digit code", linking to /reset-password (code mode).
  The reset page itself needed no change.
- **Fix 2 (preview-friendly links):** WEB_APP_URL is ordered
  tunnel-origin first, localhost (and LAN) after: emails deep-link through
  f8w4fzr3-3000.uks1.devtunnels.ms so the links work for friends AND on the
  owner's machine, while the full list still feeds the CORS allowlist.
  This is a PREVIEW-ERA env ordering to revert at Phase 2 hosting - and to
  re-edit whenever the tunnel URL changes after a VS Code restart.
- **Verified:** page change typecheck/lint green (direct per-package runs -
  turbo db:generate is blocked by the running dev API's engine DLL, an
  environment-only EPERM), API restarted on the new env, forgot-password
  answered 200 for the real admin account. Email receipt itself is
  owner-confirmed (no inbox access here): the sent mail should show the
  tunnel-origin link plus the code.

## D40 - Feature program Phase 1: WhatsApp, traveler inbox, structured data, site search (2026-10-26)

Owner picked nine features (Plan mode survey) and approved a phased build;
Phase 1 is additive-only - no schema migrations, no API behavior changes
behind existing surfaces.

- **Decisions locked by the owner:** global WhatsApp number held in site
  settings (editable at /admin/settings; no number is hardcoded - the button
  simply does not render until it is filled in); reviews locked to
  admin-CONFIRMED package bookings, packages only; transport/rides booking
  requests as quote-only; availability as explicit departure dates with
  seats; payments shown as Mobile Money PLUS bank transfer with the booking
  code as reference and NO amounts in email; image host deferred (upload UI
  built against a storage abstraction). Phases 2-4 build on these.
- **Traveler inbox (D40a):** new /api/notifications surface over the
  existing Notification outbox rows the platform already writes (booking
  lifecycle D34/D36, provider checks D20): GET paginated list with unread
  count, GET /unread for the header badge, PATCH /:id/read (owner-only,
  idempotent - an already-read row keeps its original timestamp), POST
  /read-all. All routes owner-scoped in the where clauses; foreign ids 404.
  Web: bell with unread badge in the desktop header, Notifications card on
  /account, and /account/notifications inbox with type-derived titles,
  booking code chips, mark one/all read and "load older" paging. Emails keep
  going out unchanged; readAt is the traveler-side marker only.
- **Site search (D40b):** /search is a server component fanning out to the
  four published-only sources the site already serves (destinations, tours,
  experiences by q; curated packages filtered locally since that list
  endpoint has no q yet) and reuses the existing cards. The header gains a
  native GET form (desktop) and a Search entry in the mobile bottom nav;
  no JS needed. Verified live with the current catalog (destination match
  + truthful empty state; packages/tours return empty until content exists).
- **SEO structured data (D40c):** root layout emits Organization (sameAs
  from site settings) and WebSite JSON-LD including a SearchAction pointing
  at /search; metadataBase comes from the new NEXT_PUBLIC_SITE_URL (web
  app reads apps/web/.env.local, NOT the root .env - initial append to the
  wrong file was found by smoke because a comma-joined WEB_APP_URL list
  produced a garbage URL; now mirrors only the FIRST origin, quote-stripped:
  the tunnel URL, same preview-era ordering rule as D39). Package pages
  emit Product (price from priceMinor/currencyCode, availability InStock)
  and BreadcrumbList; destination pages already shipped TouristAttraction
  JSON-LD with geo/address (D23) and are left as-is. Everything is built
  from data the page actually renders.
- **WhatsApp (D40d):** floating chat button in the root layout (wa.me deep
  link from settings.whatsapp) and an "Ask on WhatsApp" CTA with a prefilled
  question on package pages. Both render nothing while the number is unset
  (current production state), so nothing fake is advertised; the owner turns
  them on by typing the number into /admin/settings.
- **Verified:** unit 175/175 (5 new notifications-service tests covering
  mapping, ownership, idempotence, bulk scope); typecheck + lint green on
  api/web/types/validation; clean next build with dev servers stopped.
  Live smoke through localhost proxy AND the tunnel: anonymous inbox calls
  401, seeded EMAIL row (shaped like the D36 writer's rows) listed with
  unread=1, PATCH mark-read wrote readAt (unread 0, second PATCH idempotent),
  read-all on empty unread returns 0, foreign id 404, tunnel login + inbox
  reads 200; smoke user + injected row cleaned afterwards (users and
  notification rows back to baseline). Root JSON-LD confirmed exact-content
  (Organization/WebSite/SearchAction, single canonical origin) in served
  HTML. NOT yet exercised: real booking -> notification -> inbox in one
  browser flow (no published package exists right now; the writer already
  has unit coverage and the inbox surface is what D40 changed), the FAB
  (needs the owner's real number) and the same-origin session flow in a
  real browser (owner check on /account/notifications and the bell badge).

## D41 - Feature program Phase 2a: seat-managed departure dates (2026-10-26)

Owner survey locked the Phase 2 decisions; this increment ships departures
(availability). The same migration and increment also ships booking-verified
moderated reviews (D42 below).

- **Schema (migration 0005_package_reviews_departures, applied to Neon,
  additive only):** new PackageDeparture table (one row per package and
  calendar day, unique packageId+date, seats count); nullable
  PackageBooking.departureId FK (ON DELETE SET NULL keeps legacy and
  open-dated requests valid); new PackageReview table (unique bookingId,
  status default PENDING, decisionNote for the rejection reason) - the old
  operator-domain Review model is untouched. No existing rows affected.
- **Departures behavior:** admins add explicit dates with seat counts on the
  package editor (single date, or the same weekday repeated for up to 12
  weeks; existing dates are skipped, not fatal). When a package has any
  future departure the traveler's booking form swaps the free date input for
  a departure picker showing seats left per date, and the API rejects
  open-dated requests (DEPARTURE_REQUIRED), past dates, and any party bigger
  than the remaining seats (DEPARTURE_FULL). Remaining seats are derived,
  never decremented: seats minus the party size of live bookings (all statuses
  except CANCELLED/REFUNDED/EXPIRED), so a cancellation releases seats
  automatically while a merely-pending request already holds them. Seat cuts
  below the already-held count are refused (DEPARTURE_SEATS_BELOW_BOOKED) and
  deleting a departure that still holds seats is refused
  (DEPARTURE_HAS_BOOKINGS); releases happen through the booking lifecycle,
  never silently. Packages without departures keep the existing open-dated
  flow (backward compatible; production had zero packages at ship time).
- **Endpoints:** public GET /api/packages/:slug/departures (future dates with
  seats left; full dates drop out), admin GET/POST /api/admin/packages/:id/
  departures, POST .../departures/weekly, PATCH/DELETE .../departures/:id.
- **Verified live:** seeded throwaway published package (title "Smoke journey
  D41 (throwaway)") with a future 4-seat and a past departure; public list
  showed only the future date; an open-dated POST /api/bookings answered 409
  DEPARTURE_REQUIRED; a past-date attempt was stopped by the shared start
  date validation; a party of 5 against 4 seats answered 409 DEPARTURE_FULL;
  a real signed-in request with departureId created PENDING_PAYMENT
  PB-MW5SEG and the public list went to remaining=2 (validated through both
  the API origin and the web proxy rewrite). Unit gates: 195/195 tests (5 new
  departures booking tests, 15 new review tests), typecheck + lint green on
  api/web/types/validation, clean next build (45 routes). Honest limits: the
  admin screens (departures manager, weekly quick-add) are unit-mocked only -
  no admin password lives in the repo, so console flows are owner-verified;
  the smoke publication was deleted back to baseline (0 packages, 0 smoke
  users, 0 reviews).

## D42 - Feature program Phase 2b: booking-verified moderated package reviews (2026-10-26)

Same increment as D41; owner survey rules: packages only, unlocked by a
team-CONFIRMED booking, 100 percent pre-moderation (OQ8 now recorded as
resolved in OPEN_QUESTIONS).

- **Gate:** POST /api/reviews requires the signed-in traveler to hold a
  PackageBooking with status CONFIRMED for that package (403
  REVIEW_NOT_UNLOCKED otherwise) and no earlier review by them for it (409
  REVIEW_ALREADY_SUBMITTED, enforced over the unique bookingId plus a
  userId+packageId check); submissions land PENDING and are audited
  (REVIEW_SUBMITTED). GET /api/reviews/status?packageId= lets the package
  page ask silently: eligible is true only with a confirmed booking, existing
  returns any prior review's status.
- **Public surface:** GET /api/reviews?packageSlug= returns APPROVED reviews
  only plus the star average (one decimal) and count; the author shows the
  shared display name or "Traveler" - never an email. The package page lists
  approved reviews with the average; Product JSON-LD gains aggregateRating
  ONLY when at least one approved review exists (numbers the page actually
  renders, never invented; with none approved the page shows an honest empty
  state instead).
- **Moderation:** /admin/reviews queue (console nav "Package reviews" with a
  pending badge, dashboard counter reviewsPending) - approve publishes
  (status APPROVED, audited REVIEW_APPROVED), reject requires a written
  reason stored in decisionNote (REVIEW_REJECTED, audited, reason shown on
  the rejected row); both decisions are possible only while PENDING (409
  REVIEW_STATUS_IMMUTABLE - decided rows stay decided, the same philosophy
  as booking decisions D36). Travelers submit from a review form on the
  package page that appears only for eligible members; CONFIRMED bookings
  in /account link straight to their journey's review section.
- **Verified live (on the D41 smoke package until it was cleaned):** after
  the smoke booking was flipped to CONFIRMED (standing in for the
  unit-tested admin decide path), status answered eligible=true, the
  submission returned PENDING, the public list stayed empty while PENDING
  (moderation holds it), a duplicate answered 409, and status then reported
  the existing PENDING row; an unconfirmed second traveler answered 403
  REVIEW_NOT_UNLOCKED; anonymous requests 401. The SSR package page was
  verified in served HTML: reviews section with the truthful empty state and
  NO aggregateRating in the Product JSON-LD while nothing is approved. After
  these checks the throwaway graph was deleted (0 users, 0 packages, 0
  reviews baseline). Owner moves: exercise /admin/reviews on the first real
  reviews, add departures to a real published package, then publish it so
  travelers see the picker.

## D43 - Feature program Phase 3a: quote-only transport listing requests (2026-10-26)

Owner survey rule: listing booking requests cover transport/rides only, and
everything is quote-based - no prices in the data, no seats, no payment state.
Discovery finding: the reusable Listing model had NO public surface at all
(the public catalog reads the separate Tour/Experience tables), so a small
read surface ships with this feature; request-a-quote is impossible without
it.

- **Public transport surface:** GET /api/catalog/transport and
  /api/catalog/transport/:providerSlug/:listingSlug return PUBLISHED listings
  whose provider type is TRANSPORT_COMPANY or DRIVER_PARTNER. The select
  deliberately excludes every price field (quote-based). The SSR pages are
  /transport (browse cards) and /transport/[providerSlug]/[listingSlug]
  (detail + request panel); /transport joined the sitemap. Cards show
  service area, capacity and verification status only.
- **Request flow (code TB-, LB- rejected in favour of the transport
  reading):** POST /api/listing-requests (signed-in only, like package
  bookings) takes listingId, a future travel date, party size 1-40 and
  optional notes; the listing must be PUBLISHED and transport-owned (404
  otherwise) and the party must fit its capacity (409
  REQUEST_ABOVE_CAPACITY). Rows are ListingBooking (migration 0006): the
  booking reference is minted TB-XXXXXX from the same unambiguous alphabet
  as PB-, meaning status PENDING -> CONFIRMED | CANCELLED (plain string
  column by design - package payment-rail statuses do not apply to a quote
  conversation). Audit LISTING_REQUEST_SENT, in-app notification, traveler
  receipt email ("Nothing is booked yet - the team will reply with a
  quote"), plus an owner inbox copy when ADMIN_EMAIL is configured.
- **Team queue (D43 console):** /admin/transport with a pending badge and a
  dashboard counter (listingRequestsPending). The team's quote is a written
  message: POST /api/admin/listing-requests/:id/quote emails it to the
  traveler and stores the latest text on the row (quoteNote/quoteAt) so the
  traveler can re-read it on their account page - the quote text itself is
  the price, recorded no further. Confirm/cancel close the conversation
  (409 REQUEST_STATUS_IMMUTABLE afterwards, messages optional and emailed,
  audited LISTING_REQUEST_CONFIRMED/CANCELLED). Delete is plain ops cleanup
  (a quote conversation is not a financial record - every state deletable,
  audited). Travelers see their requests + the quote on /account.
- **Live-verified with throwaway rows:** seeded provider "Smoke Rides D43"
  + published listing; the /transport SSR page listed it; GET transport
  detail served no price field; unauthenticated request attempt 401; a real
  traveler session created a TB- request (the receipt email ran through the
  mailer - a mailbox is not observable in a smoke, and the template text is
  unit-asserted), /me listed it, and a party-size-9 retry against the
  4-seat listing answered 409. The smoke user was promoted to admin in the
  DB for the console endpoints (no real admin password in the repo): the
  queue listed the request, the written quote stored on the row and its
  email succeeded, CONFIRMED decided it, and a second decision answered 409
  REQUEST_STATUS_IMMUTABLE. markPaid checks ran against a throwaway package
  booking (refusal while payment-pending, paidAt recorded once, refusal
  when already paid) and the traveler's /bookings/me exposed paidAt.
  Cleanup restored the baseline exactly: 0 users, the provider, listing
  and smoke package removed, and the settings row deleted again after the
  payment-instructions check.

## D44 - Feature program Phase 3b: manual payments, Mobile Money + bank (2026-10-26)

Owner survey rule: payments are manual - Mobile Money and bank transfer.
Nothing is charged on the site; no amounts are stored or emitted by the
platform, and the traveler's booking code is the payment reference.

- **Settings:** the admin settings form gained a "Payments (manual)"
  section with two freeform blocks (momoInstructions, bankInstructions;
  SiteSettings columns in migration 0006). They are never a public surface -
  they exist so the confirmation email can carry the team's own payment
  details verbatim.
- **Confirmation email (D36 decide CONFIRMED):** when either block is
  filled, the traveler email gains a "How to pay" section: the booking
  code as the payment reference, then the Mobile Money and bank blocks
  verbatim. The email copy itself adds no amounts or prices anywhere; with
  no blocks filled the email says nothing has been charged yet and the
  team will follow up. Unit-tested (template renders the reference line
  and both blocks verbatim).
- **"Mark paid":** POST /api/admin/bookings/:id/paid records paidAt
  (PackageBooking.paidAt, nullable) for CONFIRMED bookings only (409
  BOOKING_NOT_CONFIRMED otherwise; 409 BOOKING_ALREADY_PAID - a paid date
  is set once). Status is untouched: later transitions stay with the
  payment rails. Audited PACKAGE_BOOKING_PAID, in-app notification, and a
  short "Payment received ... you are all set" email (new booking email
  kind "paid"; the copy never asks for card details by email). The admin
  bookings queue shows "Mark paid" on confirmed rows and "Paid <date> on
  record" afterwards; the traveler's /account booking card shows the same.




## D45 - Feature program Phase 4: managed uploads behind a storage abstraction (2026-10-26)

Owner rule: the image host is deferred until they pick a provider - so Phase 4
builds the abstraction and a dev/preview driver, with the admin gallery as the
first customer. Nothing else in the feature program changes.

- **Abstraction (apps/api/src/modules/storage/):** a minimal StorageDriver
  (put/get/delete) plus the dev LocalStorageDriver behind
  STORAGE_DRIVER=local (default), rooted at UPLOAD_DIR (default
  <apps/api>/uploads, gitignored). Any other configured driver name fails
  fast at boot - there is no silent fallback, and plugging Cloudinary or
  Supabase later is one driver class, not a feature refactor.
- **Upload route:** POST /api/admin/uploads is admin-only multipart (multer
  memory storage via @nestjs/platform-express; multer added to the API where
  it already rode transitively, plus @types/multer). Whitelist
  JPEG/PNG/WebP/GIF/AVIF; empty files are refused and the 5 MB cap caps twice
  (multer limits + service check) - sizes above the cap surface as multer's
  413. The traveler-supplied filename is discarded: the platform mints
  gallery/<24hex>.<ext>, audited UPLOAD_STORED (key, scope, bytes, mimeType,
  url). GET /api/uploads/<key> is public and derives the content type from
  the minted extension; keys are unique per object, so responses carry an
  immutable cache header (public, max-age=31536000).
- **First-party URLs:** GalleryItem.imageUrl accepts either an external
  https URL or the platform's own /api/uploads/<key> path (anything else -
  javascript:, data:, bare paths - is refused by the shared schema). The
  relative path resolves on localhost, LAN and the dev tunnel with no new
  rewrite and no env: Next's same-origin proxy already forwards /api/* to
  the API, so the browser never sees the API port or the storage root.
- **Delete semantics:** deleting a gallery row never deletes the object.
  The URL may be referenced elsewhere and a broken image on a live page is
  worse than an unreferenced file; reclaiming storage is deliberate ops
  work, not a delete side effect.
- **Admin UX:** the gallery editor gained an upload picker (same whitelist,
  5 MB) that fills the URL field with the answered path; api.uploadFile
  goes through the same-origin proxy with the browser-set multipart
  boundary (apiRequest never stamps its JSON content-type on FormData
  bodies). Pasting an external URL keeps working,
  and other URL fields (listing heroes, destination media) stay
  paste-a-URL until the owner asks for them.

Verified: 229/229 unit tests (+19: driver round-trip/traversal/
extension-map, service whitelist/mint/audit, fail-fast driver selection),
typecheck + lint + build green (47 routes), and a 31-check live flow on a
throwaway user (401/403 gates, minted key shape, byte-exact anonymous
serving with derived content type and the immutable header, unknown/
traversal keys as 404 misses, text/empty/oversize rejections, gallery row
from the uploaded path, public list visibility, external-URL backward
compat, javascript: rejection, UPLOAD_STORED audit, SSR /gallery serving
the path, and delete-keeps-file serving) cleaned to a true zero baseline
including the files on disk.
