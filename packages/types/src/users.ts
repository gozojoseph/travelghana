/**
 * The signed-in member's "info for you" count badges (D27). These point at
 * surfaces that actually exist: the trips planner and the package booking
 * list on the account page. No unread-notification count yet - there is no
 * traveler-facing notifications UI to lead the badge to.
 */
export interface UserCounts {
  /** Trips the user owns (My trips card). */
  trips: number;
  /** Package booking requests the user has (My bookings card + header badge). */
  packageBookings: number;
}
