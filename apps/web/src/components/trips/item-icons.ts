import {
  BedDouble,
  CarFront,
  Compass,
  Landmark,
  PartyPopper,
  Sparkles,
  StickyNote,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ItineraryItemType } from "@travelghana/types";

/** One icon per itinerary item type (shared by the planner panels). */
export const ITEM_ICONS: Record<ItineraryItemType, LucideIcon> = {
  ATTRACTION: Landmark,
  RESTAURANT: UtensilsCrossed,
  EVENT: PartyPopper,
  NOTE: StickyNote,
  TRANSPORT: CarFront,
  ACCOMMODATION: BedDouble,
  TOUR: Compass,
  EXPERIENCE: Sparkles,
};
