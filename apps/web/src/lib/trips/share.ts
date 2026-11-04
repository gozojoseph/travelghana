import type { TripShareStatus, TripShareView } from "@travelghana/types";

import { apiRequest } from "@/lib/api";

/**
 * Trip sharing (D19). Owner operations manage the share link; the public view
 * endpoint is only consumed by the /share/[token] page. API-mode only — demo
 * preview trips have no server-side plan to share.
 */
export function getShareStatus(
  tripId: string,
): Promise<{ share: TripShareStatus }> {
  return apiRequest<{ share: TripShareStatus }>(`/trips/${tripId}/share`);
}

export function createShare(
  tripId: string,
): Promise<{ share: TripShareStatus }> {
  return apiRequest<{ share: TripShareStatus }>(`/trips/${tripId}/share`, {
    method: "POST",
  });
}

export function revokeShare(
  tripId: string,
): Promise<{ share: TripShareStatus }> {
  return apiRequest<{ share: TripShareStatus }>(`/trips/${tripId}/share`, {
    method: "DELETE",
  });
}

export function fetchSharedTrip(
  token: string,
): Promise<{ share: TripShareView }> {
  return apiRequest<{ share: TripShareView }>(`/trips/share/${encodeURIComponent(token)}`);
}
