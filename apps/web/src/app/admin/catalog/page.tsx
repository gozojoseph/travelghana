"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import type {
  AdminCatalogResult,
  AttractionAdminDto,
  CityOption,
  DestinationAdminDto,
} from "@travelghana/types";

import { api, ApiClientError } from "@/lib/api";
import { DESTINATION_CATEGORY_LABELS, secondaryButtonClass } from "@/components/admin/shared";

/**
 * Catalog management (D20 Phase 6): destinations + attractions CRUD with
 * publish/unpublish and guarded deletes. City/region data is read-only here —
 * forms use the cities selector, and neither entity is editable in this
 * increment. Deleting a referenced row is refused by the API; the error copy
 * steers to unpublish instead.
 */
export default function AdminCatalogPage() {
  const [tab, setTab] = useState<"destinations" | "attractions">("destinations");
  const [cities, setCities] = useState<CityOption[] | null>(null);
  useEffect(() => {
    api
      .adminCatalogCities()
      .then(({ items }) => setCities(items))
      .catch(() => setCities([]));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Catalog</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Editorial seed data the planner and trips reference. Publishing a destination or
            attraction makes it appear in public discovery; deleting is only allowed while
            nothing references it.
          </p>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Catalog entity">
          {(["destinations", "attractions"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "destinations" ? "Destinations" : "Attractions"}
            </button>
          ))}
        </div>
      </header>

      {cities === null ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Loading cities…
        </p>
      ) : tab === "destinations" ? (
        <DestinationsPanel cities={cities} />
      ) : (
        <AttractionsPanel cities={cities} />
      )}
    </main>
  );
}

// ─── Destinations panel ──────────────────────────────────────────────────────

type DestinationFormState = {
  mode: "create" | "edit";
  id?: string;
  cityId: string;
  name: string;
  slug: string;
  category: string;
  summary: string;
  description: string;
  heroImageUrl: string;
  lat: string;
  lng: string;
  published: boolean;
  featured: boolean;
};

function blankDestination(cities: CityOption[]): DestinationFormState {
  return {
    mode: "create",
    cityId: cities[0]?.id ?? "",
    name: "",
    slug: "",
    category: "HISTORICAL",
    summary: "",
    description: "",
    heroImageUrl: "",
    lat: "",
    lng: "",
    published: false,
    featured: false,
  };
}

function DestinationsPanel({ cities }: { cities: CityOption[] }) {
  const [result, setResult] = useState<AdminCatalogResult<DestinationAdminDto> | null>(null);
  const [q, setQ] = useState("");
  const [published, setPublished] = useState<"all" | "true" | "false">("all");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<DestinationFormState | null>(null);

  const load = useCallback(async () => {
    setResult(null);
    setError(null);
    try {
      const data = await api.adminDestinations({
        q: q.trim() || undefined,
        published: published === "all" ? undefined : published,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 403
          ? "Admin access is required."
          : err instanceof Error
            ? err.message
            : "Could not load destinations.",
      );
    }
  }, [q, published]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setForm(blankDestination(cities));
    setError(null);
    setFeedback(null);
  }

  function openEdit(row: DestinationAdminDto) {
    setForm({
      mode: "edit",
      id: row.id,
      cityId: row.cityId,
      name: row.name,
      slug: row.slug,
      category: row.category,
      summary: row.summary ?? "",
      description: row.description ?? "",
      heroImageUrl: row.heroImageUrl ?? "",
      lat: String(row.lat),
      lng: String(row.lng),
      published: row.published,
      featured: row.featured,
    });
    setError(null);
    setFeedback(null);
  }

  async function save() {
    if (!form) return;
    setBusyId(form.id ?? "form");
    const payload = {
      cityId: form.cityId,
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      category: form.category as never,
      summary: form.summary.trim() || undefined,
      description: form.description.trim() || undefined,
      heroImageUrl: form.heroImageUrl.trim() || undefined,
      lat: Number(form.lat),
      lng: Number(form.lng),
      published: form.published,
      featured: form.featured,
    };
    try {
      const saved =
        form.mode === "create"
          ? await api.createDestination(payload)
          : await api.updateDestination(form.id!, payload);
      setFeedback(saved.message);
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the destination");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublish(row: DestinationAdminDto) {
    setBusyId(row.id);
    setError(null);
    setFeedback(null);
    try {
      const { message } = await api.updateDestination(row.id, { published: !row.published });
      setFeedback(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the destination");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: DestinationAdminDto) {
    setBusyId(row.id);
    setError(null);
    setFeedback(null);
    try {
      const { message } = await api.deleteDestination(row.id);
      setFeedback(message);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        let detail = err.message;
        try {
          const { item } = await api.adminDestination(row.id);
          if (item.refCounts) {
            detail = `${err.message} — currently referenced by ${item.refCounts.packages} package(s), ${item.refCounts.itineraryItems} itinerary item(s) and ${item.refCounts.attractions} attraction(s).`;
          }
        } catch {
          // fall back to the API error message
        }
        setError(detail);
      } else {
        setError(err instanceof Error ? err.message : "Could not delete the destination");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter destinations">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search destinations
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, summary or city…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by published">
          {(["all", "true", "false"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPublished(value)}
              aria-pressed={published === value}
              className={
                published === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "all" ? "All" : value === "true" ? "Published" : "Drafts"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="ml-auto flex items-center gap-1.5 rounded-card bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus aria-hidden className="h-4 w-4" />
          New destination
        </button>
      </div>

      {feedback ? (
        <p className="mt-4 text-sm text-primary" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {form ? (
        <DestinationForm
          form={form}
          setForm={setForm}
          cities={cities}
          busy={busyId === (form.id ?? "form")}
          onSave={() => void save()}
        />
      ) : null}

      {result !== null && result.total === 0 && !error ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No destinations</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first one to appear in public discovery.</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(result?.items ?? []).map((row) => (
          <li key={row.id} className="rounded-card border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">
                  {row.name}
                  {row.featured ? (
                    <span className="ml-2 rounded-card bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      Featured
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {(DESTINATION_CATEGORY_LABELS[row.category] ?? row.category)}
                  {row.cityName ? ` · ${row.cityName}` : ""}
                  {row.regionName ? ` (${row.regionName})` : ""} · /{row.slug}
                </p>
                {row.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  row.published ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {row.published ? "Published" : "Draft"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void togglePublish(row)}
                disabled={busyId === row.id}
                className={secondaryButtonClass}
              >
                {row.published ? "Unpublish" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() => openEdit(row)}
                disabled={busyId === row.id}
                className="rounded-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(row)}
                disabled={busyId === row.id}
                className="flex items-center gap-1 rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DestinationForm({
  form,
  setForm,
  cities,
  busy,
  onSave,
}: {
  form: DestinationFormState;
  setForm: (next: DestinationFormState | null) => void;
  cities: CityOption[];
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <form
      className="mt-6 rounded-card border border-primary/30 bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {form.mode === "create" ? "New destination" : "Edit destination"}
        </h3>
        <button
          type="button"
          onClick={() => setForm(null)}
          aria-label="Close form"
          className="rounded-card border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          City (required)
          <select
            required
            value={form.cityId}
            onChange={(event) => setForm({ ...form, cityId: event.target.value })}
            className="mt-1 w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="" disabled>
              Choose a city…
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name} · {city.regionName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Category (required)
          <select
            required
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className="mt-1 w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {Object.entries(DESTINATION_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Name (required)
          <input
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Slug (optional — derived from the name)
          <input
            maxLength={80}
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Latitude (required)
          <input
            required
            type="number"
            step="any"
            min={-90}
            max={90}
            value={form.lat}
            onChange={(event) => setForm({ ...form, lat: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Longitude (required)
          <input
            required
            type="number"
            step="any"
            min={-180}
            max={180}
            value={form.lng}
            onChange={(event) => setForm({ ...form, lng: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
          Summary
          <input
            maxLength={500}
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
          Hero image URL
          <input
            type="url"
            maxLength={500}
            value={form.heroImageUrl}
            onChange={(event) => setForm({ ...form, heroImageUrl: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setForm({ ...form, published: event.target.checked })}
            className="h-4 w-4"
          />
          Published (appears in public discovery)
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(event) => setForm({ ...form, featured: event.target.checked })}
            className="h-4 w-4"
          />
          Featured
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : form.mode === "create" ? "Create destination" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setForm(null)}
          className={secondaryButtonClass}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Attractions panel ───────────────────────────────────────────────────────

type AttractionFormState = {
  mode: "create" | "edit";
  id?: string;
  destinationId: string;
  cityId: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  lat: string;
  lng: string;
  published: boolean;
};

function blankAttraction(): AttractionFormState {
  return {
    mode: "create",
    destinationId: "",
    cityId: "",
    name: "",
    slug: "",
    category: "",
    description: "",
    lat: "",
    lng: "",
    published: true,
  };
}

function AttractionsPanel({ cities }: { cities: CityOption[] }) {
  const [result, setResult] = useState<AdminCatalogResult<AttractionAdminDto> | null>(null);
  const [destinations, setDestinations] = useState<DestinationAdminDto[]>([]);
  const [q, setQ] = useState("");
  const [published, setPublished] = useState<"all" | "true" | "false">("all");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<AttractionFormState | null>(null);

  const load = useCallback(async () => {
    setResult(null);
    setError(null);
    try {
      const data = await api.adminAttractions({
        q: q.trim() || undefined,
        published: published === "all" ? undefined : published,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 403
          ? "Admin access is required."
          : err instanceof Error
            ? err.message
            : "Could not load attractions.",
      );
    }
  }, [q, published]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const refreshDestinations = useCallback(async () => {
    try {
      const data = await api.adminDestinations();
      setDestinations(data.items);
    } catch {
      setDestinations([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .adminDestinations()
      .then((data) => {
        if (active) setDestinations(data.items);
      })
      .catch(() => {
        if (active) setDestinations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!form) return;
    setBusyId(form.id ?? "form");
    const payload = {
      destinationId: form.destinationId.trim() || null,
      cityId: form.cityId.trim() || null,
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      lat: Number(form.lat),
      lng: Number(form.lng),
      published: form.published,
    };
    try {
      const saved =
        form.mode === "create"
          ? await api.createAttraction(payload)
          : await api.updateAttraction(form.id!, payload);
      setFeedback(saved.message);
      setForm(null);
      await load();
      void refreshDestinations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the attraction");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublish(row: AttractionAdminDto) {
    setBusyId(row.id);
    setError(null);
    setFeedback(null);
    try {
      const { message } = await api.updateAttraction(row.id, { published: !row.published });
      setFeedback(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the attraction");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: AttractionAdminDto) {
    setBusyId(row.id);
    setError(null);
    setFeedback(null);
    try {
      const { message } = await api.deleteAttraction(row.id);
      setFeedback(message);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        let detail = err.message;
        try {
          const { item } = await api.adminAttraction(row.id);
          if (item.refCounts) {
            detail = `${err.message} — currently referenced by ${item.refCounts.itineraryItems} itinerary item(s).`;
          }
        } catch {
          // fall back to the API error message
        }
        setError(detail);
      } else {
        setError(err instanceof Error ? err.message : "Could not delete the attraction");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3" role="search" aria-label="Filter attractions">
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="q">
            Search attractions
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search attractions…"
            className="w-72 rounded-card border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            maxLength={120}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by published">
          {(["all", "true", "false"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPublished(value)}
              aria-pressed={published === value}
              className={
                published === value
                  ? "rounded-card bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  : "rounded-card border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {value === "all" ? "All" : value === "true" ? "Published" : "Hidden"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(blankAttraction());
            setError(null);
            setFeedback(null);
          }}
          className="ml-auto flex items-center gap-1.5 rounded-card bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus aria-hidden className="h-4 w-4" />
          New attraction
        </button>
      </div>

      {feedback ? (
        <p className="mt-4 text-sm text-primary" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {form ? (
        <AttractionForm
          form={form}
          setForm={setForm}
          cities={cities}
          destinations={destinations.map((row) => ({
            id: row.id,
            name: `${row.name}${row.cityName ? ` · ${row.cityName}` : ""}`,
          }))}
          busy={busyId === (form.id ?? "form")}
          onSave={() => void save()}
        />
      ) : null}

      {result !== null && result.total === 0 && !error ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No attractions</p>
          <p className="mt-1 text-sm text-muted-foreground">Add points of interest travelers can place into trips.</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(result?.items ?? []).map((row) => (
          <li key={row.id} className="rounded-card border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">{row.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.category ?? "Uncategorised"}
                  {row.destinationName ? ` · in ${row.destinationName}` : ""}
                  {row.cityName ? ` · ${row.cityName}` : ""}
                </p>
                {row.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  row.published ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {row.published ? "Published" : "Hidden"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void togglePublish(row)} disabled={busyId === row.id} className={secondaryButtonClass}>
                {row.published ? "Hide" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    mode: "edit",
                    id: row.id,
                    destinationId: row.destinationId ?? "",
                    cityId: row.cityId ?? "",
                    name: row.name,
                    slug: row.slug,
                    category: row.category ?? "",
                    description: row.description ?? "",
                    lat: String(row.lat),
                    lng: String(row.lng),
                    published: row.published,
                  })
                }
                disabled={busyId === row.id}
                className="rounded-card border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(row)}
                disabled={busyId === row.id}
                className="flex items-center gap-1 rounded-card border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function AttractionForm({
  form,
  setForm,
  cities,
  destinations,
  busy,
  onSave,
}: {
  form: AttractionFormState;
  setForm: (next: AttractionFormState | null) => void;
  cities: CityOption[];
  destinations: Array<{ id: string; name: string }>;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <form
      className="mt-6 rounded-card border border-primary/30 bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {form.mode === "create" ? "New attraction" : "Edit attraction"}
        </h3>
        <button
          type="button"
          onClick={() => setForm(null)}
          aria-label="Close form"
          className="rounded-card border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          Parent destination (optional)
          <select
            value={form.destinationId}
            onChange={(event) => setForm({ ...form, destinationId: event.target.value })}
            className="mt-1 w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">— none —</option>
            {destinations.map((dest) => (
              <option key={dest.id} value={dest.id}>
                {dest.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          City (optional)
          <select
            value={form.cityId}
            onChange={(event) => setForm({ ...form, cityId: event.target.value })}
            className="mt-1 w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">— none —</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name} · {city.regionName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Name (required)
          <input
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Slug (optional — derived from the name)
          <input
            maxLength={80}
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Latitude (required)
          <input
            required
            type="number"
            step="any"
            min={-90}
            max={90}
            value={form.lat}
            onChange={(event) => setForm({ ...form, lat: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Longitude (required)
          <input
            required
            type="number"
            step="any"
            min={-180}
            max={180}
            value={form.lng}
            onChange={(event) => setForm({ ...form, lng: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
          Description
          <textarea
            rows={3}
            maxLength={8000}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setForm({ ...form, published: event.target.checked })}
            className="h-4 w-4"
          />
          Published (appears in public discovery)
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : form.mode === "create" ? "Create attraction" : "Save changes"}
        </button>
        <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
