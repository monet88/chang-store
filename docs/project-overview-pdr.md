# Project Overview & Product Development Requirements

Last updated: 2026-05-03

## Project Identity

**Chang-Store** is an AI-powered virtual fashion studio. It is a single-page application (React 19 + TypeScript + Vite 6) that provides nine AI-driven fashion features backed exclusively by Google Gemini models.

## Product Vision

A virtual photography studio for fashion -- where users can try on clothes, generate lookbooks, change backgrounds and poses, transfer clothing, remove watermarks, create photo albums, generate patterns, and edit images through AI prompts. All AI features work client-side with Gemini while a phased backend foundation adds auth, job execution, and asset persistence.

## Current State

**Version**: 1.0.4 (tag v1.5)
**Branch**: `feat/backend-foundation`
**Status**: Backend foundation in progress -- auth, job queue, and blob storage are implemented. AuthProvider/AuthGate always render; job pipeline is active for `MIGRATED_FEATURES` (TryOn, Lookbook, ClothingTransfer, PhotoAlbum) when backend is deployed.

### Feature Status

| Feature | Code | Client-Only | Backend Pipeline |
|---------|------|-------------|------------------|
| Virtual Try-On | `Feature.TryOn` | Yes | Live |
| Lookbook Generator | `Feature.Lookbook` | Yes | Live |
| Clothing Transfer | `Feature.ClothingTransfer` | Yes | Live |
| Photo Album Creator | `Feature.PhotoAlbum` | Yes | Live |
| Pose Changer | `Feature.Pose` | Yes | Commented out in App.tsx |
| Background Replacer | `Feature.Background` | Yes | Commented out in App.tsx |
| AI Editor | `Feature.AIEditor` | Yes | Commented out in App.tsx |
| Watermark Remover | `Feature.WatermarkRemover` | Yes | Commented out in App.tsx |
| Pattern Generator | `Feature.PatternGenerator` | Yes | Commented out in App.tsx |

## Target Users

- Fashion designers and stylists creating lookbooks and visualizing garments
- E-commerce sellers generating product photos and removing watermarks
- Content creators producing fashion imagery with pose and background control
- Individual users experimenting with virtual try-on

## Functional Requirements

### Core AI Features (Sprint Complete -- v1.0 to v1.5)

- FR-01: Virtual try-on -- overlay garments onto subject images with multi-person targeting
- FR-02: Lookbook generation -- create styled fashion lookbooks from image sets
- FR-03: Background replacement -- swap image backgrounds with predefined or custom scenes
- FR-04: Pose changing -- apply AI-generated pose modifications to fashion shots
- FR-05: Photo album creation -- generate full albums with frames, backgrounds, and poses
- FR-06: AI editor -- prompt-driven image generation with refinement
- FR-07: Watermark removal -- batch removal of watermarks from images
- FR-08: Clothing transfer -- transfer garments between model images
- FR-09: Pattern generation -- create fashion patterns from text descriptions

### Backend Foundation (In Progress -- feat/backend-foundation)

- FR-10: Seeded authentication with HMAC-SHA256 session cookies and scrypt password hashing
- FR-11: CSRF protection via double-submit cookie pattern for mutating endpoints
- FR-12: Job queue in Neon Postgres with idempotency keys, status lifecycle, and stale sweep recovery
- FR-13: Vercel Blob storage for job input/output assets with ownership verification
- FR-14: Zod-validated job payloads per feature with structured error formatting
- FR-15: Rate limiting on login endpoint with Postgres-backed or in-memory storage

### Supporting Capabilities

- FR-16: i18n with English (source of truth) and Vietnamese
- FR-17: Google Drive sync for gallery persistence
- FR-18: Prompt library with curated prompts, search, and copy
- FR-19: Model capability registry for AI model selection
- FR-20: ZIP batch download for results

## Non-Functional Requirements

### Performance

- NFR-01: Lazy-loaded feature components via `React.lazy` and `Suspense`
- NFR-02: SWC-based React compilation (20-30x faster than Babel) via `@vitejs/plugin-react-swc`
- NFR-03: Manual chunk splitting (vendor-react, vendor-genai)
- NFR-04: Job stale sweep at 30 minutes for fire-and-forget crash recovery

### Security

- NFR-05: No hardcoded secrets -- all keys via environment variables
- NFR-06: `timingSafeEqual` for all password and HMAC comparisons
- NFR-07: Session expiry and `HttpOnly; SameSite=Lax; Secure` (production) cookies
- NFR-08: CSRF token required for POST/PUT/DELETE endpoints
- NFR-09: Job ownership enforced on all read/write paths

### Known Security Gaps

- NFR-GAP-01: `GEMINI_API_KEY` is embedded in the client bundle via Vite `define` -- exposed to all users
- NFR-GAP-02: No Content Security Policy headers configured
- NFR-GAP-03: Durable workflows are fire-and-forget with stale sweep recovery, not true durable execution

### Reliability

- NFR-10: Idempotent job creation prevents duplicate work on retry
- NFR-11: Job state transitions validated via `canTransition()` guard
- NFR-12: Transactional job output finalization with rollback on failure
- NFR-13: Stale job sweep marks timed-out jobs as failed

### Maintainability

- NFR-14: Component/Hook separation enforced -- zero service imports from components
- NFR-15: Feature enum drives all routing, no magic strings
- NFR-16: Test coverage thresholds (statements 80%, branches 75%, functions 80%, lines 80%)
- NFR-17: Code files kept under 200-800 lines with modular extraction

## Technical Constraints

- **Gemini-only** -- No multi-provider abstraction. The decision to remove Local/Anti Provider and other AI vendor stubs was made in v1.3.
- **No React Router** -- `App.tsx` uses a `Feature` enum switch with `React.lazy`. Hash routing is a planned v2.0 item.
- **Vercel platform** -- API handlers follow Vercel Functions convention. Neon Postgres and Vercel Blob are the only storage backends.
- **Backend gap** -- Non-migrated feature hooks still call Gemini directly from the client, but the app shell currently renders `AuthGate` unconditionally. A fully backend-free runtime path requires auth gating to be wired or disabled.

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `@google/genai` | ^1.38.0 | Gemini SDK for AI image/text generation |
| `@neondatabase/serverless` | ^1.1.0 | Neon Postgres serverless driver |
| `@vercel/blob` | ^2.3.3 | Vercel Blob storage client |
| `idb-keyval` | ^6.2.2 | IndexedDB key-value wrapper |
| `jszip` | ^3.10.1 | ZIP archive creation for batch downloads |
| `react` / `react-dom` | ^19.2.3 | UI framework |
| `zod` | ^4.4.1 | Schema validation (backend job payloads) |

### Dev Dependencies

Key: `typescript` ~5.8, `vite` ^6.4, `vitest` ^4.0, `tailwindcss` ^4.1, `@vitejs/plugin-react-swc`, `eslint` ^9, `jsdom` ^26, `@testing-library/react` ^16.

## Database Schema

Two migrations in `migrations/`:

**001_initial_schema.sql** -- `users`, `sessions`, `rate_limit_entries` tables with indexes.

**002_job_tables.sql** -- `jobs`, `job_assets`, `job_events` tables with indexes for user-scoped queries.

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | Public | Seeded user login, returns session cookie |
| POST | `/api/auth/logout` | Session | Clears session cookie |
| GET | `/api/auth/session` | Session | Returns current session user |
| GET | `/api/jobs` | Session | List user's jobs (paginated, filterable by status) |
| POST | `/api/jobs` | Session + CSRF | Create and execute a job |
| GET | `/api/jobs/[id]` | Session | Get job status and details |
| POST | `/api/jobs/[id]` | Session + CSRF | Update job (re-run, cancel) |
| GET | `/api/jobs/[id]/results` | Session | Get job results and assets |
| GET | `/api/assets/[path]` | Session | Proxy blob storage with ownership check |

## Architecture Decision Records

Key architectural decisions (not yet formalized as ADRs):

1. **Gemini-only** (v1.3) -- Removed multi-provider stubs. Simpler code, fewer abstractions. Risk: vendor lock-in.
2. **No React Router** -- Switch-based routing keeps the bundle lean. Planned hash routing for v2.0.
3. **Component/Hook Separation** -- Components are presentational; hooks own all logic, state, and API calls. Enforced by UI boundary import tests.
4. **Provider Nesting Order** -- Language -> Toast -> Api -> Auth -> ImageGallery -> ImageViewer -> AuthGate -> AppContent. Each depends on the parent.
5. **Seeded Auth** -- No registration flow. Users are configured via `AUTH_SEEDED_USERS_JSON`. Appropriate for internal/alpha use.
6. **Fire-and-Forget Jobs** -- Current execution path triggers `executeJob()` as a non-awaited promise from the API handler. Crash recovery via stale sweep. Full durable execution is planned.

## Success Metrics

| Metric | Current | Target (v2.0) |
|--------|---------|---------------|
| Features | 9 (4 live, 5 commented out) | 9 (all pipeline) |
| Test coverage | 80% threshold | 80% threshold maintained |
| Bundle size (gzipped) | ~300KB JS | <300KB JS |
| File max lines | ~1200 (some legacy) | <800 |
| Backend auth | Seeded only | Seeded + optional OAuth |
| Job durability | Fire-and-forget + sweep | Durable execution (Workflow/Inngest) |

## Links

- [System Architecture](./system-architecture.md)
- [Code Standards](./code-standards.md)
- [Codebase Summary](./codebase-summary.md)
- [Project Roadmap](./project-roadmap.md)
- [Legacy Architecture](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
