import { describe, expect, it } from "vitest";
import type { Prisma } from "@travelghana/database";
import type { TripShareView } from "@travelghana/types";

import { buildTripShareView, sharePlaceName, tripShareInclude } from "./trip-share";

/**
 * D19 privacy rules are pure functions — they get the strictest tests. The
 * sanitized view must never carry budget, notes, needs, warnings or owner
 * data, and must read times/dates from the same UTC-pinned conventions the
 * planner uses.
 */

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    title: "Kakum canopy walk",
    itemType: "ATTRACTION",
    startTime: null,
    endTime: null,
    sortOrder: 1,
    createdAt: new Date("2026-10-19T00:00:00.000Z"),
    destination: null,
    attraction: null,
    tour: null,
    experience: null,
    package: null,
    ...overrides,
  };
}

function trip(overrides: Record<string, unknown> = {}) {
  return {
    id: "trip-1",
    name: "Coast week",
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    endDate: new Date("2026-11-05T00:00:00.000Z"),
    adults: 2,
    children: 1,
    interests: ["BEACHES_COASTAL", "NATURE_WILDLIFE"],
    travelPace: "BALANCED",
    days: [],
    items: [],
    ...overrides,
  };
}

function day(overrides: Record<string, unknown> = {}) {
  return {
    id: "day-1",
    dayNumber: 1,
    date: new Date("2026-11-01T00:00:00.000Z"),
    title: null,
    items: [],
    ...overrides,
  };
}

describe("sharePlaceName", () => {
  it("prefers destination, then attraction, then listing titles", () => {
    const destination = { destination: { name: "Cape Coast" }, attraction: null, tour: null, experience: null, package: null };
    expect(sharePlaceName(destination as never)).toBe("Cape Coast");

    const attraction = { destination: null, attraction: { name: "Elmina Castle" }, tour: null, experience: null, package: null };
    expect(sharePlaceName(attraction as never)).toBe("Elmina Castle");

    const tour = { destination: null, attraction: null, tour: { title: "Coast tour" }, experience: null, package: null };
    expect(sharePlaceName(tour as never)).toBe("Coast tour");

    const experience = { destination: null, attraction: null, tour: null, experience: { title: "Drum class" }, package: null };
    expect(sharePlaceName(experience as never)).toBe("Drum class");

    const pkg = { destination: null, attraction: null, tour: null, experience: null, package: { title: "Green season" } };
    expect(sharePlaceName(pkg as never)).toBe("Green season");

    const none = item();
    expect(sharePlaceName(none as never)).toBeNull();
  });
});

describe("buildTripShareView", () => {
  it("projects the plan shape and orders days then items", () => {
    const graph = trip({
      days: [
        day({
          dayNumber: 2,
          items: [
            item({ id: "i2", title: "Lunch", itemType: "RESTAURANT", sortOrder: 2 }),
            item({ id: "i1", title: "Castle walk", sortOrder: 1, destination: { name: "Elmina" } }),
          ],
        }),
        day({ id: "day-2", dayNumber: 1, title: "Arrival", items: [] }),
      ],
      items: [item({ id: "u1", title: "Sunset cruise", itemType: "TOUR" })],
    }) as unknown as Prisma.TripGetPayload<{ include: typeof tripShareInclude }>;

    const view = buildTripShareView(graph);

    expect(view.name).toBe("Coast week");
    expect(view.startDate).toBe("2026-11-01");
    expect(view.endDate).toBe("2026-11-05");
    expect(view.adults).toBe(2);
    expect(view.children).toBe(1);
    expect(view.interests).toEqual(["BEACHES_COASTAL", "NATURE_WILDLIFE"]);
    expect(view.travelPace).toBe("BALANCED");
    expect(view.days.map((d) => d.dayNumber)).toEqual([1, 2]);
    expect(view.days[1]?.items.map((i) => i.title)).toEqual(["Castle walk", "Lunch"]);
    expect(view.days[1]?.items[0]?.placeName).toBe("Elmina");
    expect(view.unscheduledTitles).toEqual(["Sunset cruise"]);
    expect(new Date(view.generatedAt).getTime()).not.toBeNaN();
  });

  it("carries clocks as HH:mm and keeps untimed items null", () => {
    const graph = trip({
      days: [
        day({
          items: [
            item({
              startTime: new Date(Date.parse("2026-11-01T09:30:00.000Z")),
              endTime: new Date(Date.parse("2026-11-01T12:00:00.000Z")),
            }),
            item({ id: "i2", title: "Free evening" }),
          ],
        }),
      ],
    }) as unknown as Prisma.TripGetPayload<{ include: typeof tripShareInclude }>;

    const view: TripShareView = buildTripShareView(graph);
    expect(view.days[0]?.items[0]?.startTime).toBe("09:30");
    expect(view.days[0]?.items[0]?.endTime).toBe("12:00");
    expect(view.days[0]?.items[1]?.startTime).toBeNull();
  });

  it("nulls dates stay null end to end", () => {
    const graph = trip({
      startDate: null,
      endDate: null,
      days: [day({ date: null })],
    }) as unknown as Prisma.TripGetPayload<{ include: typeof tripShareInclude }>;

    const view = buildTripShareView(graph);
    expect(view.startDate).toBeNull();
    expect(view.endDate).toBeNull();
    expect(view.days[0]?.date).toBeNull();
  });

  it("the prisma include loads nothing private in the first place", () => {
    // tripShareInclude is the contract with the loader: only day/day items +
    // unscheduled titles. Assert its keys never reference private columns.
    const serialized = JSON.stringify(tripShareInclude);
    for (const forbidden of ["notes", "budget", "estimatedCost", "travelers", "summary"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
