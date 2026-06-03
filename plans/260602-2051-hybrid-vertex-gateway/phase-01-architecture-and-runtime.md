# Phase 01 — Architecture and Runtime

## Context links
- Current browser-side proxy toggle: `src/contexts/ApiProviderContext.tsx:16-32`, `src/contexts/ApiProviderContext.tsx:206-244`, `src/services/apiClient.ts:118-183`
- Current Gemini image branch for proxy mode: `src/services/gemini/image.ts:93-138`, `src/services/gemini/image.ts:197-239`
- Ixmoon gateway entry and strategy manager: `.ref/Gemini-Vertex-Gateway/src/deno_index.ts:29-72`, `.ref/Gemini-Vertex-Gateway/src/deno_index.ts:112-236`, `.ref/Gemini-Vertex-Gateway/src/managers.ts:165-209`
- Muhammad-Shah-zaib simple API ergonomics: `.ref/Vertex-AI-Proxy/src/routes/api.js:8-34`, `.ref/Vertex-AI-Proxy/src/controllers/generateController.js:7-70`, `.ref/Vertex-AI-Proxy/src/config/cors.js:3-21`

## Overview
- Priority: P1
- Status: pending
- Brief: lock service shape before any code. Pick Node 22 + Cloud Run, not Deno Deploy. Reuse Ixmoon architecture ideas, not Ixmoon runtime.

## Key insights
- Ixmoon’s strongest reusable idea is the separation of route detection, strategy resolution, auth selection, and upstream transformation. That survives runtime migration cleanly.
- The current app already assumes a Gemini-compatible base URL switch, so the fastest migration path is a new gateway that preserves Gemini-style paths first, then adds custom image endpoints for higher-level frontend ergonomics.
- Muhammad-Shah-zaib’s value is not architecture. It is the thin, frontend-friendly controller contract returning `success + images[]/text` payloads.

## Requirements
### Functional
- New backend lives under `gateway/` at repo root.
- Node 22 runtime, TypeScript, Cloud Run container.
- Expose health/readiness endpoints and structured startup config validation.
- Support both compatibility routes and custom image endpoints.
- Env schema must distinguish browser-to-gateway auth from server-side Google auth.

### Non-functional
- Cold-start conscious, stateless, horizontally scalable.
- No browser-visible Google service-account credentials.
- Log correlation via request IDs.
- Metrics hooks for latency, retries, status buckets, model usage.
- JSON/body limits, upstream concurrency, and timeout defaults must be explicit config values, not scattered literals.

## Architecture
### Proposed layout
- `gateway/package.json`
- `gateway/Dockerfile`
- `gateway/cloudbuild.yaml` or deploy script
- `gateway/src/server.ts` — bootstrap, shutdown
- `gateway/src/app.ts` — middleware wiring
- `gateway/src/config/env.ts` — schema validation
- `gateway/src/http/request-context.ts` — request ID + logger binding
- `gateway/src/http/error-response.ts` — structured error envelope
- `gateway/src/routes/health-routes.ts`
- `gateway/src/routes/gemini-compatible-routes.ts`
- `gateway/src/routes/vertex-compatible-routes.ts`
- `gateway/src/routes/custom-image-routes.ts`
- `gateway/src/strategies/*` — Ixmoon-inspired strategy layer
- `gateway/src/workloads/*` — generate/edit/upscale/describe adapters
- `gateway/src/lib/google-genai-client.ts`
- `gateway/src/lib/vertex-client.ts`
- `gateway/src/lib/retry.ts`, `gateway/src/lib/concurrency.ts`, `gateway/src/lib/cors.ts`

### Data flow
1. Request enters Cloud Run service.
2. Middleware assigns request ID, deadline, logger context, auth context.
3. Router classifies request into compatibility or custom path.
4. Strategy/workload layer validates payload and maps it to Google Gen AI or Vertex request shape.
5. Upstream client executes with bounded concurrency + retry policy.
6. Response normalizer returns either passthrough-compatible payload or frontend-friendly payload.
7. Logging/metrics hook records outcome.

### Runtime decisions
- Framework: Fastify or Express are both viable; recommend Fastify for lower overhead and first-class schema hooks. Keep choice local to backend; no impact on SPA.
- Validation: Zod at boundaries.
- Logging: pino JSON logs.
- Metrics: OpenTelemetry hook or pluggable counter/timer interface.
- Cloud Run config: min instances 0/1 by env, request timeout 60s service-wide, per-endpoint tighter app timeouts.
- Cloud Run runtime: Node.js 22 (`nodejs22` / `google-22` base image) is current and must be pinned in container/deploy config.
- Google SDK split: browser compatibility routes can preserve Gemini-shaped payloads, but gateway upstream Vertex calls must use Node `@google/genai` Vertex mode (`vertexai: true`, `project`, `location`, optional `googleAuthOptions`) or workload identity/ADC. Do not reuse the SPA `apiKey + httpOptions.baseUrl` pattern for server-to-Google calls.
- Route prefix contract: initial SDK compatibility expects the frontend base URL to include `/gemini`; root `/v1*` aliases stay disabled unless Phase 4 proves and tests a migration need.

## Related code files
### Existing files to modify later
- `src/contexts/ApiProviderContext.tsx`
- `src/services/apiClient.ts`
- `src/services/gemini/image.ts`
- `src/services/imageEditingService.ts`

### Files to create in this phase
- `gateway/*` scaffold listed above

### Files to delete
- None in this phase

## Implementation steps
1. Create `gateway/` package with Node 22, TypeScript, test runner, lint config, Dockerfile.
2. Add `env.ts` schema covering gateway keys, Google auth mode, Google project/location, CORS allowlist, JSON/body size limit, timeout values, concurrency limits, retry settings, route flags, and Cloud Run metadata.
3. Add middleware stack: request ID, JSON body limit, CORS, deadline propagation, error handler, logger.
4. Add `/healthz` and `/readyz` with shallow/deep checks.
5. Add Google client factories with tests proving Vertex-mode server auth is separate from browser gateway auth.
6. Add backend folder boundaries so later phases do not share files.
7. Add deploy docs/manifest for Cloud Run revision-based rollout.

## Todo list
- [ ] Create runtime scaffold under `gateway/`
- [ ] Choose framework and freeze it
- [ ] Define env schema and secret sources
- [ ] Freeze SDK auth mode and route prefix contract
- [ ] Define body-size, timeout, concurrency, and route-flag defaults
- [ ] Define request ID and logging format
- [ ] Define health/readiness behavior
- [ ] Define Cloud Run container and rollout contract

## Success criteria
- `gateway/` boots locally on Node 22.
- Startup fails fast on invalid config.
- `/healthz` returns process health; `/readyz` verifies config/client readiness.
- Middleware order is documented and testable.
- Tests prove Google upstream credentials are server-side only and route prefix defaults are explicit.
- No frontend files touched yet.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Over-copying Deno-specific Ixmoon code | Medium | High | Reuse architecture only; rebuild runtime adapters from scratch |
| Shared files across phases causing merge churn | Medium | Medium | Keep Phase 1 limited to `gateway/*` scaffold |
| Config sprawl with unclear precedence | High | Medium | Single `env.ts` schema + explicit precedence docs |
| Cloud Run timeout mismatch with image workloads | Medium | High | Service timeout 60s, per-request app deadlines lower and endpoint-specific |
| Server client accidentally reuses browser `apiKey + baseUrl` pattern | Medium | High | Dedicated Google client factory tests for Vertex mode / workload identity |
| Base64 payloads exceed memory budget before routing | High | High | Body limit middleware, image-count caps, and 413 test before workload code |

## Security considerations
- CORS allowlist from env, default deny.
- JSON body size limit.
- No logging of raw bearer tokens or base64 payloads.
- Secrets sourced from env/Secret Manager only.
- Prefer Workload Identity/ADC on Cloud Run; local service-account credentials are dev-only and must never be bundled into the SPA.

## Backwards compatibility
- No change to current app behavior in this phase.
- Service can be developed and deployed dark without frontend usage.

## Rollback plan
- Delete/disable Cloud Run revision; app remains on current direct/proxy toggle.
- No schema/data migration in this phase.

## Next steps
- Phase 02 consumes route map, middleware order, and env schema.
- Blockers for next phase: framework choice, auth env contract, route namespace freeze.

## Unresolved questions
- None.
