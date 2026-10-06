# ERD — TravelGhana v0.2 (approved)

Status: **APPROVED — implemented.** `packages/database/prisma/schema.prisma` is the
authoritative artifact; this document is its human-readable summary. Where the two
disagree, the schema wins and this file is the bug.

**Source of truth:** `packages/database/prisma/schema.prisma` — **42 models, 24 enums.**
D3 (multi-role) and D5 (operator-first) confirmed by product owner; see `DECISIONS.md`.

> **Version history.** v0.1 was circulated for review. v0.2 is the approved design as
> landed. Note that an earlier status line on this file claimed "34 models" and a
> "DRAFT — awaiting review" status; both were stale and were corrected on 2026-10-02
> once the schema was reconciled against this document.

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
Attraction { id, destinationId?, cityId?, slug, name, description, lat, lng, category }
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

### Trip
```
Trip { id, ownerUserId, name, startDate, endDate, status: PLANNING|CONFIRMED|
       IN_PROGRESS|COMPLETED|CANCELLED, adults, children, budgetMinor?,
       currencyCode, notes? }
TripTraveler { id, tripId, name?, ageGroup?, isOwner }
TravelerNeed { id, tripTravelerId, category: ACCESSIBILITY|MOBILITY|DIETARY|ALLERGY|
               CHILDREN|SENIOR|PREGNANCY|MEDICATION|ASSISTANCE|OTHER, details?,
               consentGivenAt, providerVisibility: NONE|MINIMAL|FULL, detailsVisibleToProviders }
   -- §11: minimal info exposed to providers; access to details logged (AuditLog)

ItineraryDay { id, tripId, dayNumber, date, title?, notes? }
ItineraryItem { id, itineraryDayId, sortOrder, startTime?, endTime?, title,
                itemType: BOOKING|ATTRACTION|RESTAURANT|EVENT|NOTE|TRANSPORT,
                bookingId?, attractionId?, notes? }
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
Notification { id, userId, channel: EMAIL|SMS|PUSH|WHATSAPP, type, payloadJson,
               status: QUEUED|SENT|FAILED|READ, sentAt?, readAt? }
Review { id, bookingId (unique — verified booking), authorUserId, providerId,
         targetType: HOTEL|DRIVER|TOUR|EXPERIENCE|TRANSPORT, tourId?, driverId?...,
         rating 1..5, body?, photos[], status: PUBLISHED|PENDING|REJECTED, createdAt }
Favorite { id, userId, targetType: DESTINATION|TOUR|EXPERIENCE|HOTEL|ATTRACTION, targetId }
Enquiry { id, code, userId?, name, email, phone?, tripId?,
          startDate?, endDate?, adults, children?, destinations[], interests[],
          budgetRange?, accommodationPref?, transportPref?, specialRequests?,
          status: NEW|IN_REVIEW|QUOTED|CONVERTED|CLOSED, assignedAdminId? }   -- D6
Document { id, ownerUserId?, providerId?, type, fileUrl, verifiedAt?, notes? }  -- Phase 2
AuditLog { id, actorUserId?, action, entityType, entityId, metaJson, ip?, createdAt }
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
