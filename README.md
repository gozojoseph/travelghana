# TravelGhana

> Everything you need to experience Ghana — marketplace, trip planner, booking platform and
> travel companion for Ghana tourism.

## Structure (pnpm + Turborepo monorepo)

```
apps/
  web/        Next.js traveler-facing app (public site, dashboards, PWA)
  api/        NestJS modular monolith
  admin/      Next.js admin console (Phase 1 later step)
packages/
  ui/         Design system + tokens (Discovery / Travel modes)
  database/   Prisma schema, migrations, seed
  types/      Shared domain types
  validation/ Shared zod schemas
  config/     Shared tooling config
docs/         Architecture, ERD, decisions, open questions
```

## Getting started

```bash
pnpm install
cp .env.example .env          # fill in values
pnpm db:generate              # prisma client
pnpm db:push                  # create local schema (dev)
pnpm dev                      # web :3000 · api :4000
```

## Docs

- `docs/ARCHITECTURE.md` — product domains, technical architecture, sequence
- `docs/ERD.md` — data model (approved v0.2; 42 models / 24 enums)
- `docs/DECISIONS.md` — decision log (D1–D9)
- `docs/OPEN_QUESTIONS.md` — open questions + legal review checklist
