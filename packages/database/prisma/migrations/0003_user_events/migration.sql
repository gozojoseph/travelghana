-- D37: first-party clickstream (PageView) - one row per browsed page or
-- tracked action. Written by POST /api/track from the web browser; the
-- client strips query strings and never sends emails or free user content,
-- so no column can hold PII beyond an optional signed-in user id.
CREATE TABLE "PageView" (
    "id"         TEXT     NOT NULL,
    "sessionId"  TEXT     NOT NULL,
    "visitorId"  TEXT     NOT NULL,
    "userId"     TEXT     NOT NULL,
    "path"       TEXT     NOT NULL,
    "referrer"   TEXT,
    "device"     TEXT     NOT NULL,
    "kind"       TEXT     NOT NULL,
    "name"       TEXT,
    "meta"       JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageView_sessionId_occurredAt_idx" ON "PageView"("sessionId", "occurredAt");
CREATE INDEX "PageView_visitorId_idx" ON "PageView"("visitorId");
CREATE INDEX "PageView_path_idx" ON "PageView"("path");
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
