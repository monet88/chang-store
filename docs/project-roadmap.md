# Project Roadmap

Last updated: 2026-05-03 | Current phase: v2.0 Backend Foundation (in progress)

## Phase Summary

```
v1.0 (MVP)     -> v1.5 (Features) -> v2.0 (Foundation) -> v3.0 (Product) -> v4.0 (Scale)
  Done              Done              In Progress           Planned           Future
```

## Completed

### v1.0 -- MVP Foundation (2026-03-16)

- 9 AI features: Try-On, Lookbook, Background, Pose, PhotoAlbum, AIEditor, WatermarkRemover, ClothingTransfer, PatternGenerator
- Gemini-only architecture (removed multi-provider stubs)
- Google Drive sync integration
- Full i18n (English + Vietnamese)
- CI pipeline (GitHub Actions)

### v1.2 -- Source Root Migration (2026-03-24)

- Migrated all source to `src/`
- Updated alias, build config, and test imports

### v1.3 -- Virtual Try-On Optimization (2026-04-01)

- Interleaved `Part[]` prompt builder
- Flat 3-column batch result grid
- Default 2K quality, 3:4 aspect ratio

### v1.4 -- Prompt Library (2026-04-02)

- Prompt Library modal with search, copy, and curated prompts
- Batch ZIP download for Try-On
- Bounded concurrency workers

### v1.5 -- Multi-Person & Polish (2026-04-02)

- Multi-person targeting for Virtual Try-On
- Pattern Generator feature complete
- `React.memo` performance pass

### Post-v1.5 -- Architecture Hardening (2026-04-06 to 2026-04-28)

- Runway-inspired dark cinematic UI redesign
- Model registry and capability system
- Service boundary refactor -- hooks own all logic, zero service imports from components
- UI import boundary enforcement tests

## In Progress: v2.0 -- Backend Foundation

### Phase 2a: Auth MVP (Complete)

- [x] HMAC-SHA256 stateless session cookies (`chang_store_session`)
- [x] scrypt password hashing with `timingSafeEqual` comparisons
- [x] Seeded users via `AUTH_SEEDED_USERS_JSON` with `admin`/`user` roles
- [x] CSRF double-submit cookie protection for mutating endpoints
- [x] Rate limiting on login endpoint (Postgres or in-memory)
- [x] Session audit logging in `sessions` table
- [x] `AuthProvider` + `AuthGate` in React context tree

### Phase 2b: Job Queue (Complete)

- [x] Neon Postgres job queue with `jobs`, `job_assets`, `job_events` tables
- [x] Zod-validated feature payloads (try-on, clothing-transfer, lookbook, photo-album)
- [x] Idempotency via SHA-256 over `userId:feature:sortedPayload`
- [x] Job status lifecycle: queued -> running -> completed/failed/partial
- [x] Status transition guards (`canTransition`)
- [x] Vercel Blob storage for job output assets
- [x] Blob asset ownership verification via `job_assets` join
- [x] 30-minute stale job sweep for crash recovery
- [x] Fire-and-forget Gemini execution from API handler

### Phase 2c: Feature Migration (Partial)

- [x] Virtual Try-On migrated to job pipeline
- [x] Lookbook Generator migrated to job pipeline
- [x] Clothing Transfer migrated to job pipeline
- [x] Photo Album Creator migrated to job pipeline
- [ ] Pose Changer -- gated, pending job adapter
- [ ] Background Replacer -- gated, pending job adapter
- [ ] AI Editor -- gated, pending job adapter
- [ ] Watermark Remover -- gated, pending job adapter
- [ ] Pattern Generator -- gated, pending job adapter

### Phase 2d: Remaining Foundation Work

- [ ] Durable execution -- wire Vercel Workflow or Inngest instead of fire-and-forget
- [ ] Client-side API key removal -- backend Gemini proxy for client-only mode
- [ ] Content Security Policy headers in `vercel.json`
- [ ] Job retry with exponential backoff
- [ ] SSE/webhook push for job status (replace polling)
- [ ] IndexedDB adapter for gallery images (replace base64-in-memory)
- [ ] Auto-save session state (current feature, form inputs, results)

## Planned: v3.0 -- Product Polish

### UX Improvements

- [ ] Guided onboarding -- first-time user flow highlighting core features
- [ ] Multi-step progress UI -- replace spinner with contextual status messages
- [ ] Swipe-to-compare slider (original vs. generated)
- [ ] Global drag-and-drop -- drop image anywhere, auto-route to appropriate tool
- [ ] Pipeline/workflow concept -- chain features (shoot -> relight -> upscale -> export)

### Feature Tiering

- [ ] Classify features: Core / Supporting / Labs
- [ ] Sidebar navigation by tier -- Core features prominent, Labs hidden
- [ ] Evaluate Virtual Try-On vs. Clothing Transfer overlap

### Quality and Trust

- [ ] Token/cost estimator -- display estimated API credits before generation
- [ ] Better error messages -- diagnose why generation failed
- [ ] Graceful degradation when Gemini API has issues
- [ ] Zod runtime validation for Gemini JSON outputs

### Testing

- [ ] Integration tests for E2E feature flows
- [ ] Visual regression tests (Playwright snapshots)
- [ ] Accessibility audit (WCAG 2.1 AA)

## Future: v4.0 -- Scale

- [ ] Multi-provider support (provider abstraction, not just Gemini)
- [ ] Collaborative features (share lookbooks, team workspaces)
- [ ] Analytics and telemetry (feature usage, drop-off tracking)
- [ ] PWA support (offline-capable, installable)
- [ ] Video generation integration

## Metrics and Goals

| Metric | Current | v2.0 Target | v3.0 Target |
|--------|---------|-------------|-------------|
| Features with pipeline | 4 of 9 | 9 of 9 | 9 of 9 |
| Job durability | Fire-and-forget + sweep | Durable (Workflow/Inngest) | Durable |
| Client API key exposed | Yes | Proxy in place | Proxy |
| CSP headers | Missing | Configured | Enforced |
| Test coverage | 80% threshold | 80% threshold | Comprehensive |
| Routing | None | Hash routing | Hash routing |
| Asset persistence | IndexedDB + Drive | IndexedDB + Drive + Blob | Multi-backend |

## Related Documents

- [Project Overview & PDR](./project-overview-pdr.md) -- Full requirements and feature status
- [System Architecture](./system-architecture.md) -- Architecture and data flows
- [Legacy Roadmap](./ROADMAP.md) -- Earlier roadmap version (may have additional context)
- [Changelog](./CHANGELOG.md) -- Release-by-release change history
