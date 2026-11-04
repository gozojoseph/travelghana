-- D43 (Phase 3): quote-only transport listing requests + manual payments.
-- All additive: one new table and three nullable columns, so existing rows
-- (and the open, running booking flow) stay untouched.

-- Quote-only transport requests; no prices, no seats, no payment state.
CREATE TABLE "ListingBooking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quoteNote" TEXT,
    "quoteAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingBooking_code_key" ON "ListingBooking"("code");
CREATE INDEX "ListingBooking_userId_status_idx" ON "ListingBooking"("userId", "status");
CREATE INDEX "ListingBooking_listingId_idx" ON "ListingBooking"("listingId");
CREATE INDEX "ListingBooking_status_createdAt_idx" ON "ListingBooking"("status", "createdAt");

ALTER TABLE "ListingBooking" ADD CONSTRAINT "ListingBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingBooking" ADD CONSTRAINT "ListingBooking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual payments (D44): when the team records that a confirmed booking was
-- paid (Mobile Money or bank transfer). Never set by the traveler flow.
ALTER TABLE "PackageBooking" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Payment instruction blocks merged verbatim into confirmation emails.
ALTER TABLE "SiteSettings" ADD COLUMN "momoInstructions" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "bankInstructions" TEXT;
