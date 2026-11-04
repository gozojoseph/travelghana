import { apiSource } from "./api-source";
import { demoSource } from "./demo-source";
import type { TripsSource } from "./source";

export type { TripsSource } from "./source";
export { resetDemoTrips } from "./demo-source";

/**
 * Demo mode is opt-in (`NEXT_PUBLIC_TRIPS_SOURCE=demo`) so a deployment that
 * forgets the flag can never silently serve the browser-only preview. The API
 * source is the default everywhere else.
 */
export const isDemoTrips = process.env.NEXT_PUBLIC_TRIPS_SOURCE === "demo";

export const tripsSource: TripsSource = isDemoTrips ? demoSource : apiSource;
