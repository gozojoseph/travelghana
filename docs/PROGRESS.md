# Progress Log

## 2026-10-02
- **ERD approved** (v0.2 — 34 models, Prisma schema validates). D3 (multi-role) and
  D5 (operator-first) confirmed by product owner.
- Phase 0 complete: docs, decisions, architecture, ERD, monorepo scaffold, seed.
- **Build increment started: Auth / Users / RBAC** (per ARCHITECTURE.md sequence step 3).
  Scope: register/login/logout/session, email verification, password reset, role guards,
  admin bootstrap, rate limiting; web /login + /register.
- **Auth / Users / RBAC increment COMPLETE.** API: global session guard + RBAC
  (@Public/@Roles), scrypt password hashing, opaque hashed session tokens in httpOnly
  cookies, email verification + password reset flows (no account enumeration), rate
  limiting, admin bootstrap via env, unified error contract, zod shared-validation pipe.
  Web: /login, /register, /forgot-password, /reset-password, /verify-email, /account
  (session-aware). Verified: api typecheck ✓ · web typecheck ✓ · 16 unit tests ✓.
  Prisma client moved to project-relative generated output (pnpm-safe).
  Next increment: destinations + explore (Mapbox behind MapsAdapter).
