# System Architecture

Last updated: 2026-05-03

## Overview

Chang-Store operates in two parallel modes selected at build time via feature flags:

1. **Client-Only Mode** (default: `VITE_ENABLE_AUTH=false`) -- All AI calls go directly from the browser to the Gemini API. No backend required.
2. **Backend Pipeline Mode** (`VITE_ENABLE_AUTH=true`, `VITE_ENABLE_JOB_QUEUE=true`) -- API calls go through Vercel Functions to a Neon Postgres job queue with durable execution and Vercel Blob asset storage.

Both modes share the same frontend components and hooks. The `MIGRATED_FEATURES` array in `App.tsx` controls which features route through the backend pipeline.

## High-Level Architecture

```
[Browser]
  |
  |-- Client-Only Path (all features when VITE_ENABLE_AUTH=false)
  |   Component -> Hook -> imageEditingService -> Gemini API
  |
  |-- Backend Pipeline Path (MIGRATED_FEATURES when VITE_ENABLE_AUTH=true)
      Component -> Hook -> jobService -> /api/jobs (Vercel Function)
                                          |
                                    [Neon Postgres]
                                          |
                                    executeJob (fire-and-forget)
                                          |
                                    Gemini API -> Vercel Blob
                                          |
                                    Client polls /api/jobs/:id/results
```

## Frontend Architecture

### Component Tree

```
<LanguageProvider>
  <ToastProvider>
    <ApiProvider>
      <AuthProvider>
        <ImageGalleryProvider>
          <ImageViewerProvider>
            <AuthGate>
              <AppContent>
                <Header />
                <GlobalModelSelector />
                <MobileMenuButton />
                <MobileOverlay />
                <UtilityDock />
                <JobStatusBadge />
                <JobHistoryView />
                <Suspense>
                  {feature switch -> lazy FeatureComponent}
                </Suspense>
                <Suspense>
                  {modals: Gallery, PromptLibrary, PoseLibrary, Settings}
                </Suspense>
              </AppContent>
            </AuthGate>
          </ImageViewerProvider>
        </ImageGalleryProvider>
      </AuthProvider>
    </ApiProvider>
  </ToastProvider>
</LanguageProvider>
```

### Feature Routing

No React Router. `App.tsx` switches on `Feature` enum values with `React.lazy`:

```typescript
const MIGRATED_FEATURES: Feature[] = [
  Feature.TryOn, Feature.Lookbook, Feature.ClothingTransfer, Feature.PhotoAlbum,
];
```

Features in `MIGRATED_FEATURES` use the backend pipeline when auth and job queue are enabled. All others use the client-only Gemini path regardless.

### Provider Responsibilities

| Provider | State Owned | Persistence |
|----------|-------------|-------------|
| `LanguageProvider` | Locale (`en`/`vi`) | `localStorage` |
| `ToastProvider` | Toast message queue | Memory only |
| `ApiProvider` | Gemini API key, model selectors | `localStorage` |
| `AuthProvider` | `AuthenticatedUser`, session polling | Session cookie |
| `ImageGalleryProvider` | Gallery images, Drive sync | IndexedDB + Google Drive |
| `ImageViewerProvider` | Full-screen image viewer | Memory only |
| `AuthGate` | Auth state gating | -- |

### Service Layer

```
src/services/
├── imageEditingService.ts     # Unified facade for ALL image gen/edit
├── gemini/
│   ├── image.ts               # editImage, generateImage, generateImagesFromBatch
│   ├── text.ts                # Text/JSON generation
│   └── client-factory.ts      # GoogleGenAI client init
├── googleDriveService.ts      # Drive API wrapper
├── jobService.ts              # Job queue API client
├── authService.ts             # Auth API client
├── authServer.ts              # Auth state management
└── debugService.ts            # API call logging
```

### Model Registry

`src/config/modelRegistry.ts` centralizes model selection:

- `imageEditModels` -- Models for image-to-image editing (try-on, clothing transfer)
- `imageGenerateModels` -- Models for text-to-image generation
- `textGenerateModels` -- Models for text/JSON generation
- Capability rules in `modelSelectionRules.ts` determine which model to use per feature

## Backend Architecture

### API Layer (`api/`)

Vercel Functions with `{ fetch }` export convention. A custom Vite plugin (`devApiBridge`) maps `/api/*` requests in dev to these handlers using `ssrLoadModule`.

All handlers follow this pattern:
1. Parse request (auth, CSRF, body)
2. Validate input
3. Query/update database
4. Return JSON response

### Authentication Flow

```
POST /api/auth/login
  Parse { username, password }
  authenticateSeededUser(username, password)
    -> Find user in AUTH_SEEDED_USERS_JSON or dev defaults
    -> scrypt verify password hash
  createSessionToken(user) -> HMAC-SHA256 JWT-like cookie
  Set-Cookie: chang_store_session=<token>; HttpOnly; SameSite=Lax

Subsequent requests:
  getSessionTokenFromRequest(request) -> extract cookie
  getAuthenticatedUserFromRequest(request) -> verify HMAC + expiry
  getAuthenticatedSessionFromRequest(db, request) -> verify + sync user to DB
```

### Session Token Structure

```
base64url(JSON({ sub, name, provisioning, exp })).base64url(HMAC-SHA256(payload))
```

- Stateless verification (no DB lookup needed for auth)
- DB lookup only for user existence sync and status check
- Session audit records created in `sessions` table

### CSRF Protection

Double-submit cookie pattern:

1. Client receives `csrf_token` cookie on first request
2. Client sends `X-CSRF-Token` header on mutating requests (POST/PUT/DELETE)
3. Server compares header value to cookie value
4. Token reissued on mismatch or expiry

Applied via `withCsrf()` wrapper around API handlers.

### Job Queue System

#### Schema

| Table | Purpose |
|-------|---------|
| `jobs` | Job records with status lifecycle, idempotency, progress |
| `job_assets` | Input/output blob path references |
| `job_events` | Audit log of all state transitions |

#### Job Lifecycle

```
queued -> running -> completed
                  -> failed
                  -> partial (some outputs, some errors)
```

Transitions validated by `canTransition()`:

| From | Valid To |
|------|----------|
| `queued` | `running` |
| `running` | `completed`, `failed`, `partial` |
| (terminal) | (no transitions) |

#### Idempotency

```
idempotencyKey = SHA-256(userId + ":" + feature + ":" + JSON.stringify(sortedPayload))
```

Unique constraint on `jobs.idempotency_key`. Re-submitting the same payload returns the existing job (HTTP 200) instead of creating a duplicate.

#### Execution Flow

```
POST /api/jobs
  auth check -> CSRF check
  validateJobPayload(feature, body.payload) -> Zod parse
  createJob(db, userId, feature, idempotencyKey, payload) -> INSERT
  createJobEvent(db, jobId, 'queued')
  void executeJob(db, job, traceId)  // FIRE AND FORGET
  return 201 + job

executeJob:
  loadAdapter(feature) -> virtual-try-on | clothing-transfer | lookbook | photo-album
  runFeatureJob(db, job, adapter, geminiExecuteStep, traceId)
    updateJobStatus -> 'running'
    adapter.mapInput(payload)
    geminiExecuteStep(input) -> Gemini API
    upload results to Vercel Blob (outputs/:jobId/:index.png)
    completeJob / partialJob / failJob
    createJobEvent
```

#### Asset Retrieval

```
GET /api/jobs/:id/results
  auth check -> job ownership check
  getJobAssets(db, jobId) -> filter kind='output'
  generate signed URLs from Vercel Blob
  return { id, assets: [{ blobPath, url, mimeType }] }
```

#### Stale Job Sweep

On every `GET /api/jobs`, stale jobs (queued/running, created >30 min ago) are marked as failed with `TIMEOUT` error code. This is the crash recovery mechanism for fire-and-forget execution.

### Storage Backends

#### Neon Postgres

- Serverless driver via `@neondatabase/serverless`
- Pool singleton with max 20 connections, 30s idle timeout
- Transaction support with rollback on error
- Used for: users, sessions, rate limits, jobs, job assets, job events

#### Vercel Blob

- Optional, gated by `VITE_ENABLE_BLOB_STORAGE`
- Used for: job output assets (PNG images)
- Ownership enforced: blob proxy checks `job_assets` join before serving
- Signed URLs generated for client download

### Rate Limiting

- Fixed 15-minute window
- Postgres-backed when `DATABASE_URL` is set, in-memory fallback otherwise
- Applied to `POST /api/auth/login`
- Uses `ON CONFLICT ... DO UPDATE` for atomic increment

### Workflow Canary

`workflows/canary.ts` tests whether the Vercel Workflow runtime is available. If it fails, the system can fall back to Inngest. Currently, both paths are stubbed and actual execution uses `void executeJob()` directly.

## Data Flow: Complete Job Execution

```
1. User submits try-on request in browser
2. useVirtualTryOn hook calls jobService.createJob(feature, payload)
3. Browser -> POST /api/jobs { feature: "try-on", payload: { personImage, garmentImage } }
4. Vercel Function handler:
   a. Verify session cookie
   b. Verify CSRF token
   c. Zod-validate payload
   d. Compute idempotency key
   e. INSERT INTO jobs (transaction)
   f. INSERT INTO job_events (queued)
5. Fire-and-forget: executeJob(db, job, traceId)
   a. Load try-on adapter
   b. Transition job to 'running'
   c. Map input payload -> Gemini image parts
   d. Call Gemini editImage API
   e. Store results in Vercel Blob: outputs/{jobId}/0.png, 1.png, ...
   f. INSERT INTO job_assets (output records)
   g. Transition job to 'completed'
   h. INSERT INTO job_events (completed)
6. Client polls GET /api/jobs/:id (every 5s, Retry-After: 15s)
7. On completion, client fetches GET /api/jobs/:id/results
8. Server generates signed blob URLs, returns asset list
9. Client downloads images from signed URLs
10. Hook renders results in component
```

## Known Architecture Limitations

1. **Dual GEMINI_API_KEY paths** -- The API key exists both in the client bundle (Vite `define`) and server environment. A backend proxy for client calls is needed to remove the client-side key.
2. **No durable execution** -- Jobs are fire-and-forget. If the Vercel Function crashes mid-execution, the job stays `running` until the 30-minute stale sweep marks it failed. Work done is lost.
3. **No retry with backoff** -- Failed jobs are not automatically retried. Clients must re-submit.
4. **No webhook/SSE** -- Clients poll for job status. No push notifications.
5. **No multi-tenancy** -- Jobs are user-scoped but there is no org/team concept.
6. **Blob storage optional** -- Without blob storage, job pipeline has no asset persistence for results.

## Related Documents

- [Codebase Summary](./codebase-summary.md) -- File-by-file inventory
- [Code Standards](./code-standards.md) -- How to write code in this project
- [Project Overview & PDR](./project-overview-pdr.md) -- Requirements and feature status
- [Legacy Architecture (GitNexus)](./ARCHITECTURE.md) -- Earlier architecture snapshot
