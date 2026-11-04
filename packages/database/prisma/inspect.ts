/**
 * Point-of-truth row counts for the configured database.
 * Usage: pnpm --filter @travelghana/database db:inspect
 * (Connects with the same .env resolution as db:seed -- currently the Neon
 * direct URL in this package's .env, so counts reflect the production DB.)
 */
import { PrismaClient } from "../src/generated";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [
    regions,
    cities,
    destinations,
    attractions,
    providers,
    packages,
    gallery,
    siteSettings,
    users,
    sessions,
    trips,
    itineraryItems,
    enquiries,
    packageBookings,
  ] = await Promise.all([
    prisma.region.count(),
    prisma.city.count(),
    prisma.destination.count(),
    prisma.attraction.count(),
    prisma.provider.count(),
    prisma.package.count(),
    prisma.galleryItem.count(),
    prisma.siteSettings.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.trip.count(),
    prisma.itineraryItem.count(),
    prisma.enquiry.count(),
    prisma.packageBooking.count(),
  ]);

  console.log("Catalog:      " + [
    "regions " + regions,
    "cities " + cities,
    "destinations " + destinations,
    "attractions " + attractions,
  ].join(", "));
  console.log("Owner content: providers " + providers +
    ", packages " + packages + ", gallery " + gallery +
    ", siteSettings " + siteSettings);
  console.log("Identity: users " + users + ", sessions " + sessions);
  console.log("Activity: trips " + trips + ", itineraryItems " + itineraryItems +
    ", enquiries " + enquiries + ", packageBookings " + packageBookings);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
