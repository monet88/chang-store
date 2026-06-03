---
title: "Hybrid Vertex Gateway"
description: "Plan a Node 22 Cloud Run gateway that combines Gemini-compatible shared routing with frontend-friendly image endpoints."
status: pending
priority: P2
effort: 12d
branch: feat/vertex-cli-proxy-toggle
tags: [backend, gateway, vertex, gemini, cloud-run, migration]
created: 2026-06-02
---

# Hybrid Vertex Gateway

## Goal
Ship a new Node 22 Cloud Run backend that keeps Ixmoon-style shared gateway routing from `.ref/Gemini-Vertex-Gateway` while borrowing only the simple frontend image endpoint ergonomics from `.ref/Vertex-AI-Proxy`, then migrate Chang Store off the temporary direct-to-proxy client toggle.

## Scope lock
- Keep from Ixmoon: route families (`/gemini`, `/vertex`, optional `/vtx`), strategy-based request dispatch, auth abstraction, trigger-key gateway mode, stateful-vs-stateless handling, request-shape compatibility (`.ref/Gemini-Vertex-Gateway/src/deno_index.ts:29-72`, `.ref/Gemini-Vertex-Gateway/src/auth.ts:33-47`, `.ref/Gemini-Vertex-Gateway/src/strategies.ts:201-301`, `.ref/Gemini-Vertex-Gateway/src/managers.ts:165-209`).
- Keep from Muhammad-Shah-zaib only: narrow custom endpoints returning frontend-ready images/data URLs and simple health/validate flows (`.ref/Vertex-AI-Proxy/src/routes/api.js:8-34`, `.ref/Vertex-AI-Proxy/src/controllers/generateController.js:7-70`).
- Build from scratch: runtime, config, auth, retries, observability, structured errors, bounded concurrency, Cloud Run packaging, and modern Gen AI / Vertex SDK integration for Node 22.

## Current app facts driving migration
- Vertex proxy toggle currently rewires Gemini client base URL in-browser via `ApiProviderContext` and `configureGeminiClient()` (`src/contexts/ApiProviderContext.tsx:16-32`, `src/contexts/ApiProviderContext.tsx:206-226`, `src/services/apiClient.ts:118-183`).
- Text/image Gemini flows still run client-side through `getGeminiClient()` and `imageEditingService.ts` (`src/services/apiClient.ts:164-187`, `src/services/imageEditingService.ts:14-101`).
- Proxy image generation already branches to Gemini-compatible `generateContent()` when a proxy base URL is enabled (`src/services/gemini/image.ts:93-138`, `src/services/gemini/image.ts:197-239`).

## Proposed API surface
- Health/readiness: `GET /healthz`, `GET /readyz`.
- Gemini-compatible SDK surface: `GET /gemini/v1beta/models`, `POST /gemini/v1beta/models/:model:generateContent`, `POST /gemini/v1beta/models/:model:streamGenerateContent`.
- Deferred Gemini-compatible extras: `POST /gemini/v1beta/openai/chat/completions` only when a real consumer is identified; no OpenAI image route in the initial cut.
- Vertex-compatible surface: `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:generateContent`, `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:streamGenerateContent`, `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:predict`.
- Gemini-to-Vertex translation surface: `POST /vtx/v1/models/:model:generateContent`, `POST /vtx/v1/models/:model:predict`.
- Root `/v1*` or `/v1beta*` aliases are out of the initial surface unless Phase 4 proves a saved frontend base URL requires them and adds compatibility tests.
- Frontend-friendly custom endpoints: `POST /api/images/generate`, `POST /api/images/edit`, `POST /api/images/upscale`, `POST /api/images/describe`, `POST /api/session/validate`.

## Phases
| Phase | File | Focus | Depends on |
|---|---|---|---|
| 1 | `./phase-01-architecture-and-runtime.md` | runtime, service layout, Cloud Run contract, config, observability | none |
| 2 | `./phase-02-auth-routing-and-compatibility.md` | auth model, route compatibility, request transforms, stateful policy | 1 |
| 3 | `./phase-03-image-workloads-reliability.md` | image endpoints, retries, concurrency, timeout, error model, tests | 1, 2 |
| 4 | `./phase-04-frontend-migration-and-rollout.md` | incremental frontend migration, rollout, rollback, deprecation | 2, 3 |

## Dependency + ownership
- Phase 1 owns new backend scaffold only: `gateway/*`.
- Phase 2 owns gateway routing/auth files only: `gateway/src/http/*`, `gateway/src/auth/*`, `gateway/src/routes/*`.
- Phase 3 owns gateway workload/services only: `gateway/src/workloads/*`, `gateway/src/lib/*`, `gateway/test/*`.
- Phase 4 owns app migration only: `src/contexts/ApiProviderContext.tsx`, `src/services/apiClient.ts`, `src/services/gemini/image.ts`, `src/services/imageEditingService.ts`, related tests/docs.

## Test matrix
- Unit: config parsing, auth extraction, route selection, retry classifier, structured error serializer.
- Integration: Gemini-compatible proxying, Vertex-compatible proxying, image generate/edit endpoints, health/readiness, CORS rejection, timeout behavior.
- E2E: current frontend uses gateway base URL for one image generate path, then one edit path, without breaking direct Gemini fallback.

## Success criteria
- Cloud Run service runs on Node 22 and exposes both compatibility routes and custom image endpoints.
- Existing frontend can migrate one workflow at a time without forced big-bang rewrite.
- Gateway hides Google creds from browser, adds request IDs/log hooks, and enforces CORS allowlist, timeout, bounded concurrency, retry/backoff with jitter.
- Rollback path exists for each migration step.

## Validation Log
### 2026-06-02 ck:plan validate
- Mode: critical-question validation with all recommended options selected by user instruction.
- Verification tier: Full, because the plan touches backend gateway auth, Google credentials, Cloud Run rollout, and frontend migration.
- Sources checked: repo docs (`README.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, `docs/product/provider-studios.md`, `docs/deployment-guide.md`, `docs/code-standards.md`), Harness matrix, current source/ref files, `@google/genai` Context7 docs, Google Vertex REST docs, Google Cloud Run runtime docs.
- Q1 route scope: choose explicit allowlist, not generic passthrough. Decision: accepted; initial routes are grouped by health, `/gemini/v1beta`, `/vertex/v1`, `/vtx/v1`, and `/api/images/*`.
- Q2 SDK/auth mode: choose server-side Google auth for the gateway, not browser `apiKey + baseUrl` reuse. Decision: accepted; gateway Vertex calls must use Node `@google/genai` Vertex mode with project/location/workload identity or service-account auth.
- Q3 migration base URL: choose compatibility via `/gemini` base URL first, not root route ambiguity. Decision: accepted; root aliases are deferred unless Phase 4 proves they are needed.
- Q4 image workload policy: choose bounded payloads, no unsafe retries, and DTO normalization. Decision: accepted; Phase 3 must freeze body-size/image-count limits and test 413/timeout/quota paths.
- Q5 frontend rollout: choose staged flags at the facade seam. Decision: accepted; `imageEditingService.ts` remains the migration boundary and provider studios stay out of scope.
- Q6 secrets posture: choose credential hiding plus scoped gateway auth. Decision: accepted; no Google key reaches the browser in the production gateway path, and any temporary browser gateway token must be scoped, rotatable, and rate-limited.
- Phase propagation: applied to all four phase files.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-architecture-and-runtime.md, phase-02-auth-routing-and-compatibility.md, phase-03-image-workloads-reliability.md, phase-04-frontend-migration-and-rollout.md.
- Decision deltas checked: 6.
- Reconciled stale references: 4.
- Unresolved contradictions: 0.

## Red Team Review
### 2026-06-02 adversarial review
- Finding 1 - HIGH - Route inventory contradiction: `plan.md` grouped health, Gemini, Vertex, `/vtx`, and `/v1/models` under one Gemini-compatible bullet while Phase 2 used `/gemini/v1beta/models`. Disposition: Accept. Fix: split the API surface and defer root aliases unless tested.
- Finding 2 - HIGH - Gateway SDK/auth mode underspecified: without an explicit Node Vertex client contract, implementers could copy the current browser `apiKey + baseUrl` pattern and fail to hide Google credentials. Disposition: Accept. Fix: Phase 1/2 now require Vertex-mode SDK config and server-side auth.
- Finding 3 - HIGH - Browser gateway key can become a de facto shared secret: CORS alone is not auth, and localStorage token storage remains exposed. Disposition: Accept. Fix: Phase 2/4 now require scoped, rotatable, rate-limited gateway tokens and a long-term no-user-supplied-token posture.
- Finding 4 - HIGH - Base64 image payload limits were too vague for Cloud Run memory safety. Disposition: Accept. Fix: Phase 1/3 now require explicit JSON/body/image-count caps, 413 behavior, and tests.
- Finding 5 - MEDIUM - OpenAI-compatible chat/image routes risk scope creep for an SPA migration. Disposition: Accept. Fix: OpenAI-compatible chat is deferred until a consumer exists; OpenAI image route remains out of initial cut.
- Finding 6 - MEDIUM - Rollout proof lacked exact frontend compatibility tests. Disposition: Accept. Fix: Phase 4 now requires base-url, flag, facade, provider-isolation, production bundle, and smoke-test coverage.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-architecture-and-runtime.md, phase-02-auth-routing-and-compatibility.md, phase-03-image-workloads-reliability.md, phase-04-frontend-migration-and-rollout.md.
- Decision deltas checked: 6.
- Reconciled stale references: 6.
- Unresolved contradictions: 0.

## Open questions
- None.
