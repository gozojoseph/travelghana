import type { TripDestinationOption, TripDetail, TripSummary } from "@travelghana/types";
import type {
  ItineraryDayCreateInput,
  ItineraryDayUpdateInput,
  ItineraryItemCreateInput,
  ItineraryItemUpdateInput,
  TravelerCreateInput,
  TravelerUpdateInput,
  TripCreateInput,
  TripUpdateInput,
} from "@travelghana/validation";

/**
 * Data boundary for the trip planner.
 *
 * Phase A ships `demoSource` (browser storage, no API). Phase C adds an
 * `apiSource` with the same methods, so every component stays unchanged.
 * Mutations return the full updated trip — simple for callers, and it mirrors
 * the API responses planned for Phase B.
 */
export interface TripsSource {
  list(): Promise<TripSummary[]>;
  get(id: string): Promise<TripDetail | null>;
  destinations(): Promise<TripDestinationOption[]>;
  create(input: TripCreateInput): Promise<TripDetail>;
  update(id: string, input: TripUpdateInput): Promise<TripDetail>;
  remove(id: string): Promise<void>;

  addTraveler(tripId: string, input: TravelerCreateInput): Promise<TripDetail>;
  updateTraveler(
    tripId: string,
    travelerId: string,
    input: TravelerUpdateInput,
  ): Promise<TripDetail>;
  removeTraveler(tripId: string, travelerId: string): Promise<TripDetail>;

  addDay(tripId: string, input: ItineraryDayCreateInput): Promise<TripDetail>;
  updateDay(tripId: string, dayId: string, input: ItineraryDayUpdateInput): Promise<TripDetail>;
  removeDay(tripId: string, dayId: string): Promise<TripDetail>;

  addItem(tripId: string, dayId: string, input: ItineraryItemCreateInput): Promise<TripDetail>;
  /** Add an idea that is not assigned to a day yet. */
  addUnscheduledItem(tripId: string, input: ItineraryItemCreateInput): Promise<TripDetail>;
  updateItem(tripId: string, itemId: string, input: ItineraryItemUpdateInput): Promise<TripDetail>;
  removeItem(tripId: string, itemId: string): Promise<TripDetail>;
  reorderItems(tripId: string, dayId: string, itemIds: string[]): Promise<TripDetail>;
  /** Move an item to a day, or to the unscheduled tray with `dayId: null`. */
  moveItem(
    tripId: string,
    itemId: string,
    dayId: string | null,
    position?: number,
  ): Promise<TripDetail>;
  reorderUnscheduledItems(tripId: string, itemIds: string[]): Promise<TripDetail>;
}
