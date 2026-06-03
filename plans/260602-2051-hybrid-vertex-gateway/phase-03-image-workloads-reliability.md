# Phase 03 — Image Workloads and Reliability

## Context links
- Current image facade entry points: `src/services/imageEditingService.ts:14-101`, `src/services/imageEditingService.ts:109-247`
- Current Gemini image proxy/direct split: `src/services/gemini/image.ts:7-15`, `src/services/gemini/image.ts:93-138`, `src/services/gemini/image.ts:140-261`
- Current image workflow callers: 16 hook call sites across `src/hooks/*`; examples `src/hooks/useBackgroundReplacer.ts:144`, `src/hooks/usePatternGenerator.ts:95`, `src/hooks/useVirtualTryOn.ts:251`, `src/hooks/useWatermarkRemover.ts:201` (16 total from ripgrep)
- Ixmoon buffered retries and streaming caution: `.ref/Gemini-Vertex-Gateway/src/strategies.ts:90-181`
- Muhammad-Shah-zaib image result normalization: `.ref/Vertex-AI-Proxy/src/controllers/generateController.js:7-25`, `.ref/Vertex-AI-Proxy/src/models/vertexAI.js:27-70`

## Overview
- Priority: P1
- Status: pending
- Brief: provide the practical endpoints the frontend actually needs, then harden them for Cloud Run production.

## Key insights
- The SPA mostly wants `generate`, `edit`, `upscale`, and some text/describe helper behavior, not raw generic proxying everywhere.
- Returning data URLs and normalized image arrays is proven ergonomic for frontend adoption.
- Image workloads have the highest failure rate: quota, latency, large payloads, and retries on non-idempotent edit flows.

## Requirements
### Functional
- Custom endpoints:
  - `POST /api/images/generate`
  - `POST /api/images/edit`
  - `POST /api/images/upscale`
  - `POST /api/images/describe`
  - `POST /api/session/validate`
- Response shape for image endpoints:
  - `success: true`
  - `images: [{ index, dataUrl, mimeType, metadata? }]`
  - optional `warnings[]`
- Support prompt + optional image/reference payloads matching current frontend needs.

### Non-functional
- Per-request timeout budget.
- Bounded concurrency for upstream calls.
- Retry/backoff with jitter for safe operations only.
- Structured logs/metrics and stable error codes.
- Explicit JSON/body byte caps and image-count caps; reject oversize requests with 413 before upstream work.

## Architecture
### Keep / borrow / build
- Keep from Ixmoon: request buffering awareness, route strategy boundary, retry thinking for stateless requests.
- Keep from Muhammad-Shah-zaib: normalized image response DTO and simple health/validate UX.
- Build from scratch: concurrency limiter, timeout helper, retry classifier, payload size guardrails, image-specific error taxonomy.

### Recommended endpoint contracts
#### `POST /api/images/generate`
Request:
- `prompt: string`
- `model?: string`
- `aspectRatio?: '1:1' | '9:16' | '16:9' | '4:3' | '3:4'`
- `numberOfImages?: 1..4`
Response:
- `success`
- `images[]` as data URLs
- `warnings[]` when fallback model used

#### `POST /api/images/edit`
Request:
- `prompt: string`
- `images: [{ mimeType, data }]` where `data` is raw base64, not a data URL
- `model?: string`
- `aspectRatio?`
- `resolution?`
Response same normalized shape

#### `POST /api/images/upscale`
Request:
- `image: { mimeType, data }` where `data` is raw base64, not a data URL
- `quality: '2K' | '4K'`
- `model?`
Response same normalized shape, single image

### Reliability policy
- Timeout defaults:
  - health/readiness: 2s
  - describe/text helper: 15s
  - image generate/edit/upscale: 45s app deadline, below Cloud Run service timeout
- Concurrency:
  - global upstream semaphore, env-tunable
  - per-request fanout cap for `numberOfImages`
- Payload guardrails:
  - freeze max JSON body bytes, max input images, max decoded image bytes, and max `numberOfImages` before implementation
  - return structured `VALIDATION_FAILED` with HTTP 413 for oversize payloads; never log raw base64
- Retry with jitter:
  - retry only transient 429/5xx/network errors
  - no automatic retry for edit/upscale after upstream accepted work unless operation proven idempotent
  - fallback model switch only on explicit quota classifier
- Error envelope:
  - `error.code`: `AUTH_INVALID`, `CORS_DENIED`, `TIMEOUT`, `UPSTREAM_QUOTA`, `UPSTREAM_UNAVAILABLE`, `VALIDATION_FAILED`, `IMAGE_NOT_RETURNED`

### Data flow
1. Custom route validates body with Zod and rejects oversize payloads before workload code.
2. Workload service converts payload to Google request DTO.
3. Concurrency guard acquires slot.
4. Timeout wrapper + retry policy run upstream operation.
5. Normalizer extracts inline data/base64 and emits frontend DTO.
6. Logger/metrics emit duration, model, fallback, retry count, payload class.

## Related code files
### Files to create/own
- `gateway/src/routes/custom-image-routes.ts`
- `gateway/src/workloads/generate-image-workload.ts`
- `gateway/src/workloads/edit-image-workload.ts`
- `gateway/src/workloads/upscale-image-workload.ts`
- `gateway/src/workloads/describe-image-workload.ts`
- `gateway/src/lib/retry.ts`
- `gateway/src/lib/concurrency.ts`
- `gateway/src/lib/timeout.ts`
- `gateway/src/lib/metrics.ts`
- `gateway/test/custom-image-routes.test.ts`
- `gateway/test/retry-policy.test.ts`
- `gateway/test/concurrency.test.ts`

### Existing app files impacted later
- `src/services/gemini/image.ts`
- `src/services/imageEditingService.ts`
- hook callers listed above

## Implementation steps
1. Define Zod schemas for each custom endpoint.
2. Build reusable normalizer converting inline/base64 image responses to `dataUrl` DTOs.
3. Contract-test the SDK method choice: keep `generateContent` for Gemini-compatible image generation and inline image parsing.
4. Implement payload limit helper, timeout helper, and transient error classifier.
5. Implement bounded concurrency semaphore and per-request image fanout cap.
6. Add integration tests for success, timeout, CORS deny, 413 payload rejection, validation failures, and missing inline image output.

## Todo list
- [ ] Freeze custom endpoint schemas
- [ ] Freeze payload-size and image-count caps
- [ ] Implement DTO normalizer
- [ ] Add SDK response contract fixtures
- [ ] Implement timeout + retry + jitter
- [ ] Implement concurrency limiter
- [ ] Add logs/metrics hooks
- [ ] Add unit and integration tests

## Success criteria
- Frontend can call one custom endpoint and receive image DTOs with no extra parsing.
- Timeouts and retries are deterministic and covered by tests.
- Concurrency is bounded and env-configurable.
- Logs include request ID, route, model, status, latency, retries, fallback.
- Oversize payloads fail before upstream calls and do not duplicate base64 buffers in logs.
- Contract tests cover inline image extraction and `IMAGE_NOT_RETURNED`.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Retrying non-idempotent image edits creates duplicate charges/work | Medium | High | Disable automatic retry for unsafe operations |
| Base64 payloads blow memory on Cloud Run | High | High | request body limit, decoded-byte cap, image count cap, concurrency cap, 413 tests |
| Fallback model hides quality changes | Medium | Medium | return warning metadata when fallback occurs |
| Too-generic endpoint contract drifts from current app needs | Medium | Medium | start with only 4 concrete image endpoints |

## Security considerations
- Max payload size and max image count enforced.
- MIME allowlist.
- Strip EXIF/metadata only if product requires it later; do not speculate now.
- Error logs redact prompts/images by default; enable prompt logging only in explicit local debug mode.

## Backwards compatibility
- Phase can ship while compatibility routes remain primary.
- Frontend migration can adopt custom endpoints workflow-by-workflow.

## Rollback plan
- Disable `/api/images/*` via feature flag or route registration toggle.
- Frontend falls back to compatibility route/direct path.

## Next steps
- Phase 04 maps each current frontend workflow onto either compatibility routes or custom endpoints.
- Blockers: endpoint schema freeze, retry policy freeze.

## Unresolved questions
- None.
