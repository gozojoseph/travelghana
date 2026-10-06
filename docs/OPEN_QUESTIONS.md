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
| 8 | Reviews moderation rules (auto-publish vs pre-moderate). | Reviews module (Phase 2) | You | Deferred |
| 9 | Notification channel at MVP: email only, or email+SMS? SMS costs. | Notifications | You | Deferred — assume email first |
| 10 | Ghana Travel Passport, AI assistant — Phase 3 as planned. | — | — | No action |
| 11 | Should publishing a listing require provider verification (admin-approved), or can operators self-publish at MVP? Currently: self-publish (no gate in schema). | Public catalog increment | You | Ask before public listing search ships |
| 12 | Should admin-moderation gate listings (provider DRAFT→PENDING_REVIEW, admin-only PUBLISHED/PAUSED/ARCHIVED)? Currently provider can self-publish via `published: true`. Recommendation: gate the reusable Listing `published` flag behind admin review. | Listing module | You | Open |

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
