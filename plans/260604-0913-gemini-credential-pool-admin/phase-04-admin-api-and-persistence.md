---
phase: 4
title: "Admin API and Persistence"
status: pending
priority: P2
effort: "0.75-1d"
dependencies: [3]
---

# Phase 4: Admin API and Persistence

## Overview

Expose a narrow opt-in admin API for credential import, redacted credential listing, enable/disable, per-target tests, and model metadata. Persistence must be explicit and safe for the deployment mode.

## Requirements

- Functional: admin routes are disabled by default and require a separate admin token when enabled.
- Functional: admin token transport is `Authorization: Bearer <GATEWAY_ADMIN_TOKEN>` for `/admin/api/*`.
- Functional: `GET /admin` can serve the login shell without data, but all admin data/action endpoints require Bearer auth.
- Functional: import validates service-account JSON and stores only server-side.
- Functional: Docker/VPS live import/delete is supported in MVP through `file-store`.
- Functional: list/detail endpoints return redacted metadata, health, and model coverage.
- Functional: support enable/disable/delete and test connection actions.
- Functional: admin mutations must call `GenAiRuntime.reload(...)` and return failure if the new store state cannot become the active runtime state.
- Functional: model admin endpoints persist only the Phase 1 `modelCatalog` schema and per-target model allow/exclude metadata.
- Non-functional: no raw credential JSON in responses, logs, localStorage, or generic error bodies.
- Non-functional: no generic arbitrary upstream API console.
- Non-functional: admin auth must not accept query-string tokens, cookies, `x-api-key`, `x-goog-api-key`, or normal gateway API keys.
- Non-functional: `GATEWAY_ADMIN_TOKEN` must NOT be present in `GATEWAY_API_KEYS` — startup must fail if they overlap.
<!-- Updated: Red Team Session 3 — admin token collision guard (Finding #6) -->

## Architecture

Admin route family:

- Static UI: `GET /admin`
- API prefix: `/admin/api/*`

Core endpoints:

- `GET /admin/api/health`
- `GET /admin/api/vertex-credentials`
- `POST /admin/api/vertex-credentials/import`
- `GET /admin/api/vertex-credentials/:id`
- `PATCH /admin/api/vertex-credentials/:id`
- `DELETE /admin/api/vertex-credentials/:id`
- `POST /admin/api/vertex-credentials/:id/test`
- `GET /admin/api/models?provider=gemini|openai`
- `PUT /admin/api/models/:provider`
- `POST /admin/api/runtime/reload`

Persistence adapters:

- `static-config`: read-only, uses configured `vertexPools`.
- `file-store`: local/Docker/VPS store under an explicit configured directory that should be backed by a mounted persistent host volume.

MVP must ship `static-config` and `file-store` only. Secret Manager is intentionally out of MVP because the chosen deploy target is Docker on local/VPS, not Cloud Run.

Mutation contract:

- `static-config` returns read-only errors for import/patch/delete/model writes.
- `file-store` allows mutations only when `adminAllowMutations=true`, `adminFileStoreDir` is configured, and `K_SERVICE` is absent.
- If `K_SERVICE` is present with `adminStoreMode: "file-store"` and mutations enabled, config validation/startup must fail before the HTTP server accepts requests.
- File paths are generated server-side, sanitized to basename-only IDs, and rejected if they escape `adminFileStoreDir`.
- File writes use restrictive permissions and atomic temp-file-then-rename behavior where practical.
- **Credential ID generation:** IDs are deterministic: `sanitize(project_id + '-' + client_email)`. Sanitization replaces non-alphanumeric chars with hyphens, collapses consecutive hyphens, and lowercases. Same SA imported under same project/email → same ID → collision rejected (unless explicit `replace=true`). This makes IDs predictable, debuggable, and prevents accidental duplicates without random suffixes.
- Replacing an existing credential requires an explicit `replace=true` flag.
- The imported service-account `project_id` must match the created target's `project`.
- Every mutation validates a full next snapshot and calls `GenAiRuntime.reload(...)`; failure rolls back the store write or leaves the previous store state active.
- `/admin` and `/admin/api/*` must branch before `applyCors()` in `app.ts`, then before public route classification (`classifyRequest()`) and public gateway auth (`requireAuth()`). Admin auth must not reuse `extractApiKey()` because that helper accepts public gateway transports that are forbidden for admin.
- **CORS ordering:** Admin path detection must occur BEFORE `applyCors()` in the request handler. Admin paths skip public CORS entirely and apply same-origin-only CORS (no `Access-Control-Allow-Origin` header set).
**Mutation serialization:** MVP intentionally does NOT serialize admin mutations server-side. Concurrent import/patch/delete/reload operations are unsupported by design because this is a single-user internal admin surface. The residual race risk is accepted for MVP and should be reduced with basic UI double-submit prevention.
<!-- Updated: Validation Session 3 — mutation serialization explicitly deferred for single-user MVP -->

## Related Code Files

- Create: `gateway/src/admin/admin-auth.ts`
- Create: `gateway/src/admin/admin-routes.ts`
- Create: `gateway/src/admin/credential-store.ts`
- Create: `gateway/src/admin/model-store.ts`
- Modify/Create: `gateway/src/lib/genai-runtime.ts`
- Modify: `gateway/src/app.ts`
- Modify: `gateway/src/http/request-classifier.ts`
- Modify: `gateway/src/config/env.ts`
- Create: `gateway/test/admin-routes.test.ts`
- Create: `gateway/test/admin-auth.test.ts`

## Implementation Steps

1. Add admin config: `enableAdminRoutes`, `adminToken`, `adminStoreMode`, store path/prefix fields. Add startup guard: `adminToken` must NOT be in `gatewayKeys`.
2. Add early admin path detection BEFORE `applyCors()` in `app.ts`, then before public `classifyRequest()`/`requireAuth()`. Admin paths get same-origin-only CORS.
3. Add admin auth middleware separate from `GATEWAY_API_KEYS`; parse only `Authorization: Bearer <token>` and compare with constant-time equality using `crypto.timingSafeEqual`.
4. Implement redaction helpers and service-account JSON validation reuse.
5. Implement static-config and file-store adapters with Cloud Run mutation startup guard.
6. Implement file-store path sanitization, restrictive permissions, collision control, explicit replace, and project matching.
7. Add import/list/detail/patch/delete/test endpoints.
8. Add model catalog endpoints backed by Phase 1 `modelCatalog`.
9. Wire mutation endpoints to `GenAiRuntime.reload(...)` with rollback/old-snapshot preservation on failure.
10. Add tests for disabled admin, unauthorized admin, admin-token-equals-gateway-key startup rejection, redaction, invalid credential rejection, delete/disable behavior, collision control, path traversal rejection, Cloud Run file-store startup rejection, admin CORS isolation, and reload failure.
11. Add a small UI/contract safeguard note: mutation endpoints are single-user-only in MVP and the admin UI should prevent double-submit while a mutation is in flight.
<!-- Updated: Validation Session 3 — mutex removed and risk made explicit for single-user admin -->

## Success Criteria

- [ ] Admin routes are 404 or disabled when `GATEWAY_ENABLE_ADMIN_ROUTES=false`.
- [ ] `Authorization: Bearer <GATEWAY_ADMIN_TOKEN>` authorizes `/admin/api/*`.
- [ ] Missing Bearer, invalid Bearer, query tokens, cookies, `x-api-key`, `x-goog-api-key`, and ordinary gateway API keys do not authorize admin.
- [ ] Admin routes are not accidentally accepted by the public `requireAuth()` path or public wildcard CORS path.
- [ ] Admin auth failures return a generic 401 without credential existence hints.
- [ ] `GATEWAY_ADMIN_TOKEN` in `GATEWAY_API_KEYS` causes startup failure.
- [ ] Admin CORS: no `Access-Control-Allow-Origin` header on admin routes even when public CORS is configured.
- [ ] Unauthorized admin requests never reveal whether a credential ID exists.
- [ ] Import accepts valid Google service-account JSON and rejects OAuth installed/web client JSON.
- [ ] No endpoint returns `private_key`, `private_key_id`, raw credential blobs, token/auth URIs, or stack traces containing secret fields.
- [ ] Import rejects credential ID collisions unless explicit replace is requested.
- [ ] Import rejects service-account JSON whose `project_id` does not match target metadata.
- [ ] Every successful mutation either swaps a validated runtime snapshot or reports an error without changing live traffic.
- [ ] Cloud Run + file-store + mutations is rejected by startup config validation, not delayed until an admin route is called.
- [ ] File-store mode is explicit and test-covered.
- [ ] File-store rejects path traversal, absolute user paths, non-JSON uploads, and unsafe filenames.
- [ ] Docker/VPS docs show a persistent mounted volume and warn not to store credentials only inside the container layer.
- [ ] Docs and admin contract state explicitly that concurrent admin mutations are unsupported in MVP.

## Risk Assessment

Risk: admin delete/import can break production traffic.
Mitigation: separate admin token, disabled-by-default routes, explicit store mode, and tests proving disabled credentials are removed from selection.

Risk: file-store loses data if the Docker volume is not mounted.
Mitigation: require explicit `adminFileStoreDir`, document the host volume mount, and add a restart persistence smoke in Phase 6.

Risk: model admin writes unsupported fields.
Mitigation: model endpoints only read/write the Phase 1 `modelCatalog` schema.

Risk: concurrent admin mutations can race because MVP has no server-side serialization.
Mitigation: accept this risk explicitly for the single-user internal admin surface, document it, and prevent basic double-submit in the admin UI.
