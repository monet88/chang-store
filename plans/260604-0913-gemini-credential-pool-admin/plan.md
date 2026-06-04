---
title: "Gemini Credential Pool and Admin Dashboard MVP"
description: "Add an n-project/n-service-account Gemini credential pool with round-robin/failover, then expose a narrow internal admin dashboard for importing and managing credential JSON files, model allowlists, and pool health."
status: in_progress
priority: P2
effort: 4-6d
branch: "main"
tags: [gateway, gemini, openai, vertex, credentials, admin, docker, vps]
blockedBy: []
blocks: [260602-2051-hybrid-vertex-gateway]
created: "2026-06-04T02:13:23.412Z"
createdBy: "ck:plan"
source: skill
---

# Gemini Credential Pool and Admin Dashboard MVP

## Overview

Build the backend pool first, then the admin surface. The gateway currently builds one `GoogleGenAI` client from one project/credential file and passes that client into Gemini, OpenAI-compatible, Vertex-compatible, and custom image workloads. This plan generalizes that seam into an `n`-entry pool without hard-coding three projects, keeps the existing single-credential deploy path working, and adds an internal dashboard only after pool selection and health behavior are proven.

The dashboard borrows the useful parts of `.ref/CLIProxyAPI`: credential cards, redacted auth-file metadata, success/failure health, model catalog visibility, enable/disable actions, JSON import/test/delete flows, and lightweight edit controls for each account. It does not borrow the broad multi-provider management framework, generic API console, Claude/Codex/Anthropic surfaces, or arbitrary proxy/base-url controls.

## Primary Migration Goal

This gateway is the compatibility boundary between legacy Gemini API apps and Gemini Enterprise Agent Platform.

- Legacy apps should migrate by changing only:
  - the gateway `baseURL`
  - the gateway `apiKey`
- Legacy apps should NOT need to adopt Enterprise Agent Platform auth, project/location wiring, or request-shape changes directly.
- The gateway owns the translation from legacy Gemini-style app traffic to the Enterprise/Google Cloud runtime behind it.
- For the current Chang Store fashion web app, the primary preserved seam is the Gemini-compatible SDK path under `/gemini/v1beta/...`. That app should continue working by switching to the gateway base URL and gateway API key, without being forced onto the `openai/v1` surface.
- The `openai/v1` compatibility surface in this plan exists for other apps and future clients, not as the primary execution path for the existing fashion web app.

Non-goals for this plan:

- Direct browser-to-Enterprise migration for old apps
- Requiring old apps to understand Google Cloud service accounts, IAM, project IDs, or location config
- Audio/TTS/STT parity in this plan; those are intentionally deferred

## Agent Platform REST Focus

This plan is intentionally centered on the Agent Platform inference surface that is closest to existing Gemini API app behavior.

Primary REST focus for this plan:

- `generateContent`
- `streamGenerateContent`
- `countTokens`

Secondary REST focus for later phases or future plans:

- `embedContent`
- `predict`
- `rawPredict`
- `serverStreamingPredict`

Feature layers that are built on top of inference but intentionally deferred from this plan unless needed to preserve existing app behavior:

- advanced function-calling expansion beyond the current compatibility subset
- grounding
- code execution
- prompt management / prompt classes
- embeddings

Implementation rule:

- Prefer wrapping the narrow inference contract needed by current text/image apps first.
- Do not widen the gateway into a general Agent Platform mirror unless a concrete app migration requires it.

## Scope Challenge

Scope mode: **Hold scope**. The useful MVP is not a full CLIProxyAPI clone. It is a narrow personal ops surface for Gemini/OpenAI gateway operation:

- Support any number of Vertex/Gemini service-account targets.
- Route existing Gemini, OpenAI-compatible, Vertex-compatible, and image workloads through a pool selector.
- Add OpenAI-compatible image endpoints for generation and edits:
  - `/openai/v1/images/generations`
  - `/openai/v1/images/edits`
- Keep single-project behavior and existing environment variables as a compatibility fallback.
- Make admin routes opt-in, separately authenticated, and secret-redacted.
- Support dashboard import/delete through a Docker/VPS file store backed by a mounted persistent volume.
- Defer full provider framework, Claude Code/Anthropic compatibility, generic proxy routing, usage billing analytics, and multi-user RBAC.
- Defer Cloud Run mutable credential import and Secret Manager integration. MVP deploy target is local Docker and Linux VM/VPS.

Image-model focus for this plan:

- `gemini-2.5-flash-image`
- `gemini-3.1-flash-image`
- `gemini-3-pro-image`

These are the primary Gemini Enterprise Agent Platform image models the user intends to run through this gateway. Validation and rollout proof should use this model set explicitly instead of treating image support as model-agnostic.

## Current State

- `gateway/src/config/env.ts` exposes `GatewayConfig` with a single `googleProject`, `googleLocation`, and `googleCredentialsFile`.
- `gateway/src/lib/google-genai-client.ts` creates exactly one `GoogleGenAI` client.
- `gateway/src/app.ts` creates `const ai = genAiFactory(config)` once, then passes it to Gemini, OpenAI-compatible, Vertex-compatible, and `ImageWorkloads`.
- `gateway/src/routes/health-routes.ts` reports one Google auth status.
- Phase 0-4 of `260603-1329-openai-responses-streaming-gateway` are complete and should be treated as the baseline behavior this plan must preserve.

## Architecture Decision

Recommended path: add a small `GenAiPool` abstraction that implements a new local `GenAiClient` interface (wrapping only `models.generateContent` and `models.generateContentStream`). This interface does not currently exist — Phase 1/2 must define it and refactor all consumers from the SDK's `GoogleGenAI` type.

The pool wrapper returned by `createGenAiRuntime(config).client` must be a **stable long-lived proxy** object. Routes and `ImageWorkloads` capture this reference once at startup; the proxy internally delegates to the currently active snapshot. When `reload()` swaps the snapshot, the same proxy object continues to work — no reconstruction of consumers is needed.

```ts
interface VertexPoolEntry {
  id: string;
  label?: string;
  project: string;
  location: string;
  credentialsFile?: string;
  enabled: boolean;
  weight: number;
  modelAllowlist?: string[];
  modelExclusions?: string[];
}
```

Runtime shape:

- `createApp()` still receives one `GenAiFactory`, and the default factory returns either the current single client or a pool runtime wrapper. The pool wrapper is a stable proxy — routes and `ImageWorkloads` keep one reference to it and all snapshot swaps happen internally.
- The pool runtime owns an immutable active snapshot and supports explicit `reload()` / atomic snapshot swap when admin persistence changes.
- The pool wrapper selects a target before each upstream `generateContent` / `generateContentStream` call.
- Non-streaming calls may fail over before returning a response.
- Streaming calls may fail over only while the pool wrapper has not yielded any chunk to its downstream consumer. This includes failures from `await target.generateContentStream(...)` and failures from the first `iterator.next()` attempt. After the pool wrapper yields the first chunk to `sendSseStream`, that target is pinned for the request and later errors become normal stream errors, not failover triggers.
- **OpenAI Responses streaming restructure:** The Responses route currently emits scaffold SSE events (`response.created`, `output_item.added`, `content_part.added`) BEFORE the first upstream `iterator.next()`. To enable failover for all route families, the Responses route must defer scaffold events until after the first successful `iterator.next()`. This requires refactoring the route to: (1) call `generateContentStream()`, (2) call first `next()`, (3) only then emit scaffold events + first data chunk. If steps 1 or 2 fail, the pool wrapper retries on another target transparently.
- Custom image routes are included because `ImageWorkloads` calls the same `ai.models.generateContent(...)` seam.
- Admin mutation endpoints must either swap a validated new snapshot into the runtime or fail the mutation and leave the previous snapshot active.

## Config Contract

The first implementation should support `vertexPools` in JSON. The current hand-rolled YAML parser only supports flat scalars and string arrays, so nested pool config should be JSON-first unless a real YAML parser is introduced.

Example:

```json
{
  "gatewayKeys": ["dev-key"],
  "googleApiVersion": "v1beta",
  "vertexPoolSelection": "weighted-round-robin",
  "vertexPoolFailoverCooldownMs": 60000,
  "enableAdminRoutes": true,
  "adminAllowMutations": true,
  "adminStoreMode": "file-store",
  "adminFileStoreDir": "/data/auths",
  "modelCatalog": {
    "gemini": {
      "defaultModel": "gemini-2.5-flash",
      "aliases": {
        "fast": "gemini-2.5-flash"
      },
      "allowlist": ["gemini-2.5-flash", "gemini-2.5-flash-image"],
      "disabled": []
    },
    "openai": {
      "defaultModel": "gemini-2.5-flash",
      "aliases": {
        "gpt-4o-mini": "gemini-2.5-flash"
      },
      "allowlist": ["gpt-4o-mini", "gpt-4.1-mini"],
      "disabled": []
    }
  },
  "vertexPools": [
    {
      "id": "project-a",
      "label": "Project A",
      "project": "project-a",
      "location": "global",
      "credentialsFile": "/run/secrets/vertex-a.json",
      "enabled": true,
      "weight": 1,
      "modelAllowlist": ["gemini-2.5-flash", "gemini-2.5-flash-image"]
    }
  ]
}
```

Backward compatibility:

- If `vertexPools` is empty or absent, the gateway behaves exactly like today using `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_VERTEX_PROJECT`, and `GOOGLE_VERTEX_LOCATION`.
- If both old single-credential fields and `vertexPools` are present, the explicit pool wins and readiness should report `mode: "pool"`.
- Invalid or disabled pool entries must fail fast at startup unless at least one enabled valid target remains.
- `modelCatalog` is the source of truth for admin model edits. Per-credential `modelAllowlist` / `modelExclusions` narrows availability, while provider-level aliases/defaults live in `modelCatalog`.
- File discovery must be explicit. Keep `GATEWAY_CONFIG_FILE` as the existing flat YAML-or-JSON file and add `GATEWAY_POOL_CONFIG_FILE` as the optional JSON overlay for `vertexPools`, `modelCatalog`, and admin store config.

## Admin Boundary

Admin is opt-in:

- `GATEWAY_ENABLE_ADMIN_ROUTES=false` by default.
- `GATEWAY_ADMIN_TOKEN` or equivalent secret is required when enabled.
- Admin endpoints live under `/admin/api/*`; the static dashboard lives under `/admin`.
- Admin API authentication transport is `Authorization: Bearer <GATEWAY_ADMIN_TOKEN>` only. Do not accept admin tokens from query strings, cookies, `x-api-key`, or `x-goog-api-key`.
- **Startup validation:** `GATEWAY_ADMIN_TOKEN` must NOT be present in `GATEWAY_API_KEYS`. Overlap would allow public gateway users to reach admin routes. Fail startup with a fatal error if they overlap.
- `GET /admin` may serve a static login shell with no secret data. Every data/action request under `/admin/api/*` must include the Bearer token.
- Admin CORS is same-origin only. Do not expose admin routes through wildcard CORS.
- Admin route dispatch must happen before the current public `classifyRequest()` + `requireAuth()` path and must not reuse the public `extractApiKey()` bearer parsing, because public auth already accepts `Authorization: Bearer`, `x-api-key`, and `x-goog-api-key`.
- **CORS ordering:** Admin path check must occur BEFORE `applyCors()` in `app.ts`. Admin paths skip public CORS and apply same-origin-only CORS (no `Access-Control-Allow-Origin` header). This prevents cross-origin requests to admin routes from whitelisted public origins.
- Raw service-account JSON is accepted only on import/test endpoints and is never returned, logged, or stored in browser local storage.
- Mutating admin endpoints require `GATEWAY_ADMIN_ALLOW_MUTATIONS=true` and a writable store adapter.
- On Cloud Run (`K_SERVICE` present), admin file-store mutations are out of MVP and must fail fast at startup when `adminAllowMutations=true`. Route-level checks may exist only as defense-in-depth, not as the primary guard.
- Imported credentials must use server-generated/sanitized IDs, reject collisions unless an explicit replace flag is present, and verify that the service-account `project_id` matches the target metadata being created.

Docker/VPS storage policy:

- Production MVP path: run the gateway in Docker on local or Linux VM/VPS and mount a persistent host volume such as `./gateway-data/auths:/data/auths`.
- `file-store` writes imported service-account JSON and account metadata into that mounted volume with restrictive permissions.
- Container restarts must preserve imported credentials because the store lives on the host VM disk, not inside the disposable container layer.
- Cloud Run remains unsupported for mutable file-store import in MVP.

## Source Inputs

- Gateway code scout: [`research/gateway-scout.md`](./research/gateway-scout.md)
- CLIProxyAPI dashboard scout: [`research/cliproxyapi-admin-scout.md`](./research/cliproxyapi-admin-scout.md)
- CLIProxyAPI local reference repo: [.ref/CLIProxyAPI](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI)
- CLIProxyAPI local deep links:
  - [README.md](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/README.md)
  - [internal/api/handlers/management/auth_files.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/auth_files.go)
  - [internal/api/handlers/management/vertex_import.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/vertex_import.go)
  - [internal/api/handlers/management/model_definitions.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/model_definitions.go)
  - [sdk/auth/filestore.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/sdk/auth/filestore.go)
  - [sdk/api/handlers/openai/openai_images_handlers.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/sdk/api/handlers/openai/openai_images_handlers.go)
- Docker deployment target: local Docker and Ubuntu/Linux VM with a mounted persistent data directory.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Contract and Config Schema](./phase-01-contract-and-config-schema.md) | Completed |
| 2 | [Credential Pool Runtime](./phase-02-credential-pool-runtime.md) | Completed |
| 3 | [Health Metrics and Failover](./phase-03-health-metrics-and-failover.md) | Completed |
| 4 | [Admin API and Persistence](./phase-04-admin-api-and-persistence.md) | Completed |
| 5 | [Admin Dashboard UI](./phase-05-admin-dashboard-ui.md) | Completed |
| 6 | [OpenAI-Compatible Images Surface](./phase-06-openai-compatible-images.md) | Completed |
| 7 | [Validation and Rollout](./phase-07-validation-and-rollout.md) | Completed |

## Dependencies

- Builds on completed plan `260603-1329-openai-responses-streaming-gateway`.
- Blocks stale/pending plan `260602-2051-hybrid-vertex-gateway` until that plan is refreshed or archived, because both touch gateway auth/routing/client construction.
- Does not depend on `260531-2132-provider-studio-ui-parity`; this admin dashboard is a gateway ops surface, not the end-user fashion studio UI.

## Validation Strategy

- Unit: config schema, credential validation, pool scheduler, failover/cooldown, admin auth, redaction, model catalog.
- Integration: existing Gemini/OpenAI/Responses/stream routes with a fake multi-target client proving target rotation.
- Endpoint parity: add OpenAI-compatible image generation/edit proofs for `/openai/v1/images/generations` and `/openai/v1/images/edits`.
- SDK proof: keep existing OpenAI and Google SDK local smoke tests green.
- Ops: add or extend Docker/VPS smoke checks for pool health, per-target test checks, and persistence after container restart.
- Security: prove admin disabled-by-default, unauthorized admin requests reject, raw private keys are not returned by any API.
- Admin auth proof must show `Authorization: Bearer <token>` works, missing/invalid Bearer rejects, normal `GATEWAY_API_KEYS` do not authorize admin, and query/cookie API-key transports are ignored for admin.
- Redaction proof must cover `private_key`, `private_key_id`, token/auth URIs, raw service-account blobs, generic errors, and request logs.
- Compatibility proof must explicitly cover OpenAI Chat JSON/SSE, OpenAI Responses JSON/SSE, OpenAI Images Generate/Edit JSON, Gemini native JSON/SSE, Vertex native stream, and custom image routes under pool mode.
- Public readiness proof must stay minimal. Detailed per-target health, emails, and recent failures belong to authenticated admin health endpoints, not public `/readyz`.
- Migration proof must explicitly show that legacy app clients can switch to the gateway by changing only `baseURL` + gateway `apiKey`, with no app-level auth-model change.
- Migration proof must explicitly include the current fashion web app seam: `@google/genai` client using `/gemini/v1beta/...` through the gateway.
- Image proof must explicitly cover the supported model set:
  - `gemini-2.5-flash-image`
  - `gemini-3.1-flash-image`
  - `gemini-3-pro-image`

Core validation commands:

```bash
npm --prefix gateway run test
npm --prefix gateway run compile
npx tsc --noEmit
npm run lint
npm run test
npm run build
git diff --check
```

## Red Team Review

Accepted concerns:

- **Secret persistence risk:** writing inside a container layer is not durable. Accepted fix: production MVP uses Docker/VPS with an explicit mounted host volume for `file-store`.
- **SSE failover risk:** switching targets after the wrapper has yielded a stream chunk would corrupt client semantics. Failover is allowed only before the pool wrapper emits its first downstream chunk, even if the underlying SDK first `next()` fails before yielding data.
- **Pool fairness risk:** strict round-robin is simple but ignores weights, disabled entries, and cooldown. MVP should implement weighted round-robin with skip-on-unhealthy.
- **Admin blast radius:** dashboard import/delete can break all gateway traffic. Admin routes must be opt-in, separately authenticated, and covered by delete/disable tests.
- **Plan overlap risk:** the older Hybrid Vertex Gateway plan is still `pending`; this plan explicitly blocks it until refreshed so future agents do not cook stale gateway migration steps.
- **Runtime reload risk:** admin API that writes credential config without swapping the live pool would be misleading. Accepted fix: Phase 2 defines an atomic snapshot/reload runtime, Phase 4 mutations must call it and rollback on failure.
- **Model source-of-truth risk:** admin model edits were uncookable without schema. Accepted fix: Phase 1 owns `modelCatalog` and Phase 4 persists only that contract.
- **Cloud Run store risk:** file-store mutation on Cloud Run is unsafe. Accepted fix: Cloud Run mutable import is out of MVP; startup fails when `K_SERVICE` is present with file-store mutations enabled.
- **Admin seam risk:** current app-wide CORS/auth flow is public-route-first. Accepted fix: Phase 4 must branch `/admin` and `/admin/api/*` before public gateway auth and use route-specific admin CORS/auth handling.
- **Config discovery risk:** current loader knows only one `GATEWAY_CONFIG_FILE`. Accepted fix: Phase 1 must define explicit overlay discovery via `GATEWAY_POOL_CONFIG_FILE` instead of an implied second file.
- **Public readiness leak risk:** current `/readyz` is unauthenticated. Accepted fix: keep `/readyz` summary-only and move per-target detail to authenticated `/admin/api/health`.

Rejected expansions:

- Full CLIProxyAPI multi-provider dashboard.
- Generic management `api-call` console.
- Claude Code / Anthropic `/v1/messages`.
- Arbitrary proxy/base-url controls.
- Multi-user RBAC in MVP.
- Secret Manager-backed Cloud Run live import in MVP.

## Validation Log

### Session 1 — 2026-06-04
**Trigger:** `/ck:plan validate plans/260604-0913-gemini-credential-pool-admin/plan.md`
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture/Config]** Phase 1 says JSON-first for nested config and "do not extend the current flat YAML parser." Should the gateway load TWO config files (existing YAML + new JSON for pools/modelCatalog), or migrate to a single JSON config file?
   - Options: YAML + JSON coexist | Migrate entirely to JSON | Single file, auto-detect format
   - **Answer:** YAML + JSON coexist (Recommended)
   - **Rationale:** Best backward compatibility. Existing single-credential deploys keep their YAML config; pool users add a separate JSON config file for `vertexPools` + `modelCatalog`. Both files are loaded and merged with env vars holding highest precedence.

2. **[Architecture/Admin UI]** Phase 5 says "single static admin shell with no build step" served from gateway. How should the admin HTML/JS be delivered?
   - Options: Inline static HTML from Express | Static .html file served by Express | Multi-file static assets folder
   - **Answer:** Inline static HTML from Express (Recommended)
   - **Rationale:** Zero build step, smallest surface. Hand-crafted HTML/CSS/JS returned as a string from an Express route. Matches plan's "no build step" intent and keeps the admin surface self-contained in the gateway process.

3. **[Architecture/Snapshot]** Phase 2 says in-flight requests finish on the old snapshot after reload() swaps the active one. How should old snapshots be garbage collected?
   - Options: Reference counting | Fixed TTL timeout | Immediate swap, no retention
   - **Answer:** Reference counting (Recommended)
   - **Rationale:** Track in-flight request count per snapshot. When count hits zero after reload, old snapshot is eligible for GC. Simple, no timers, no risk of dropping long-running requests. Each request increments on start and decrements on completion/error.

4. **[Architecture/Credential ID]** Phase 4 says imported credentials get "server-generated/sanitized IDs from project/email." How deterministic should credential IDs be?
   - Options: Deterministic from project+email | Random short slug | User-provided ID on import
   - **Answer:** Deterministic from project+email (Recommended)
   - **Rationale:** ID = sanitized(project + '-' + email). Same SA imported under same project/email = same ID → collision rejected (unless explicit replace flag). Predictable, debuggable, prevents accidental duplicates.

#### Confirmed Decisions
- Config coexistence: YAML (flat) + JSON (nested pools/modelCatalog), merged with env var precedence
- Admin UI delivery: Inline static HTML string from Express route, no build step
- Snapshot lifecycle: Reference counting — old snapshot GC'd when in-flight request count reaches zero
- Credential ID: Deterministic = `sanitize(project + '-' + email)`, collision rejected without explicit replace flag

#### Impact on Phases
- Phase 1: Config loading must document two-file coexistence (YAML for flat + JSON for nested). `modelCatalog` lives in JSON config only.
- Phase 2: `GenAiPoolSnapshot` must include atomic reference counter. `GenAiRuntime.reload()` acquires new snapshot, old snapshot ref-counts to zero then GCs.
- Phase 4: Credential store import must generate deterministic IDs from `project_id` + `client_email`, reject collisions, support explicit replace flag.
- Phase 5: Admin UI is a single TypeScript file exporting an HTML string (or function returning HTML string). No separate `.html` file, no `express.static`.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04, phase-05, phase-06
- Decision deltas checked: 4 (config coexistence, admin UI delivery, snapshot lifecycle, credential ID)

### Session 2 — 2026-06-04
**Trigger:** Codex validate + red-team rerun against current gateway seams

#### New Findings Applied

1. **Config discovery gap**
   - Current gateway loader reads only one `GATEWAY_CONFIG_FILE`.
   - Fix applied to plan: define explicit `GATEWAY_POOL_CONFIG_FILE` JSON overlay for nested pool/admin config.

2. **Admin auth/CORS collision**
   - Current app flow applies public `applyCors()` and `requireGatewayAuth()` before ordinary route dispatch, and public auth already accepts Bearer/API-key transports.
   - Fix applied to plan: `/admin` and `/admin/api/*` must branch before public route/auth handling and use separate admin CORS/auth logic.

3. **Public `/readyz` overexposure**
   - Current `/readyz` is unauthenticated and already exposes auth metadata.
   - Fix applied to plan: keep `/readyz` summary-only; move detailed per-target health to authenticated admin health.
- Reconciled stale references: 1 (removed "collision-safe suffixes" from Phase 4, replaced with deterministic ID)
- Unresolved contradictions: 0

### Red Team Review — Session 3 — 2026-06-04
**Trigger:** `/ck:plan red-team plans/260604-0913-gemini-credential-pool-admin/`
**Reviewers:** 4 hostile subagents (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic)
**Verification tier:** Full (all 4 roles)
**Findings:** 15 (10 accepted, 5 rejected)
**Severity breakdown:** 3 Critical, 12 High, 0 Medium

**Reconciliation note:** The original hostile-review packet mixed valid architecture findings with several stale symbol/type assertions from a mismatched code snapshot. This plan section is the reconciled source of truth against the current `chang-store` workspace. In particular, the live repo already defines `GenAiClient`, and the current public gateway symbols are `classifyRoute`, `requireGatewayAuth`, `extractGatewayKey`, and `loadServiceAccountCredential`.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Stable local `GenAiClient` contract must remain explicit and be treated as the pool seam | Critical | Accept with correction | Phase 1/2 |
| 2 | `ImageWorkloads` captures stale ref — pool wrapper must be stable proxy | Critical | Accept | Phase 2 |
| 3 | OpenAI Responses streaming emits SSE before upstream — failover impossible | Critical | Accept | Phase 3 |
| 4 | Several symbol-name assertions from the hostile packet were stale and had to be reconciled to the current repo names | High | Accept with correction | plan.md + Phase 4 |
| 5 | Snapshot swap — no per-request pinning mechanism defined | High | Accept | Phase 2 |
| 6 | Admin token can collide with gateway keys — startup validation needed | High | Accept | Phase 4 |
| 7 | All-targets-on-cooldown — behavior undefined, needs fallback | High | Accept | Phase 3 |
| 8 | `GenAiFactory` change breaks 30+ test sites — not enumerated | High | Accept | Phase 2 |
| 9 | `applyCors()` runs before route dispatch — admin CORS leak | High | Accept | Phase 4 |
| 10 | File-store concurrent mutations can race during import/patch/delete/reload | High | Defer | Phase 4 risk note |
| 11 | Weighted round-robin is over-engineered for MVP | High | Reject | — |
| 12 | Reference counting for snapshot GC is premature | Medium | Reject | — |
| 13 | `modelCatalog` is over-scoped for MVP | High | Reject | — |
| 14 | Full admin dashboard UI is over-scoped | High | Reject | — |
| 15 | Admin auth has no rate limiting | High | Reject | — |

#### Rejected Rationale
- **#11 Weighted RR:** User explicitly validated in Session 1.
- **#12 Ref counting:** User explicitly chose in Session 1 Q3.
- **#13 modelCatalog:** Included by design intent; per-target `modelAllowlist` already requires model awareness.
- **#14 Dashboard:** User wants visual ops; inline HTML is minimal scope.
- **#15 Rate limiting:** Admin is opt-in, behind firewall. Follow-up concern.
- **#10 Mutation serialization:** Deferred for MVP. Admin is a single-user internal ops surface, so server-side serialization is intentionally omitted. Residual race risk is accepted and should be reduced with basic UI double-submit prevention.
- **#1/#4 hostile-packet mismatch:** The hostile report correctly identified seam ambiguity, but its concrete claim that `GenAiClient` did not exist and that the repo had already renamed symbols like `classifyRequest()` / `requireAuth()` was stale. The reconciled plan keeps the valuable seam clarification while aligning names to the live repo.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04, phase-05, phase-06
- Decision deltas checked: 10 (explicit GenAiClient seam, stable proxy, Responses streaming restructure, stale-name reconciliation, snapshot pinning, token validation, cooldown fallback, test blast radius, CORS ordering, mutation-risk disposition)
- Reconciled stale references: 5 (hostile packet symbol/type assertions were re-aligned to the live repo names in plan.md and phase-04)
- Unresolved contradictions: 0

### Session 3 — 2026-06-04
**Trigger:** Red-team review adjudication — validating 4 architectural decisions from accepted findings
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture/Pool Proxy]** Red-team found `ImageWorkloads` captures `ai` reference at construction. How should the pool wrapper handle this?
   - Options: Stable proxy (swap internals) | Reconstruct ImageWorkloads on reload | No pool for images
   - **Answer:** Stable proxy — `ImageWorkloads` and routes keep same reference, snapshot swap happens inside proxy
   - **Rationale:** Simplest approach — pool wrapper is a single object whose internal state (active snapshot) swaps atomically. No need to reconstruct consumers. `ImageWorkloads.ai.models.generateContent()` delegates through the proxy to the current snapshot.

2. **[Architecture/Streaming Failover]** OpenAI Responses streaming emits scaffold SSE before upstream. How to handle failover?
   - Options: Exclude Responses from failover | Restructure route to defer scaffold | Disable all streaming failover
   - **Answer:** Restructure route to defer scaffold SSE events until after first successful `iterator.next()`
   - **Rationale:** Enables failover for ALL route families uniformly. Requires refactoring the Responses route (moving scaffold emission after first `next()`), but avoids creating a failover gap. Phase 3 step 6 updated with restructure requirements.

3. **[Architecture/Test Blast Radius]** Pool runtime needs reload/snapshot behavior, but `createApp()` currently injects `genAiFactory`. How should the seam evolve?
   - Options: Keep `genAiFactory` and return a stable proxy | Full refactor to `genAiRuntime` | Backward-compatible overload
   - **Answer:** Keep `genAiFactory` and make the factory return a stable proxy
   - **Rationale:** This preserves the current `createApp()` seam, avoids unnecessary API churn, and still solves the stale-reference problem because routes and `ImageWorkloads` keep one long-lived proxy object whose internals swap on reload.

4. **[Architecture/Mutation Mutex]** Red-team found concurrent admin mutations can race. How should MVP handle this?
   - Options: Async mutex | File lock (flock) | No mutex (single-user)
   - **Answer:** No mutex — admin is single-user, concurrent mutations are unsupported in MVP
   - **Rationale:** The server intentionally accepts residual race risk for this internal single-user ops surface. The plan should state that clearly and rely on basic UI double-submit prevention rather than pretending serialization exists.
   - **Rationale:** Personal gateway with one admin operator. TOCTOU race requires two concurrent admin requests, which is implausible in practice. Keeping it simple. Can add mutex later if needed.

#### Confirmed Decisions
- Pool proxy: stable long-lived proxy, internal snapshot swap — no consumer reconstruction
- Streaming failover: restructure OpenAI Responses route to defer scaffold events — enable universal failover
- Injection seam: keep `genAiFactory`; factory returns a stable proxy and tests expand only where pool/proxy behavior must be proven
- Mutation serialization: not needed for single-user admin MVP

#### Impact on Phases
- Phase 2: `AppOptions` stays on `genAiFactory?: GenAiFactory`. The implementation changes what the factory returns, not the `createApp()` API shape. Test touchpoints stay enumerated for proxy/pool proof.
- Phase 3: Step 6 changed from "exclude Responses from failover" to "restructure Responses route to defer scaffold events". Success criteria updated.
- Phase 4: Mutex implementation step and success criteria removed.
