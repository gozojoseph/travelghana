import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { PrismaModule } from "./common/prisma.module";
import { SessionGuard } from "./common/guards/session.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { DestinationsModule } from "./modules/destinations/destinations.module";
import { EnquiriesModule } from "./modules/enquiries/enquiries.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { ListingBookingsModule } from "./modules/listing-bookings/listing-bookings.module";
import { StorageModule } from "./modules/storage/storage.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { GalleryModule } from "./modules/gallery/gallery.module";
import { HealthModule } from "./modules/health/health.module";
import { MapsModule } from "./modules/maps/maps.module";
import { ListingModule } from "./modules/listings/listings.module";
import { OperatorModule } from "./modules/operator/operator.module";
import { PackagesModule } from "./modules/packages/packages.module";

import { ReviewsModule } from "./modules/reviews/reviews.module";
import { TripsModule } from "./modules/trips/trips.module";
import { UsersModule } from "./modules/users/users.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { InsightsModule } from "./modules/insights/insights.module";

/**
 * Modular monolith (§26): one NestJS app, strict domain module boundaries so
 * future extraction into services remains possible.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Load .env from the monorepo root as well as the app dir
      envFilePath: [".env", "../../.env"],
    }),
    // Basic brute-force protection (§40 rate limiting).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MapsModule.register(),
    // Domain modules are added incrementally:
    // catalog, transport, bookings, availability, payments,
    // messaging, notifications, admin, audit
    HealthModule,
    AuthModule,
    AdminModule,
    UsersModule,
    DestinationsModule,
    ListingModule,
    OperatorModule,
    CatalogModule,
    PackagesModule,
    GalleryModule,
    EnquiriesModule,
    BookingsModule,
    ListingBookingsModule,
    StorageModule,
    UploadsModule,
    NotificationsModule,
    ReviewsModule,
    TripsModule,
    SettingsModule,
    InsightsModule,
  ],
  providers: [
    // Global session auth + RBAC guard — @Public() opts out, @Roles() restricts.
    { provide: APP_GUARD, useClass: SessionGuard },
    // Global rate limiting.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Normalize every error to the shared ApiErrorResponse contract.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
