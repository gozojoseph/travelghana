-- TravelGhana — reusable Listing model with admin-verified publish status (increments).
-- Run: prisma db push (dev) or prisma migrate dev (production). No reversible schema change.

-- 1. Listing table + unique provider+slug, covering index for public catalog queries.
CREATE TABLE listing (
  id                 UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
  provider_id        UUID NOT NULL,
  slug               VARCHAR(200) NOT NULL,
  title              VARCHAR(200) NOT NULL,
  "status"           VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  description        TEXT,
  serviceArea        TEXT,
  durationMinutes    INTEGER,
  capacity           INTEGER NOT NULL DEFAULT 1,
  priceMinor         INTEGER NOT NULL DEFAULT 0,
  currencyCode       VARCHAR(3) NOT NULL DEFAULT 'GHS',
  city_id            UUID,
  region_id          UUID,
  coordinatesLat     DOUBLE PRECISION,
  coordinatesLng     DOUBLE PRECISION,
  address            TEXT,
  meetingPoint       VARCHAR(200),
  category           VARCHAR(60),
  whatIsIncluded     TEXT,
  whatIsExcluded     TEXT,
  requirements       TEXT,
  cancellationPolicy TEXT,
  heroImageUrl       VARCHAR(500),
  publishedAt        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW,
  CONSTRAINT listing_provider_slug UNIQUE (provider_id, slug),
  CONSTRAINT listing_provider_id_fkey FOREIGN KEY (provider_id)
    REFERENCES "provider" (id) ON DELETE CASCADE,
  CONSTRAINT listing_city_id_fkey FOREIGN KEY (city_id)
    REFERENCES city (id) ON DELETE SET NULL,
  CONSTRAINT listing_region_id_fkey FOREIGN KEY (region_id)
    REFERENCES region (id) ON DELETE SET NULL
);

-- Consistent status values (DRAFT|PENDING_REVIEW|PUBLISHED|PAUSED|ARCHIVED).
DO $$ BEGIN
  ALTER TABLE listing ADD CONSTRAINT listing_status_check
    CHECK ("status" IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'ARCHIVED'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- UpdatedAt triggers + indexing for provider-scoped and status-scoped queries.
CREATE INDEX listing_provider_status_idx ON listing (provider_id, "status");
CREATE INDEX listing_status_published_at_idx ON listing ("status", published_at);

CREATE OR REPLACE FUNCTION listing_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listing_updated_at ON listing;
CREATE TRIGGER listing_updated_at
  BEFORE UPDATE ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_set_updated_at();

-- 2. Helper views so the same lookup shapes are reusable by tours/experiences/futures.
CREATE OR REPLACE VIEW listing_with_provider AS
SELECT
  l.*,
  p.type AS provider_type,
  p.verification_status AS provider_verification_status,
  p.name AS provider_name,
  p.slug AS provider_slug,
  c.name AS city_name,
  c.slug AS city_slug,
  c.lat AS city_lat,
  c.lng AS city_lng,
  r.name AS region_name,
  r.slug AS region_slug
FROM listing l
LEFT JOIN "provider" p ON p.id = l.provider_id
LEFT JOIN city c ON c.id = l.city_id
LEFT JOIN region r ON r.id = l.region_id;
