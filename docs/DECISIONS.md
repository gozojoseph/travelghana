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
