# Open Questions & Assumptions

Per §54/§55. "Blocking" = must be answered before the related phase of implementation.

## Open questions

| # | Question | Blocking | Owner | Status |
|---|----------|----------|-------|--------|
| 1 | Confirm D3: one account may hold multiple roles (recommended). | Schema for auth/RBAC | You | ✅ Resolved 2026-10-02 — confirmed |
| 2 | Confirm D5: operator-first launch; provider self-onboarding in Phase 2. | Phase 1 scope | You | ✅ Resolved 2026-10-02 — confirmed |
| 3 | Paystack live account/keys available at integration time? | Payments module | You | Ask at Phase 1 payments step |
| 4 | Mapbox token (public + secret) available? | Maps module | You | Ask at Phase 1 explore step |
| 5 | Commission structure & payout timing (rates not needed until payouts ship). | Phase 2 payouts | You | Deferred |
| 6 | Cancellation policy per service type (24h? tiered? per-provider?). | Booking engine rules | You | Deferred — MVP uses simple per-service window |
| 7 | FX display rates source for Phase 2 (manual → API?). | Phase 2 | Buffy to propose | Deferred |
| 8 | Reviews moderation rules (auto-publish vs pre-moderate). | Reviews module (Phase 2) | You | Resolved 2026-10-26 via D41 (owner survey): 100% pre-moderation. Package reviews only, unlocked by a team-CONFIRMED booking; every submission lands PENDING in the admin queue; APPROVE publishes, REJECT keeps a required written reason on the record; decisions are possible only while PENDING and are audited. |
| 9 | Notification channel at MVP: email only, or email+SMS? SMS costs. | Notifications | You | Deferred — assume email first |
| 10 | Ghana Travel Passport, AI assistant — Phase 3 as planned. | — | — | No action |
| 11 | Should publishing a listing require provider verification (admin-approved), or can operators self-publish at MVP? Currently: self-publish (no gate in schema). | Public catalog increment | You | Resolved 2026-10-19 via D20: publication is gated by the admin review decision itself (DRAFT -> PENDING_REVIEW -> APPROVE publishes); operator VERIFIED status is a separate editorial signal and is not required to submit. Revisit if the queue becomes noisy. |
| 12 | Should admin-moderation gate listings (provider DRAFT→PENDING_REVIEW, admin-only PUBLISHED/PAUSED/ARCHIVED)? Currently provider can self-publish via `published: true`. Recommendation: gate the reusable Listing `published` flag behind admin review. | Listing module | You | Resolved 2026-10-19 via D20 - the gate shipped: only PENDING_REVIEW submissions are reviewable, APPROVE -> PUBLISHED (stamps publishedAt), REJECT -> DRAFT with a required reason, SUSPEND -> PAUSED. Public browse exposes PUBLISHED only. |
| 13 | When trips/itineraries become shareable, what exactly is shared — the full day-by-day plan, only confirmed bookings, or a curated traveler view? | Sharing / provider coordination | You | Resolved 2026-10-19 via D19 - sharing is a token-gated sanitized companion view (plan outline: days, times, places, interests, party size); never prices, notes, warnings or traveler needs. Booking-derived sharing (only confirmed bookings) deferred to Phase 4. |
| 14 | When may providers see traveler needs (pre-booking request, post-booking confirmation, or per-need consent)? Sensitive under §11 — currently owner-private with no consent captured. | Provider need-visibility rules | You | Open — recommendation: per-need opt-in at booking confirmation |
| 15 | Prisma schema type mismatch: `@db.Uuid` FK scalars (`Location`/`Provider`/`Listing` `cityId`/`regionId`) reference text cuid `id`s, so a fresh `prisma db push` (and `test:int`) fails — Postgres rejects `uuid` vs `text` FKs. Finish the uuid migration (ids become uuid) or drop the stray annotations? The uncommitted `schema.prisma` WIP adds more `@db.Uuid` columns and also fails Prisma relation validation. | Test DB rebuild / `test:int` | You | ✅ Resolved 2026-10-19 — annotations reverted; ids stay cuid/text. Schema validates, dev DB pushed, fresh-DB `test:int` passes. A full uuid migration remains a separate future decision. |
| 16 | Gallery images are URL-based (paste a link) with no upload/storage pipeline. When do we add managed uploads (object storage + processing) and move editorial media onto it? | Gallery / media | You | Upgraded 2026-10-26 (D45): managed uploads now exist behind a StorageDriver abstraction (admin gallery first; local-disk dev driver, first-party /api/uploads URLs). Still open: pick the production provider (Cloudinary/Supabase/other) and provide keys before hosting volume - that choice is a single driver implementation, not a refactor. Image processing/sizing stays out of scope until then. |
| 17 | Planner discovery currently surfaces Places and attractions (+ tours/experiences/packages via the API in the live catalog). When do stays, restaurants, events and transport enter the planner discovery surface? | Phase 3 inventory | You | Open — D18 labels accommodation/transport gaps with planner warnings; their discovery follows their inventory phases. |
| 18 | Guest wizard drafts live in `sessionStorage` and restore after `/login?next=…` (D18 §6). Should the transfer become server-side (anonymous draft persisted to the API before auth) so drafts survive different devices or expired sessions? | Phase 2 — review/enquiry capture | Buffy to propose | Upgraded 2026-10-19 (D19): drafts moved to localStorage - same device survives restarts and travels through the login handoff. Cross-device/server-side transfer stays open. |
| 19 | The listing review queue lets admins park a PENDING_REVIEW listing as PAUSED (D20), but PAUSED is currently a dead end: the provider cannot resubmit from PAUSED and the admin queue only touches PENDING_REVIEW. Which revival path do we build - admin UNSUSPEND back to PENDING_REVIEW, provider edit-and-resubmit from PAUSED, or both? | Listing lifecycle | Buffy to propose | Open - the UI copy is honest about this (parked, out of the review queue); no faked revival buttons ship. |
| 20 | Catalog admin treats cities/regions as read-only selectors (D20) even though destinations and their coordinates are fully editable. When do we add admin CRUD for cities/regions (and where do their coordinates/labels come from - manual curation or a geodata source)? | Catalog admin | You | Open - fine for a hand-curated catalog; revisit before opening catalog editing to non-admins. |
| 21 | The admin subdomain (D21) still renders the shared public header/footer/nav around the console. When do we build a dedicated admin shell (route-group refactor so /admin pages omit the public chrome)? | Admin console | Buffy to propose | Open - shared chrome with links pointed at the main site keeps navigation working; refactor when the console feels cluttered. |
| 22 | D22 removed the /operator web console, but the API operator module (provider onboarding, my tours/experiences, listings endpoints) stays live and tested. Decide its fate: delete the endpoints, rebuild onboarding inside the admin console, or reintroduce an operator surface later. | Operator APIs | Buffy to decide | Open - admin provider verification and the published catalog are fed through it, so the module cannot be dropped blindly. |

## Legal / professional review required BEFORE production launch (§11, §41)
These are flagged, not blocking development, but MUST be reviewed by qualified professionals:

1. **Ghana Data Protection Act, 2012 (Act 843)** compliance for personal + traveler-need data:
   registration as data controller, lawful basis, consent capture, retention schedules,
   data-subject rights workflows.
2. **Traveler Needs data handling:** data minimization, need-to-know visibility rules, access
   logging, encryption at rest — privacy-by-design review of the implemented rules.
3. **Driver/vehicle verification:** DVLA licence classes, roadworthiness certification,
   insurance minimums, company vs independent driver obligations.
4. **Ghana Tourism Authority** licensing/registration for providers (tour operators, hotels).
5. **Consumer protection:** cancellation/refund disclosure, terms of service, dispute process.
6. **Payments:** PCI scope (staying out of scope via Paystack hosted checkout), PSP agreements.

## Standing temporary assumptions
See DECISIONS.md §D9. Each has a trigger for revisiting.
