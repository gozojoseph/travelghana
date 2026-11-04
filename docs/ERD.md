# ERD - TravelGhana v0.7 (approved)

Status: **APPROVED — implemented.** `packages/database/prisma/schema.prisma` is the
authoritative artifact; this document is its human-readable summary. Where the two
disagree, the schema wins and this file is the bug.

**Source of truth:** `packages/database/prisma/schema.prisma` — **51 models, 32 enums.**
D3 (multi-role) and D5 (operator-first) confirmed by product owner; see `DECISIONS.md`.

> **Version history.** v0.1 was circulated for review. v0.2 is the approved design as
> landed. Note that an earlier status line on this file claimed "34 models" and a
> "DRAFT — awaiting review" status; both were stale and were corrected on 2026-10-02
> once the schema was reconciled against this document. v0.3 (2026-10-19) adds the D18
> trip-planner fields/enums below plus the D15–D17 models (`Package`, `PackageDay`,
> `GalleryItem`), and finally documents the reusable `Listing` / `ListingExtension` /
> `Location` trio that shipped with operator onboarding (`8c4cfcf`) but had been missing
> from this file. v0.4 (2026-10-19) adds the D19 `TripShare` model (sanitized
> token-gated companion view). v0.5 (2026-10-19, D20) adds `Attraction.published`
> (the one schema change of the admin console — D20 deliberately ships no new
> admin tables; every console surface reads/writes existing rows), and fixes two
> stale column names in this file: the audit-log Json column is `meta` (was
> written `metaJson`) and `Notification.payload` is `payload` (was
> `payloadJson`). An earlier header said "47 models, 26 enums"; that count
> predated all of the above. v0.6 (2026-10-20, D24) adds a 50th model:
> `SiteSettings`, the singleton contact/social row edited from the admin
> console and rendered by the public footer + about page. The schema remains
> authoritative; correct this file if they disagree. v0.7 (2026-10-20, D25)
> adds a 51st model: `PackageBooking`, the login-gated "Book now" request row
> for curated packages (platform-owned editorial journeys without provider
> inventory), reusing the `BookingStatus` enum and audited on creation.

## Domains and relations

### Identity
```
User { id, email(unique), passwordHash, emailVerifiedAt, phone?, name,
       avatarUrl?, status: ACTIVE|SUSPENDED, createdAt, updatedAt }
RoleMembership { id, userId, role: TRAVELER|DRIVER|TOUR_OPERATOR|HOTEL_MANAGER|
                 TRANSPORT_COMPANY|EXPERIENCE_PROVIDER|ADMIN, status:
                 PENDING|ACTIVE|SUSPENDED }        -- D3: user may hold many roles
Session { id, userId, tokenHash, expiresAt, userAgent, ip }
EmailVerificationToken / PasswordResetToken { tokenHash, expiresAt, consumedAt }
```

### Catalog (discovery)
```
Region { id, slug(unique), name, description, mapPolygon?, sort }        -- 16 Ghana regions
City { id, regionId, slug, name, description, lat, lng }
Destination { id, cityId, slug, name, category: BEACH|HISTORICAL|CULTURAL|NATURE|
              CITY|FOOD|ADVENTURE, summary, description, lat, lng, heroImageUrl?,
              featured, published }
Attraction { id, destinationId?, cityId?, slug, name, description, lat, lng, category, published }
-- D20: `published` (default true) is the admin unpublish switch for public discovery
-- (fresh destinations default to draft, attractions to visible -- see catalog admin).
```

### Marketplace
```
Provider { id, userId?, type: TOUR_OPERATOR|HOTEL|EXPERIENCE_PROVIDER|
           TRANSPORT_COMPANY|RESTAURANT|EVENT_ORGANIZER, name, slug, description,
           verificationStatus: UNVERIFIED|PENDING|VERIFIED|REJECTED|SUSPENDED,
           contactEmail, contactPhone, logoUrl?, cityId? }
  -- userId nullable: operator-created inventory at MVP may have no owning account yet (D5)

Tour { id, providerId, slug, title, summary, description, durationHours?, days?,
       groupMin, groupMax, basePriceMinor, currencyCode, cityId?, meetingPoint?,
       category, published, heroImageUrl? }
Experience { id, providerId, slug, title, description, durationMinutes?, priceMinor,
             currencyCode, cityId?, category: COOKING|ART|MUSIC|DANCE|CULTURE|HERITAGE|
             NATURE|ADVENTURE|COMMUNITY, published, heroImageUrl? }
Hotel { id, providerId, slug, name, description, starRating?, cityId?, address,
        lat, lng, checkInTime?, checkOutTime?, published }
Room { id, hotelId, name, roomType, capacity, beds, pricePerNightMinor, currencyCode,
       totalRooms, description, amenities[] }
Event { id, organizerProviderId?, slug, name, description, venueCityId?, startsAt, endsAt }
```

### Transport (Vehicle + Driver + Service)
```
Driver { id, userId?, providerId? (transport company), displayName, photoUrl?,
         licenseNumber?, licenseVerifiedAt?, yearsExperience, languages[],
         serviceCityIds[], bio?, verificationStatus }
Vehicle { id, providerId?, driverId? (owner driver), category: SEDAN|SUV|MINIVAN|VAN|
          HIACE|BUS|LUXURY|OTHER, make, model, year, passengerCapacity, luggageCapacity,
          hasAc, accessibilityFeatures?, photos[], plateNumber?, verificationStatus }
TransportService { id, providerId, serviceType: AIRPORT_TRANSFER|FULL_DAY_DRIVER|
                   MULTI_DAY_DRIVER|POINT_TO_POINT|GROUP_TRANSPORT, vehicleCategoryId?,
                   basePriceMinor, currencyCode, pricingModel: FLAT|PER_DAY|PER_KM,
                   cityId?, published, rules? }
DriverVehicle { driverId, vehicleId }   -- m:n; a driver may operate several vehicles
```

### Reusable listings (operator onboarding, `8c4cfcf`)
```
Listing { id, providerId, slug(unique per provider), title, status: DRAFT|
          PENDING_REVIEW|PUBLISHED|PAUSED|ARCHIVED, description?, category?,
          serviceArea?, durationMinutes?, capacity, priceMinor, currencyCode,
          cityId?, regionId?, coordinatesLat?, coordinatesLng?, address?,
          meetingPoint?, whatIsIncluded?, whatIsExcluded?, requirements?,
          cancellationPolicy?, heroImageUrl?, publishedAt? }
ListingExtension { id, listingId (unique), content? }     -- long-form detail page
Location { id, cityId?, regionId?, address?, lat?, lng?, postalCode?, country }
   -- structured geo context (D4-compatible); direct FK scalars, inverse arrays
      not materialized (pre-existing gap, mirrors Booking.*)
```

### Trip (planner, D12 + D18)
```
Trip { id, ownerUserId, name, startDate?, endDate?, status: PLANNING|CONFIRMED|
       IN_PROGRESS|COMPLETED|CANCELLED, adults, children, budgetMinor?,
       currencyCode, notes?
       -- D18 wizard preferences (all optional-signal, safe defaults so existing
          rows and API-created trips stay valid without a wizard pass):
       interests: TripInterest[] @default([])      -- CULTURE_HERITAGE, BEACHES_COASTAL,
          NATURE_WILDLIFE, ADVENTURE_HIKING, FOOD_CUISINE, FESTIVALS_EVENTS,
          ART_CRAFTS_SHOPPING, NIGHTLIFE_ENTERTAINMENT, RELAXATION_WELLNESS,
          FAMILY_FRIENDLY
       travelPace: RELAXED|BALANCED|PACKED @default(BALANCED)
       budgetTier: BUDGET|MIDRANGE|PREMIUM|FLEXIBLE @default(FLEXIBLE)
       budgetType: PER_PERSON|PER_GROUP @default(PER_GROUP)
       budgetIncludesFlights: Boolean @default(false)
       arrivalPoint: String?
       destinationPreferences: String[] @default([])   -- Destination ids }
TripTraveler { id, tripId, name?, ageGroup?, isOwner }
TravelerNeed { id, tripTravelerId, category: ACCESSIBILITY|MOBILITY|DIETARY|ALLERGY|
               CHILDREN|SENIOR|PREGNANCY|MEDICATION|ASSISTANCE|OTHER, details?,
               consentGivenAt, providerVisibility: NONE|MINIMAL|FULL, detailsVisibleToProviders }
   -- §11: minimal info exposed to providers; access to details logged (AuditLog)

ItineraryDay { id, tripId, dayNumber, date?, title?, notes? }
   -- @@unique([tripId, dayNumber]); days may be undated (no invented dates)
ItineraryItem { id, tripId, itineraryDayId?, sortOrder, startTime?, endTime?,
                title,
                itemType: BOOKING|ATTRACTION|RESTAURANT|EVENT|NOTE|TRANSPORT|
                          ACCOMMODATION|TOUR|EXPERIENCE,
                bookingId?, attractionId?, destinationId?, tourId?,
                experienceId?, packageId?,
                -- estimate fields — never confirmed prices or bookings (D18):
                estimatedCostMinor?, currencyCode?, pricingBasis:
                    PER_PERSON|PER_GROUP|PER_NIGHT|PER_SERVICE|TOTAL?,
                estimateSource: LISTING|MANUAL?, priceSnapshotAt?,
                notes? }
   -- `itineraryDayId` is nullable: trip-level rows are unscheduled "ideas" in
      the tray. Listing-reference items snapshot the listing price at add time
      (`estimateSource=LISTING`, `pricingBasis` default `PER_SERVICE`,
      `priceSnapshotAt` stamped); editing the numbers converts the estimate to
      `MANUAL` — the server never overwrites a traveler's own estimate. Items in
      another currency than the trip's are excluded from totals and flagged
      (`CURRENCY_NOT_CONVERTED`); no FX conversion is invented. Moving an item to
      an undated day or the tray clears its times; moving between dated days
      rebases the stored timestamps onto the target date.
```

### Sharing (planner, D19)
```
TripShare { id, tripId, token(unique), createdAt, createdByUserId, revokedAt? }
   -- One active link per trip: creating a new share stamps `revokedAt` on the
      previous active row (rotation); DELETE (revoke) does the same. Token is
      32-char base64url (`randomBytes(24)`), unguessable but a bearer link:
      whoever holds the URL can read the companion view until it is rotated or
      revoked, and a dead/unknown token 404s as `SHARE_NOT_FOUND` (no
      indication the token ever existed). The public
      `GET /api/trips/share/:token` returns a *derived sanitized view*
      (name, dates, party size, interests, travel pace, per-day schedules with
      times + titles + item types + place names, unscheduled idea titles) — it
      never includes budgets/estimates, notes, planner warnings, traveler
      records or §11 needs, or booking state. The web renderer is
      `robots: noindex`. No models are denormalized: the view is projected on
      read, so owner edits surface on existing links until they are rotated.
```

### Curated packages (platform-owned, admin-managed)
```
Package { id, slug(unique), title, summary?, description?, destinationId?, durationDays,
          durationNights, priceMinor, currencyCode, heroImageUrl?, inclusions?,
          exclusions?, status: DRAFT|PUBLISHED|ARCHIVED, featured, publishedAt? }
PackageDay { id, packageId, dayNumber, title, description?, meals?, accommodation? }
   -- editorial content, not bookable inventory; day numbers unique per package (D15)
PackageBooking { id, code(unique, human "PB-XXXXXX"), userId, packageId, startDate,
                 adults, children, notes?, status: BookingStatus (starts PENDING_PAYMENT),
                 createdAt, updatedAt }
   -- the traveler's booking request for one published package (D25). Curated
      packages are platform-owned editorial journeys without provider inventory,
      so this is NOT the provider-scoped Booking model: no payment is taken until
      the team confirms availability; POST /api/bookings requires a session
      (login-first), creation is audited (PACKAGE_BOOKING_REQUESTED), drafts and
      unknown packages 404. Status transitions follow the payment integration.
```

### Gallery (platform-owned, admin-managed)
```
GalleryItem { id, title, caption?, imageUrl, category?, location?, sortOrder, published }
   -- URL-based editorial images, no upload pipeline yet; published-only public read,
      ordered by sortOrder then newest (D17)
```

### Site settings (D24)
```
SiteSettings { id: "site" fixed, phone?, whatsapp?, email?, address?,
               facebookUrl?, instagramUrl?, twitterUrl?, youtubeUrl?,
               createdAt, updatedAt }
   -- singleton row (fixed id); fields are nullable so the public footer and
      about page hide what an admin has not filled in. The admin PATCH is a
      full replace (empty string clears a field) and every save is audited
      as SITE_SETTINGS_UPDATED with the filled/cleared field lists in meta.
```

### Booking & availability
```
AvailabilitySlot { id, serviceableType: TOUR|EXPERIENCE|TRANSPORT, tourId?, experienceId?,
                   transportServiceId?, startsAt, endsAt, capacity, bookedCount, status }
RoomNight { id, roomId, date, available }          -- per-room-per-night inventory
AvailabilityHold { id, userId, slotId?/roomNightId?, expiresAt, consumedBookingId?, status }

Booking { id, code(unique, human), userId, tripId?, providerId,
          bookableType: TOUR|EXPERIENCE|TRANSPORT|HOTEL_ROOM,
          tourId?, experienceId?, transportServiceId?, roomNightRefs?,
          startDate, endDate?, paxAdults, paxChildren?, amountMinor, currencyCode,
          status: PENDING_PAYMENT|CONFIRMED|COMPLETED|CANCELLED|REFUNDED|EXPIRED,
          holdId?, specialRequests?, cancellationPolicyJson?, cancelledAt?, cancelReason? }
```

### Money (D1 merchant-of-record)
```
Payment { id, bookingId, provider: PAYSTACK|FLUTTERWAVE, reference(unique),
          amountMinor, currencyCode, status: INITIALIZED|PENDING|SUCCESS|FAILED,
          rawStatus?, authorizationUrl?, paidAt?, metaJson }
Transaction { id, paymentId, type: CHARGE|REFUND|PAYOUT|ADJUSTMENT,
              amountMinor (signed), currencyCode, status, description? }
Refund { id, paymentId, bookingId, amountMinor, reason, status, providerRef? }
Commission { id, bookingId, rateBps, amountMinor, currencyCode, status }
ProviderPayout { id, providerId, periodStart, periodEnd, grossMinor, commissionMinor,
                 netMinor, currencyCode, status: PENDING|PROCESSING|PAID|FAILED, paidAt? }
   -- MVP: create ledger rows only; payout execution arrives Phase 2 (D1/D5)
```

### Engagement & platform
```
Conversation { id, type: TRAVELER_PROVIDER|TRAVELER_DRIVER|TRAVELER_SUPPORT|
               PROVIDER_OPS, tripId?, bookingId? }
ConversationParticipant { conversationId, userId }
Message { id, conversationId, senderUserId?, body, readAt?, createdAt }
Notification { id, userId, channel: EMAIL|SMS|PUSH|WHATSAPP, type, payload,
               status: QUEUED|SENT|FAILED|READ, sentAt?, readAt? }
Review { id, bookingId (unique — verified booking), authorUserId, providerId,
         targetType: HOTEL|DRIVER|TOUR|EXPERIENCE|TRANSPORT, tourId?, driverId?...,
         rating 1..5, body?, photos[], status: PUBLISHED|PENDING|REJECTED, createdAt }
Favorite { id, userId, targetType: DESTINATION|TOUR|EXPERIENCE|HOTEL|ATTRACTION, targetId }
Enquiry { id, code `ENQ-XXXXXX` (unique), userId?, name, email, phone?, tripId?,
          startDate?, endDate?, adults, children?, destinations[], interests[],
          budgetRange?, accommodationPref?, transportPref?, specialRequests?,
          createdAt, updatedAt,
          status: NEW|IN_REVIEW|QUOTED|CONVERTED|CLOSED, assignedAdminId? }   -- D6 (D19 exec)
   -- `userId?` nullable: guests can submit without an account, so a signed-in
      requester gets a queued `Notification` row while guests are recorded in
      the AuditLog only (`Notification.userId` is required). A `tripId` link is
      allowed only for the trip's owner and snapshots the trip brief at send
      time. Pipeline NEW → IN_REVIEW → QUOTED → CONVERTED → CLOSED; CLOSED is
      terminal and skips are rejected (`INVALID_STATUS_TRANSITION`). An
      enquiry is not a booking (D19; nothing is charged).
Document { id, ownerUserId?, providerId?, type, fileUrl, verifiedAt?, notes? }  -- Phase 2
AuditLog { id, actorUserId?, action, entityType, entityId, meta, ip?, createdAt }
-- Json in the schema is `meta` (this file used to say metaJson; corrected v0.5).
```

## Design notes
1. **Multi-role (D3):** roles are rows (`RoleMembership`), permissions checked per role; a role
   switcher in the UI. Additive — new roles require no migration.
2. **Polymorphic bookables:** `Booking.bookableType` + nullable FKs keeps one booking pipeline.
   **Not currently enforced.** An earlier version of this note claimed integrity was
   "enforced by a CHECK + service-layer validation"; neither existed. Prisma cannot
   express a CHECK constraint (it needs a hand-written SQL migration), and as of
   2026-10-02 `bookableType` appeared nowhere in application code, because the booking
   pipeline has not been built yet. The schema therefore still permits rows such as
   `bookableType = TOUR` with `tourId` null, or with `roomId` set instead.

   **Required before bookings are live** (tracked, not yet done):
   - a raw SQL migration adding a CHECK tying `bookableType` to exactly one non-null FK;
   - service-layer validation at booking creation;
   - `Provider`/`userId` consistency is *not* covered by this and still relies on the
     service layer.
   Revisit if a 4th bookable type appears.
3. **Operator-first (D5):** `Provider.userId` and `Driver.userId` nullable so ops can create
   inventory before a provider account exists; ownership is claimed during Phase 2 onboarding.
4. **Privacy (§11):** `TravelerNeed.providerVisibility` + audit logging of detail access;
   providers receive only the minimal statement their job requires.
5. **Money (D8):** integers only, explicit currency, no floats; commission stored as basis
   points so rates stay configurable (D5 defers actual rates).
6. **Verified reviews (§22):** `Review.bookingId` unique ⇒ review only from a completed booking.
7. **Planner estimates (D18):** `ItineraryItem` estimate fields are always *estimates* — a
   listing-linked item snapshots the listing price at add time and carries `priceSnapshotAt`,
   but nothing here is a price quote or a booking. Trip summaries (budget totals, planner
   warnings) are **derived, never stored**, computed by a pure, unit-tested
   `computeTripSummary` in the API; the demo source mirrors the same rules in
   `apps/web/src/lib/trips/summary.ts` so preview mode stays honest.
8. **Pace is a heuristic, not a rule (D18):** day-load limits (RELAXED 3 / BALANCED 5 /
   PACKED 7 timed items) surface a `DAY_OVERLOADED` warning, and overlapping start/end
   times surface `TIME_OVERLAP` only when *both* endpoints exist — the planner never
   blocks an edit or invents a schedule.
