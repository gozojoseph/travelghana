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

import { apiRequest, ApiClientError } from "@/lib/api";

import type { TripsSource } from "./source";

/**
 * Phase C data source: the real `trips` API (D12).
 *
 * Every mutation returns the full updated trip, exactly like the demo source,
 * so the planner components never branch on which source is active.
 */

interface DestinationListDto {
  items: Array<{
    id: string;
    slug: string;
    name: string;
    city: { name: string; region: { name: string } | null } | null;
  }>;
  total: number;
  pages: number;
}

const DESTINATION_PAGE_SIZE = 48; // API max — the picker pages through the rest.

function encode(id: string): string {
  return encodeURIComponent(id);
}

function toOption(item: DestinationListDto["items"][number]): TripDestinationOption {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    cityName: item.city?.name ?? null,
    regionName: item.city?.region?.name ?? null,
  };
}

let destinationCache: TripDestinationOption[] | null = null;

async function loadDestinations(): Promise<TripDestinationOption[]> {
  if (destinationCache) return destinationCache;

  const first = await apiRequest<DestinationListDto>(
    `/destinations?pageSize=${DESTINATION_PAGE_SIZE}`,
  );
  const options = first.items.map(toOption);
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await apiRequest<DestinationListDto>(
      `/destinations?pageSize=${DESTINATION_PAGE_SIZE}&page=${page}`,
    );
    options.push(...next.items.map(toOption));
  }

  destinationCache = options;
  return options;
}

function jsonBody(method: "POST" | "PATCH", body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

/** All trip mutations answer `{ trip }`; unwrap once here. */
async function tripRequest(path: string, init?: RequestInit): Promise<TripDetail> {
  const { trip } = await apiRequest<{ trip: TripDetail }>(path, init);
  return trip;
}

export const apiSource: TripsSource = {
  async list() {
    const { items } = await apiRequest<{ items: TripSummary[] }>("/trips");
    return items;
  },

  async get(id) {
    try {
      return await tripRequest(`/trips/${encode(id)}`);
    } catch (error) {
      // The API returns 404 for missing and foreign trips alike; the builder
      // renders those as "Trip not found".
      if (error instanceof ApiClientError && error.status === 404) return null;
      throw error;
    }
  },

  destinations: loadDestinations,

  create(input: TripCreateInput) {
    return tripRequest("/trips", jsonBody("POST", input));
  },

  update(id, input: TripUpdateInput) {
    return tripRequest(`/trips/${encode(id)}`, jsonBody("PATCH", input));
  },

  async remove(id) {
    await apiRequest<{ message: string }>(`/trips/${encode(id)}`, { method: "DELETE" });
  },

  // ─── Travelers ──────────────────────────────────────────────────────────────

  addTraveler(tripId, input: TravelerCreateInput) {
    return tripRequest(`/trips/${encode(tripId)}/travelers`, jsonBody("POST", input));
  },

  updateTraveler(tripId, travelerId, input: TravelerUpdateInput) {
    return tripRequest(
      `/trips/${encode(tripId)}/travelers/${encode(travelerId)}`,
      jsonBody("PATCH", input),
    );
  },

  removeTraveler(tripId, travelerId) {
    return tripRequest(`/trips/${encode(tripId)}/travelers/${encode(travelerId)}`, {
      method: "DELETE",
    });
  },

  // ─── Days ───────────────────────────────────────────────────────────────────

  addDay(tripId, input: ItineraryDayCreateInput) {
    return tripRequest(`/trips/${encode(tripId)}/days`, jsonBody("POST", input));
  },

  updateDay(tripId, dayId, input: ItineraryDayUpdateInput) {
    return tripRequest(
      `/trips/${encode(tripId)}/days/${encode(dayId)}`,
      jsonBody("PATCH", input),
    );
  },

  removeDay(tripId, dayId) {
    return tripRequest(`/trips/${encode(tripId)}/days/${encode(dayId)}`, {
      method: "DELETE",
    });
  },

  // ─── Items ──────────────────────────────────────────────────────────────────

  addItem(tripId, dayId, input: ItineraryItemCreateInput) {
    return tripRequest(
      `/trips/${encode(tripId)}/days/${encode(dayId)}/items`,
      jsonBody("POST", input),
    );
  },

  addUnscheduledItem(tripId, input: ItineraryItemCreateInput) {
    return tripRequest(`/trips/${encode(tripId)}/items`, jsonBody("POST", input));
  },

  updateItem(tripId, itemId, input: ItineraryItemUpdateInput) {
    return tripRequest(
      `/trips/${encode(tripId)}/items/${encode(itemId)}`,
      jsonBody("PATCH", input),
    );
  },

  removeItem(tripId, itemId) {
    return tripRequest(`/trips/${encode(tripId)}/items/${encode(itemId)}`, {
      method: "DELETE",
    });
  },

  reorderItems(tripId, dayId, itemIds) {
    return tripRequest(
      `/trips/${encode(tripId)}/days/${encode(dayId)}/items/reorder`,
      jsonBody("POST", { itemIds }),
    );
  },

  moveItem(tripId, itemId, dayId, position) {
    return tripRequest(
      `/trips/${encode(tripId)}/items/${encode(itemId)}/move`,
      jsonBody("PATCH", { dayId, ...(position !== undefined ? { position } : {}) }),
    );
  },

  reorderUnscheduledItems(tripId, itemIds) {
    return tripRequest(`/trips/${encode(tripId)}/items/reorder`, jsonBody("POST", { itemIds }));
  },
};
