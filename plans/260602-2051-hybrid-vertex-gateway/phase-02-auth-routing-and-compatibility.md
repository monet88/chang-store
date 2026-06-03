# Phase 02 — Auth, Routing, and Compatibility

## Context links
- Ixmoon route classifier: `.ref/Gemini-Vertex-Gateway/src/deno_index.ts:29-72`
- Ixmoon Gemini auth/stateful logic: `.ref/Gemini-Vertex-Gateway/src/auth.ts:18-20`, `.ref/Gemini-Vertex-Gateway/src/auth.ts:33-47`, `.ref/Gemini-Vertex-Gateway/src/auth.ts:86-143`
- Ixmoon Vertex + Gemini strategy split: `.ref/Gemini-Vertex-Gateway/src/strategies.ts:201-301`, `.ref/Gemini-Vertex-Gateway/src/strategies.ts:307-440`, `.ref/Gemini-Vertex-Gateway/src/strategies.ts:493-552`
- Current frontend proxy wiring: `src/contexts/ApiProviderContext.tsx:206-244`, `src/services/apiClient.ts:135-187`
- Current backend gateway guide documents the active Gemini-compatible and Vertex-compatible paths: `docs/api/vertex-gateway-api-guide.md`

## Overview
- Priority: P1
- Status: pending
- Brief: implement the shared gateway contract. Make the new backend look familiar to the current frontend first, while leaving room for long-term shared routing.

## Key insights
- Current app already knows how to speak Gemini-compatible paths through `@google/genai`; preserving that surface minimizes migration work.
- Ixmoon’s trigger-key model is useful, but its fallback/pool semantics must be tightened for production and Cloud Run observability.
- Vertex-compatible routes should exist from day one even if the SPA first consumes only Gemini-compatible/custom endpoints.

## Requirements
### Functional
- Support one gateway key model for browser/frontend callers.
- Support Google upstream auth via service account / ADC server-side only.
- Route families:
  - `/gemini/*` Gemini-compatible
  - `/vertex/*` Vertex-compatible
  - `/vtx/*` Gemini-shaped path rewritten to Vertex-compatible upstream
  - `/api/*` custom frontend-friendly endpoints
- Preserve stateful request routing rules for uploads/edit sessions where needed.
- Preserve current SDK compatibility by configuring the frontend base URL to the `/gemini` route prefix first; root aliases require explicit migration tests.

### Non-functional
- Structured 4xx/5xx responses with `requestId`, `error.code`, `error.message`, optional `retryable`.
- Retry only idempotent/stateless routes unless explicit allowlist.
- Route parser must be unit tested, not regex-by-guesswork.
- CORS is not authentication; gateway tokens need rotation, scope, and rate-limit hooks.

## Architecture
### Auth model
- Client auth to gateway: `Authorization: Bearer <gateway-key>` or `x-api-key`.
- Gateway keys are Chang Store gateway tokens, not Google API keys. Treat them as scoped app tokens: support constant-time comparison, key IDs or hashes where practical, rotation, and redacted logs.
- Gateway auth to Google:
  - Preferred short-term: service account credentials / workload identity on Cloud Run.
  - Optional later: per-project/project-pool routing if quotas require it.
- Reject raw end-user Google API keys in the long-term production path. Keep only behind a temporary debug/dev bypass if absolutely needed.

### Route policy
- Keep from Ixmoon:
  - distinct route families
  - strategy-per-family resolution
  - stateful detection concept
  - request shape compatibility
- Build from scratch:
  - normalized auth middleware
  - request classifier returning typed route metadata
  - explicit allowlist of pass-through query params/headers
  - structured error translation layer
  - no unprefixed `/v1*` or `/v1beta*` aliases unless Phase 4 proves saved frontend URLs need them and tests the alias behavior

### Recommended API surface
#### Health/readiness
- `GET /healthz`
- `GET /readyz`

#### Gemini-compatible shared gateway
- `GET /gemini/v1beta/models`
- `POST /gemini/v1beta/models/:model:generateContent`
- `POST /gemini/v1beta/models/:model:streamGenerateContent`
- `POST /gemini/v1beta/openai/chat/completions` is deferred until a real shared-gateway consumer exists.
- `POST /gemini/v1beta/openai/images/generations` stays out of the initial cut.

#### Vertex-compatible shared gateway
- `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:generateContent`
- `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:streamGenerateContent`
- `POST /vertex/v1/projects/:project/locations/:location/publishers/google/models/:model:predict`

#### Gemini-to-Vertex translation
- `POST /vtx/v1/models/:model:generateContent`
- `POST /vtx/v1/models/:model:predict`

### Data flow
1. Auth middleware extracts gateway key.
2. Request classifier resolves route family + model + operation + stateful flag.
3. Compatibility mapper converts inbound shape to canonical internal request DTO.
4. Upstream adapter creates Google Gen AI or Vertex call.
5. Response adapter maps back to compatibility format.

## Related code files
### Files to create/own
- `gateway/src/auth/gateway-auth.ts`
- `gateway/src/auth/google-auth.ts`
- `gateway/src/http/request-classifier.ts`
- `gateway/src/routes/gemini-compatible-routes.ts`
- `gateway/src/routes/vertex-compatible-routes.ts`
- `gateway/src/strategies/gemini-compatible-strategy.ts`
- `gateway/src/strategies/vertex-compatible-strategy.ts`
- `gateway/src/strategies/gemini-to-vertex-strategy.ts`
- `gateway/test/request-classifier.test.ts`
- `gateway/test/auth.test.ts`

### Existing app files touched later by migration
- `src/services/apiClient.ts`
- `src/contexts/ApiProviderContext.tsx`

## Implementation steps
1. Define gateway client auth contract and env-backed key validation.
2. Implement request classifier with typed outputs: family, operation, model, project, location, stateful, stream.
3. Build canonical DTO layer so custom `/api/*` and compatibility routes can share workload services.
4. Implement Gemini-compatible adapter first because current SPA already depends on that shape; add tests that `baseUrl = <gateway>/gemini` maps SDK calls to `/gemini/v1beta/...`.
5. Implement Vertex-compatible adapter second for long-term shared service use; align path shape with Google REST publisher model format.
6. Add structured error mapper for Google SDK errors, quota errors, timeout errors, auth errors.
7. Add tests proving root `/v1*` aliases are absent unless explicitly enabled by a route flag.

## Todo list
- [ ] Freeze gateway key contract
- [ ] Freeze route family inventory
- [ ] Add route-prefix compatibility tests
- [ ] Implement typed classifier
- [ ] Implement compatibility adapters
- [ ] Document stateful route allowlist/denylist
- [ ] Document OpenAI-compatible route deferrals
- [ ] Add auth and route tests

## Success criteria
- Current SPA can point its Gemini base URL at `/gemini` with no payload rewrite for existing image/text calls.
- Vertex-compatible routes exist and are integration-tested.
- Errors include request IDs and stable machine-readable codes.
- No route retries unsafe upload/edit requests unless explicitly allowed.
- Root `/v1*` aliases are either absent or covered by explicit migration tests and docs.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Over-broad passthrough leaks unsupported Google surface | High | High | Start with explicit route allowlist only |
| Trigger-key semantics hide auth bugs | Medium | High | Separate client-auth validation from upstream-auth acquisition |
| Stateful detection too narrow for future image edit flows | Medium | High | Central stateful policy table + integration tests |
| OpenAI-compat detour adds unused scope | Medium | Medium | Limit to chat/completions only if current clients need it |
| `/gemini` vs root `/v1beta` ambiguity breaks current SDK migration | Medium | High | Pin frontend base URL suffix and add route-prefix tests |
| Browser gateway key becomes a long-lived shared secret | Medium | High | Scoped keys, rotation, rate limits, redaction, and long-term server-managed auth |

## Security considerations
- Key comparison constant-time where practical.
- CORS only for approved origins; curl/no-origin allowed only on non-browser requests.
- Strip inbound auth headers before upstream call; inject server-side auth only.
- Never echo upstream credential details in errors.
- Add rate-limit hooks before public rollout; do not rely on CORS to protect gateway tokens.

## Backwards compatibility
- Short-term: preserve browser toggle shape by letting `baseUrl + gatewayKey` keep working.
- Long-term: deprecate per-user proxy URL overrides and replace with hosted service URL + single gateway-key field.

## Rollback plan
- Disable new route families independently behind env flags.
- Frontend can revert to current direct Gemini path by clearing gateway URL and using existing key path.

## Next steps
- Phase 03 builds workload services under this route/auth layer.
- Blockers: auth contract frozen, route list frozen, canonical DTOs approved.

## Unresolved questions
- None.
