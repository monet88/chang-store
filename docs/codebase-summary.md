# Codebase Summary

Last updated: 2026-05-03 | Based on repomix compaction + manual review

## Scope

Excludes `.git/`, `.claude/`, `node_modules/`, `dist/`, `coverage/`, `plans/`, `__tests__/`, media files, and `docs/api/` vendor references.

## File Count & Size

| Area | Files | LOC | Description |
|------|-------|-----|-------------|
| `src/` | ~126 | ~21,928 | Frontend application code |
| `server/` | ~16 | ~1,201 | Backend shared modules |
| `api/` | ~13 | ~1,099 | Vercel Functions API handlers |
| `workflows/` | ~4 | ~282 | Durable workflow runners |
| `migrations/` | ~2 | ~83 | SQL migration files |
| `docs/` | ~7 | ~many | Project documentation |
| Root config | ~21 | -- | Build, lint, CI, env config |

Test files: 54 test files in `__tests__/` (excluded from LOC counts above).

## Frontend (`src/`)

### Components (`src/components/`)
- 9 feature components: `VirtualTryOn.tsx`, `LookbookGenerator.tsx`, `BackgroundReplacer.tsx`, `PoseChanger.tsx`, `PhotoAlbumCreator.tsx`, `AIEditor.tsx`, `WatermarkRemover.tsx`, `ClothingTransfer.tsx`, `PatternGenerator.tsx`
- Shared UI: `Header.tsx`, `GlobalModelSelector.tsx`, `MobileMenuButton.tsx`, `MobileOverlay.tsx`, `UtilityDock.tsx`, `Spinner.tsx`, `Toast.tsx`, `JobStatusBadge.tsx`, `JobHistoryView.tsx`
- Modals: `GalleryModal.tsx`, `PromptLibraryModal.tsx`, `PoseLibraryModal.tsx`, `SettingsModal.tsx`
- Auth: `AuthGate.tsx`, `LoginModal.tsx`

### Hooks (`src/hooks/`)
- One hook per feature: `useVirtualTryOn.ts`, `useLookbookGenerator.ts`, `useBackgroundReplacer.ts`, `usePoseChanger.ts`, `usePhotoAlbum.ts`, `useAIEditor.ts`, `useWatermarkRemover.ts`, `useClothingTransfer.ts`, `usePatternGenerator.ts`
- Infrastructure hooks: `useJobPoll.ts` (shared job state), `useJobHistoryView.ts`, `useModelSelection.ts`, `useSettingsModal.ts`, `useGoogleDriveSync.ts`, `useGalleryPersistence.ts`, `usePromptLibrary.ts`
- Additional hooks: `useInpainting.ts`, `useSwapFace.ts`

### Services (`src/services/`)
- `imageEditingService.ts` -- unified facade for client-only AI operations
- `gemini/chat.ts` -- Gemini chat/conversation generation
- `gemini/image.ts` -- Gemini image generation/editing functions
- `gemini/text.ts` -- Gemini text generation for analysis and prompts
- `gemini/video.ts` -- Gemini video generation
- `apiClient.ts` -- Base HTTP client for backend API calls
- `authService.ts` -- Auth API client (login, logout, session)
- `debugService.ts` -- API call logging
- `geminiService.ts` -- Server-side Gemini stub
- `googleDriveService.ts` -- Google Drive API wrapper
- `jobService.ts` -- Job queue API client (createJob, pollJob, getJobResults)
- `textService.ts` -- Text generation service

### Contexts (`src/contexts/`)
- `AuthContext.tsx` -- Authenticated user state, session polling
- `ApiProviderContext.tsx` -- Gemini API key, model selectors, provider configuration
- `LanguageContext.tsx` -- i18n with `useLanguage()` hook
- `ImageGalleryContext.tsx` -- Persistent image gallery with IndexedDB
- `ImageViewerContext.tsx` -- Full-screen image viewer state

### Config (`src/config/`)
- `modelRegistry.ts` -- Model capability registry (imageEdit, imageGenerate, textGenerate)
- `modelSelectionRules.ts` -- Model selection logic and capability rules

### Utils (`src/utils/`)
- `virtual-try-on-prompt-builder.ts` -- Try-on prompt construction
- `lookbookPromptBuilder.ts` -- Lookbook prompt construction
- `clothing-transfer-prompt-builder.ts` -- Clothing transfer prompt construction
- `pattern-generator-prompt-builder.ts` -- Pattern generator prompt construction
- `watermark-prompts.ts` -- Watermark removal prompt construction
- `photoAlbumConfig.ts` -- Photo album layout/scene configuration
- `imageUtils.ts` -- Image dimension, conversion, and processing utilities
- `imageDownload.ts` -- Single image download with filename sanitization
- `zipDownload.ts` -- Batch ZIP download
- `imageCache.ts` -- Image caching utilities
- `galleryDB.ts` -- IndexedDB gallery persistence
- `storage.ts` -- Session state persistence
- `batch-image-session.ts` -- Batch image session management
- `run-bounded-workers.ts` -- Bounded concurrency control

### Locales (`src/locales/`)
- `en.ts` -- English (source of truth), contains all i18n keys including pose data
- `vi.ts` -- Vietnamese translations

## Backend (`api/`)

### API Handlers (`api/`)
- `auth/login.ts` -- POST, validates seeded credentials, sets session cookie, rate-limited
- `auth/logout.ts` -- POST, clears session cookie, revokes session
- `auth/session.ts` -- GET, returns current AuthenticatedUser from session cookie
- `jobs/index.ts` -- GET (list user jobs) + POST (create/execute job), CSRF-protected
- `jobs/[id].ts` -- GET (job details) + POST (cancel/retry), CSRF-protected
- `jobs/[id]/results.ts` -- GET, returns JSON `{ job, results }` with DB asset records (id, job_id, kind, blob_path, mime_type, created_at)
- `assets/[path].ts` -- GET, proxies blob storage with job ownership verification

### API Libraries (`api/_lib/`)
- `auth.ts` -- HMAC-SHA256 session tokens, scrypt password hashing, cookie management
- `csrf-middleware.ts` -- Double-submit CSRF token validation for mutating methods
- `rate-limiter.ts` -- Fixed 15-minute window rate limiter
- `http.ts` -- JSON response helpers, error formatting, body parsing
- `trace.ts` -- Trace ID extraction from request headers

## Backend Shared (`server/`)

- `db.ts` -- Database interface (`DB`), SQL template tag, and all query functions for users, sessions, jobs, job assets, job events
- `neon.ts` -- Neon Postgres pool singleton, `getNeonPool()`, transaction support
- `gemini.ts` -- Server-side Gemini client, `generateImage()`, `editImage()`, `generateImagesFromBatch()`
- `validation.ts` -- Zod schemas for 4 pipeline features (try-on, clothing-transfer, lookbook, photo-album), `validateJobPayload()` router
- `jobs.ts` -- Job status transition rules (`canTransition`, `transitionStatus`)
- `rate-limiter-storage.ts` -- Postgres-backed rate limit storage adapter
- `blob.ts` -- Vercel Blob storage wrapper
- `adapters/base-adapter.ts` -- `submitJob()`, `completeJob()`, `failJob()`, `partialJob()`, `reconcileJobOutputs()`
- `adapters/virtual-try-on.ts` -- Try-on adapter: validate, mapInput, mapOutput
- `adapters/clothing-transfer.ts` -- Clothing transfer adapter
- `adapters/lookbook.ts` -- Lookbook adapter
- `adapters/photo-album.ts` -- Photo album adapter
- `workflows/gemini-executor.ts` -- Routes feature shapes to Gemini `editImage` or batch generation
- `workflows/job-runner.ts` -- `executeJob()` entry point, adapter loading, delegates to `feature-runner.ts`

## Workflows (`workflows/`)

- `canary.ts` -- Vercel Workflow / Inngest canary check
- `feature-runner.ts` -- `runFeatureJob()`: status transitions, Gemini execution, blob upload, output finalization, cleanup on failure
- `helpers.ts` -- `createWorkflowContext()`, `withErrorHandling()` wrapper

## Migrations (`migrations/`)

- `001_initial_schema.sql` -- Tables: `users` (id, username, password_hash, status, timestamps), `sessions` (user_id FK, token_fingerprint, expires_at, revoked_at), `rate_limit_entries` (username, window_start PK, attempt_count)
- `002_job_tables.sql` -- Tables: `jobs` (user_id FK, feature, status, idempotency_key UNIQUE, input_payload_json JSONB, progress, timestamps, error fields), `job_assets` (job_id FK, kind CHECK input/output, blob_path, mime_type), `job_events` (job_id FK, event_type, event_payload_json JSONB, trace_id)

## Data Flow: Client-Only Mode (Default)

```
User action -> Feature Component -> Feature Hook -> imageEditingService
    -> gemini/image.ts -> GoogleGenAI client -> Gemini API
    -> Result -> Hook state -> Component render
```

Gallery persistence: `ImageGalleryProvider` -> IndexedDB (`idb-keyval`) + optional Google Drive sync.

## Data Flow: Backend Pipeline Mode

```
User action -> Feature Component -> Feature Hook -> jobService.ts
    -> POST /api/jobs (auth + CSRF)
    -> createJob (Neon, idempotency) -> executeJob (fire-and-forget)
    -> Gemini server client -> Vercel Blob upload -> finalizeJobOutputs
Client polls GET /api/jobs/:id -> GET /api/jobs/:id/results -> JSON { job, results }
    -> Hook downloads blobs via /api/assets/[path] -> Component render
```

## Key Architectural Properties

1. **Strict layering** -- Components never import services directly. Hooks are the only bridge.
2. **Feature enum gating** -- `MIGRATED_FEATURES` array in `App.tsx` controls which features use the backend pipeline vs. client-only path.
3. **Idempotency by hash** -- SHA-256 over `userId:feature:sortedPayload` prevents duplicate job creation.
4. **Fire-and-forget execution** -- Jobs are triggered as non-awaited promises with crash recovery via 30-minute stale sweep.
5. **Single Gemini client** -- Both client-side and server-side use `@google/genai`; the server client is a thin wrapper for the job pipeline.
6. **No ORM** -- Raw SQL with a template tag helper (`sql` tagged template) and manual row mapping.
