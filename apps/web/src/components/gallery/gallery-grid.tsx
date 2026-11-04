"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { GalleryItem } from "@travelghana/types";

/**
 * Public gallery grid with category filters and a lightweight lightbox.
 * The server page fetches published items; this component only handles the
 * viewing experience.
 */
export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  const visible = category ? items.filter((item) => item.category === category) : items;
  const closeLightbox = useCallback(() => setSelected(null), []);

  return (
    <>
      {categories.length > 1 ? (
        <div
          role="group"
          aria-label="Filter gallery by category"
          className="mt-6 flex flex-wrap gap-2"
        >
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            All
          </FilterChip>
          {categories.map((value) => (
            <FilterChip
              key={value}
              active={category === value}
              onClick={() => setCategory(value)}
            >
              {value}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <div className="tg-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="group flex flex-col overflow-hidden rounded-card border border-border bg-card text-left transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-muted">
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <span className="flex flex-1 flex-col gap-1 p-4">
              <span className="font-display text-lg leading-snug">{item.title}</span>
              {item.location ? (
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.location}
                </span>
              ) : null}
              {item.caption ? (
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {item.caption}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {selected ? <GalleryLightbox item={selected} onClose={closeLightbox} /> : null}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-95 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function GalleryLightbox({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const meta = [item.category, item.location].filter(Boolean).join(" · ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close image"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/80"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-card bg-card shadow-2xl">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="max-h-[70vh] w-full bg-black/40 object-contain"
        />
        <div className="flex items-start justify-between gap-4 p-4">
          <div>
            <p className="font-display text-xl">{item.title}</p>
            {item.caption ? (
              <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>
            ) : null}
            {meta ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{meta}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
