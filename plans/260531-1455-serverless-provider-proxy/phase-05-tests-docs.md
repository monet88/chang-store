---
phase: 5
title: "Tests & Docs"
status: pending
priority: P2
effort: "1d"
dependencies: [4]
---

# Phase 5: Tests & Docs

## Overview

Backfill automated coverage for the new helpers, add an integration
test that runs the proxy against a stubbed upstream, and produce the
deployment + changelog updates so a fresh checkout can configure both
modes from docs alone.

## Requirements

### Functional

- Vitest unit tests for:
  - `getProviderClientConfig` (proxy / direct / unset).
  - `safeFetch` token attachment (token present, missing, refresh).
  - `verifyGoogleIdToken` (valid, missing, expired, wrong audience,
    malformed).
  - `takeRateLimitToken` (under, at, over) for both KV and in-memory
    paths.
  - `passthroughHeaders` (strips host/cookie/auth, keeps content-type).
- One integration test (Vitest + node fetch + a local mock upstream)
  that exercises the proxy handler end-to-end:
  - Anonymous request → 401.
  - Bad path → 404.
  - Valid path + identity + small JSON body → 200, body matches mock.
  - Valid path + identity + multipart body → 200, multipart boundary
    preserved on the upstream side.
  - Rate-limit overflow → 429 with `retry-after`.
- A short manual checklist documented in
  `docs/api/serverless-provider-proxy.md` for the production cutover:
  - Set `GROK_API_KEY` and `GPT_IMAGE_API_KEY` on Vercel (server scope).
  - Set `GOOGLE_OAUTH_CLIENT_ID` (server scope).
  - Set `VITE_PROVIDER_PROXY_URL` (client scope, for production deploys
    only).
  - Enable Vercel KV bindings (optional for rate limiting).

### Non-functional

- All tests run inside the existing `npm run test` invocation.
- No live network calls in unit tests; the integration test boots its
  own mock upstream on localhost.
- Existing 627+ tests still pass.

## Architecture

### Mock upstream

```ts
// __tests__/api/_lib/mockUpstream.ts
import { createServer } from 'node:http';

export function startMockUpstream(handler: (req, res) => void) {
  const server = createServer(handler);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>(r => server.close(() => r())) };
}
```

Integration tests boot the mock server, point `UPSTREAM[provider].host`
at it via env override, run `handler(req)` directly, and shut down after
each test.

### Documentation deliverables

- `docs/api/serverless-provider-proxy.md` (new)
  - Architecture overview (request flow diagram in mermaid)
  - Two operating modes table
  - Env var matrix (server vs client scope)
  - Local dev recipe (`vercel dev`, env file template)
  - Production cutover checklist
  - Troubleshooting (401 reasons, 429 backoff, 503 missing env)

- `docs/deployment-guide.md` (modify)
  - New section "Provider proxy (v2)" referencing the new doc
  - Mark the v1 client-bundled-key path as legacy with a sunset note

- `docs/CHANGELOG.md` (modify)
  - Security entry: "Moved provider bearer tokens off the client via
    `/api/proxy/<provider>` Vercel functions. Keys never reach the
    browser in hosted mode."
  - Removed entry: "Dropped `GROK_API_KEY` / `GPT_IMAGE_API_KEY` from
    the Vite `define` block. Configure server-side in Vercel settings."

- `PRODUCT.md` (modify)
  - Update the "Brand Personality" / "Anti-references" sections only if
    they change; otherwise leave alone.
  - Update `## Accessibility & Inclusion` if any new flow needs an
    a11y note (the sign-in CTA does — note that in this phase).

- `DESIGN.md` (modify)
  - Add a small section under "Components" describing the new
    "Hosted proxy active" affordance in the settings panel.

## Related Code Files

- Create: `__tests__/services/providers/shared/getProviderClientConfig.test.ts`
- Create: `__tests__/services/providers/shared/safeFetch.test.ts`
  (extend existing if present)
- Create: `__tests__/api/_lib/auth.test.ts`
- Create: `__tests__/api/_lib/rateLimit.test.ts`
- Create: `__tests__/api/_lib/forwardHeaders.test.ts`
- Create: `__tests__/api/proxy.integration.test.ts`
- Create: `docs/api/serverless-provider-proxy.md`
- Modify: `docs/deployment-guide.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `DESIGN.md`
- Optionally modify: `README.md` (link to the new doc)

## Implementation Steps

1. Add the unit tests for the new client helper, server auth helper,
   and rate-limit helper. Aim for one negative case per branch.
2. Build the mock-upstream helper and the integration test. Run it
   against the real handler with `process.env` patched.
3. Author `docs/api/serverless-provider-proxy.md`. Include the request
   flow diagram and the cutover checklist.
4. Update `docs/deployment-guide.md` and `docs/CHANGELOG.md`.
5. Add the proxy-mode section to `DESIGN.md` so the visual contract is
   captured for future polish passes.
6. Run the full quality gate: `npx tsc --noEmit`, `npm run lint`,
   `npm run test`, `npm run build`. Verify `dist/assets/*.js` does not
   contain any upstream API key string when proxy mode is configured.
7. After staging is green, propose flipping the production env var in
   a follow-up PR.

## Success Criteria

- [ ] `npm run test` reports the existing 627+ tests green plus the
      new ones added in this phase.
- [ ] Coverage for the new server helpers is at least 90% lines /
      branches.
- [ ] `docs/api/serverless-provider-proxy.md` exists and is linked from
      `docs/deployment-guide.md` and `README.md`.
- [ ] `docs/CHANGELOG.md` has a Security and a Removed entry under
      `[Unreleased]` describing the v2 cutover.
- [ ] A fresh checkout following the new docs can run `vercel dev` and
      hit the proxy with a Google sign-in within 10 minutes.

## Risk Assessment

- **Risk:** Integration test flakes on slower CI machines because the
  mock server takes time to bind a port. **Mitigation:** Use the
  `await listen` pattern so the test only proceeds after the bind
  resolves.
- **Risk:** Documentation drifts from the implementation when env vars
  rename. **Mitigation:** Make the env-var matrix table the single
  source of truth — link to it from the deployment guide instead of
  duplicating values.
- **Risk:** New tests require live Google OAuth which CI cannot
  perform. **Mitigation:** Tests mint a JWT in-process with a
  generated key pair and inject the JWKS, rather than calling Google.
