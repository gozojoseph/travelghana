import type { BudgetTier, BudgetType, TripInterest, TravelPace } from "@travelghana/types";
import {
  BUDGET_TIER_VALUES,
  BUDGET_TYPE_VALUES,
  TRAVEL_PACE_VALUES,
  tripInterestSchema,
} from "@travelghana/validation";

/**
 * Guest draft persistence (Phase 2 upgrade, D18 follow-up).
 *
 * The wizard draft now lives in localStorage (`v2`), so it survives a full
 * browser restart — not just the tab session — and resumes after the
 * `/login?next=…` handoff or any later visit on the same device. Legacy
 * `v1` sessionStorage drafts are migrated on first read. Nothing is sent to
 * the server until the traveler signs in and saves; clearing happens on
 * successful trip creation.
 */

const DRAFT_KEY = "tg.plan.draft.v2";
const LEGACY_DRAFT_KEY = "tg.plan.draft.v1";

export interface WizardDraft {
  step: number;
  name: string;
  startDate: string;
  endDate: string;
  adults: string;
  children: string;
  budget: string;
  budgetType: BudgetType;
  budgetTier: BudgetTier;
  budgetIncludesFlights: boolean;
  interests: TripInterest[];
  travelPace: TravelPace;
  arrivalPoint: string;
  destinationPreferences: string[];
  notes: string;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Permissive parse: unknown fields fall back so a stale draft never breaks the wizard. */
function parseDraft(value: unknown): WizardDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const interests = Array.isArray(raw.interests)
    ? raw.interests.filter(
        (entry): entry is TripInterest =>
          typeof entry === "string" && tripInterestSchema.safeParse(entry).success,
      )
    : [];

  const budgetType = BUDGET_TYPE_VALUES.includes(raw.budgetType as BudgetType)
    ? (raw.budgetType as BudgetType)
    : "PER_GROUP";
  const budgetTier = BUDGET_TIER_VALUES.includes(raw.budgetTier as BudgetTier)
    ? (raw.budgetTier as BudgetTier)
    : "FLEXIBLE";
  const travelPace = TRAVEL_PACE_VALUES.includes(raw.travelPace as TravelPace)
    ? (raw.travelPace as TravelPace)
    : "BALANCED";

  return {
    step: typeof raw.step === "number" ? Math.min(Math.max(Math.trunc(raw.step), 0), 3) : 0,
    name: asString(raw.name, ""),
    startDate: asString(raw.startDate, ""),
    endDate: asString(raw.endDate, ""),
    adults: asString(raw.adults, "2"),
    children: asString(raw.children, "0"),
    budget: asString(raw.budget, ""),
    budgetType,
    budgetTier,
    budgetIncludesFlights: asBoolean(raw.budgetIncludesFlights, false),
    interests,
    travelPace,
    arrivalPoint: asString(raw.arrivalPoint, ""),
    destinationPreferences: Array.isArray(raw.destinationPreferences)
      ? raw.destinationPreferences.filter((entry): entry is string => typeof entry === "string")
      : [],
    notes: asString(raw.notes, ""),
  };
}

export function readDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(DRAFT_KEY) ?? window.sessionStorage.getItem(LEGACY_DRAFT_KEY);
    if (!stored) return null;
    const draft = parseDraft(JSON.parse(stored) as unknown);
    if (!draft || !draftHasContent(draft)) return null;
    writeDraft(draft); // migrate legacy v1 drafts forward
    return draft;
  } catch {
    return null;
  }
}

/** A blank wizard has nothing worth restoring — keeps restore copy honest. */
export function draftHasContent(draft: WizardDraft): boolean {
  return (
    draft.name.trim() !== "" ||
    draft.notes.trim() !== "" ||
    draft.budget.trim() !== "" ||
    draft.startDate.trim() !== "" ||
    draft.endDate.trim() !== "" ||
    draft.arrivalPoint.trim() !== "" ||
    draft.interests.length > 0 ||
    draft.destinationPreferences.length > 0
  );
}

export function writeDraft(draft: WizardDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage may be unavailable (private mode, quota); the wizard still works,
    // it just won't restore across sessions.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.sessionStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
