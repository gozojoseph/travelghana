-- D41 (Phase 2): package departures with seat counts + package reviews.
-- Both are additive: new tables plus one nullable column, so existing rows
-- (and the open-dated booking flow) stay untouched.

-- Seat-managed departure dates; one per package and calendar day.
CREATE TABLE "PackageDeparture" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seats" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDeparture_pkey" PRIMARY KEY ("id")
);

-- One review per confirmed booking, moderated before it goes public.
CREATE TABLE "PackageReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageReview_pkey" PRIMARY KEY ("id")
);

-- Bookings may reference the departure they hold seats on. Nullable keeps
-- legacy and open-dated requests valid; deleting a departure releases the
-- column (the API refuses deleting a departure that still holds seats).
ALTER TABLE "PackageBooking" ADD COLUMN "departureId" TEXT;

CREATE UNIQUE INDEX "PackageDeparture_packageId_date_key" ON "PackageDeparture"("packageId", "date");

CREATE UNIQUE INDEX "PackageReview_bookingId_key" ON "PackageReview"("bookingId");
CREATE INDEX "PackageReview_packageId_status_idx" ON "PackageReview"("packageId", "status");
CREATE INDEX "PackageReview_userId_status_idx" ON "PackageReview"("userId", "status");

CREATE INDEX "PackageBooking_departureId_idx" ON "PackageBooking"("departureId");

ALTER TABLE "PackageDeparture" ADD CONSTRAINT "PackageDeparture_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageReview" ADD CONSTRAINT "PackageReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PackageBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageReview" ADD CONSTRAINT "PackageReview_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageReview" ADD CONSTRAINT "PackageReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageBooking" ADD CONSTRAINT "PackageBooking_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "PackageDeparture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
