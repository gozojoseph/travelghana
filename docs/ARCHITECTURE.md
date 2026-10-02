# Architecture

## 1. Product domains

| Domain | Contains | Notes |
|---|---|---|
| Identity | User, RoleMembership, Session, verification | Multi-role per D3 |
| Catalog | Region → City → Destination → Attraction; content | Discovery backbone |
| Marketplace | Provider, Tour, Experience, Hotel+Room, Event | Operator-created at MVP (D5) |
| Transport | Driver, Vehicle, TransportService (transfer/day-hire/multi-day) | Vehicle + Driver + Service model |
| Trip | Trip, TripTraveler, ItineraryDay, ItineraryItem, TravelerNeed | Trip-first architecture |
| Booking | Booking, AvailabilitySlot, RoomInventory, holds | Transactional, lock-based |
| Money | Payment, Transaction, Refund, Commission, ProviderPayout | Merchant of record (D1) |
| Enquiry | Enquiry → concierge workflow → Trip | D6 |
| Engagement | Conversation/Message, Notification, Review, Favorite | Context-scoped messaging |
| Platform | Admin, RBAC, AuditLog, settings, content | Separate admin app |

## 2. Technical architecture

- **Monorepo:** pnpm workspaces + Turborepo.
- **apps/web** — Next.js (App Router, TypeScript, Tailwind, shadcn/ui, Lucide). Public site,
  traveler dashboard, provider portal (role-gated), PWA.
- **apps/admin** — Next.js admin console (separate app, RBAC-gated).
- **apps/api** — NestJS modular monolith. Domain modules listed below, each with
  controller/service/repository boundaries so extraction is possible later.
- **packages/database** — Prisma schema + client + seed.
- **packages/types** — shared DTO/domain types.
- **packages/validation** — zod schemas shared by web + api.
- **packages/ui** — design-system components + tokens (two-mode: Discovery / Travel).
- **packages/config** — shared tsconfig/eslint/tailwind config.

- **PostgreSQL** via Prisma. **Redis + BullMQ** for background jobs (emails, webhooks,
  availability expiry). **Mapbox** via MapsAdapter (D4). **Paystack** via PaymentProviderAdapter,
  merchant of record (D1). **Sentry + PostHog** planned. **Vitest** unit, **Playwright** e2e later.

### API domain modules (NestJS)
auth · users · rbac · destinations · catalog (tours/experiences/hotels) · transport (drivers,
vehicles, services) · trips · bookings · availability · payments · enquiries · messaging ·
notifications · reviews · admin · audit

### Booking engine principles
- Availability is represented as finite inventory rows (slots / room nights).
- Booking = DB transaction: `SELECT ... FOR UPDATE` on inventory rows → create booking in
  `PENDING_PAYMENT` with a short hold → confirm on payment webhook → release on expiry job.
- No availability check outside a transaction. Idempotent webhook handling. Redis lock for
  hot services as an extra layer when needed.

### Payments principles
- Amounts: integer minor units + `currencyCode` (D8). GHS charge, USD display (D2).
- Adapter interface: initialize, verify, refund, webhook-normalize. Paystack first.
- Platform owes providers via Commission + ProviderPayout ledger (no subaccounts at MVP).

## 3. Two UI modes (§34)
- **Discovery mode:** imagery-led, destination cards, maps, storytelling.
- **Travel mode:** calm, itinerary-first, large touch targets, driver info, emergency access.

## 4. Development sequence
1. ✅ Docs: decisions, open questions, architecture, ERD
2. Monorepo scaffold + design tokens + shared packages
3. Auth/users/RBAC (sessions, email verification, role switcher)
4. Destinations + explore + maps + SEO
5. Trip + itinerary builder
6. Catalog (tours/experiences/transport) + search
7. Booking engine (transactions, holds)
8. Payments (Paystack sandbox)
9. Enquiry + concierge admin workflow
10. Provider portal basics (Phase 2 expands per D5)
11. Admin platform hardening + audit logs
12. PWA offline + polish (Phase 2: messaging, reviews, notifications, hotels, payouts)
