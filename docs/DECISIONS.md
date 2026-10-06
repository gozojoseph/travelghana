# Decision Log

Format per §55: Decision / Date / Reason / Alternatives considered / Consequences.
Dates: 2026-10-01.

---

## D1. Payment collection — Platform merchant of record
- **Decision:** Traveler always pays TravelGhana (Paystack first). Platform owes providers via a
  payout ledger (`Payment → Transaction → Refund`, `Commission`, `ProviderPayout`).
- **Date:** 2026-10-01
- **Reason:** Single payment flow; easiest refunds, disputes, commission control; strongest
  traveler trust and cleanest ops story.
- **Alternatives:** Paystack subaccount auto-split; providers collect themselves (rejected —
  weak control, poor trust).
- **Consequences:** Payout workflow + ledger reconciliation is a platform obligation; payments
  module must track platform liabilities per booking. Paystack subaccounts NOT required at MVP.

## D2. Currency — Charge in GHS, USD display estimates
- **Decision:** All charges denominated in GHS (minor units). USD shown as display estimates for
  international travelers. `currencyCode` columns retained everywhere; multi-currency later
  without migration pain.
- **Date:** 2026-10-01
- **Alternatives:** GHS-only display; multi-currency day 1 (rejected — complexity).
- **Consequences:** Need a rates strategy (manual admin rates to start, FX API later); Money
  must never mix display-converted and charge-converted amounts.

## D3. Roles — One account, many roles (recommended by Buffy; confirm)
- **Decision:** RBAC with role membership table so one `User` can hold several roles
  (traveler + driver, hotel manager + tour operator) with a role switcher.
- **Date:** 2026-10-01
- **Reason:** Realistic for Ghana's market (guides who drive; providers who travel). Chosen by
  Buffy under delegation ("recommend").
- **Alternatives:** One role per account (rejected — forces duplicate accounts).
- **Consequences:** Every permission check scoped per role; UI needs role-switch affordance.
- **Status:** CONFIRMED by you — 2026-10-02.

## D4. Maps — Mapbox first, behind an abstraction
- **Decision:** Mapbox for map UI, geocoding, directions. All map access via a `MapsAdapter`
  interface so the provider can be swapped.
- **Date:** 2026-10-01
- **Alternatives:** Google Maps Platform (cost); Leaflet + OSM (data/styling).
- **Consequences:** Mapbox token required in env; adapter keeps us free to add Google later.

## D5. Launch model — Operator-first marketplace (recommended by Buffy; confirm)
- **Decision:** MVP ships with TravelGhana ops creating/managing vetted inventory through Admin.
  Provider self-onboarding/verification portal moves to Phase 2.
- **Date:** 2026-10-01
- **Reason:** Fastest path to validating the traveler experience; the data model stays
  marketplace-shaped (Provider-owned services) so nothing needs rewriting.
- **Alternatives:** Marketplace day 1 (rejected for MVP — doubles scope).
- **Status:** CONFIRMED by you — 2026-10-02.

## D6. Custom trip enquiries — Concierge team
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

## D10. Local dev database — embedded Postgres (temporary)
- **Decision:** Local development uses an embedded Postgres 17 on localhost:5432
  (`infrastructure/local-db.mjs`, data dir `node_modules/.local-postgres/data`) instead of
  Docker Compose. `infrastructure/docker-compose.yml` is kept for machines where Docker works.
- **Date:** 2026-10-03
- **Reason:** Docker Desktop is installed but its engine fails (500) because WSL is not
  installed on this machine; installing WSL requires admin + reboot, which is the product
  owner's call. Embedded Postgres was the least-invasive way to get a real database.
- **Alternatives:** Install WSL/Docker (blocked — needs admin/reboot); SQLite (rejected —
  must validate against Postgres semantics).
- **Consequences:** Dev DB is wiped/recreated via `prisma db push`; team members with working
  Docker should use the compose file. Remove this workaround once WSL/Docker is available.

## D11. Operator MVP scope — tours + experiences, four onboarding types (Buffy, recommended)
- **Decision:** Operator self-service covers provider onboarding (one provider per account,
  1:1) plus Tour and Experience listing CRUD with publish/unpublish. Onboarding types are
  limited to those with a matching `Role`: TOUR_OPERATOR, HOTEL, EXPERIENCE_PROVIDER,
  TRANSPORT_COMPANY. Hotels (rooms), transport (vehicles/drivers), events, restaurants and the
  public catalog ship in later increments. Added `AnyRole` decorator (any-of authorization)
  alongside the all-of `@Roles`.
- **Date:** 2026-10-03
- **Reason:** Tours and experiences share one shape (title/price/city/published) — smallest
  slice that makes the marketplace two-sided. DRIVER_PARTNER belongs to the driver module;
  EVENT_ORGANIZER/RESTAURANT have no RBAC role yet.
- **Alternatives:** All listing types day 1 (rejected — large surface, thin value); all-of
  role check per route (rejected — would force operators to hold every operator role).
- **Consequences:** Operators self-publish at MVP (open question #11 covers whether admin
  verification should gate that); slug generation is name/title-based with numeric suffixes;
  ownership scoping returns 404 (no existence oracle) for foreign listings.
