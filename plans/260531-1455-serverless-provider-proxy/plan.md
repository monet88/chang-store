---
title: "Serverless Provider Proxy v2"
description: "Move Grok and GPT Image bearer tokens off the client by routing requests through Vercel serverless functions. Closes the v1 P0 finding (provider keys in client bundle + localStorage) without sacrificing the local-proxy developer workflow."
status: pending
priority: P1
branch: "feat/serverless-provider-proxy"
tags: [security, infra, providers, vercel]
blockedBy: []
blocks: []
created: "2026-05-31T07:55:51.583Z"
createdBy: "ck:plan"
source: skill
---

# Serverless Provider Proxy v2

## Overview

Today, Grok and GPT Image bearer tokens ship inside the client bundle (via
`vite.config.ts` `define`) **and** are stored in `localStorage` so the user can
override per-studio. This was accepted for v1 with a documented mitigation
(host allowlist + custom-domain warning + private-host-only HTTP). Cubic and
gemini-code-assist both flagged it as P0/P1, and the threat model is real:
shared keys cannot be revoked per user, XSS exfil is one bug away, and corp
network sniffers see every call.

v2 introduces a thin Vercel serverless proxy in front of every upstream
provider call. The browser sends a session-scoped credential to the proxy; the
proxy keeps the upstream API key in server-side env and forwards the request.
The client SPA pattern is preserved — no auth backend, no database — by
reusing the existing **Google Drive OAuth ID token** as the proxy's caller
identity.

## Goals

- **Provider API keys never reach the browser.** No `VITE_GROK_API_KEY` or
  `VITE_GPT_IMAGE_API_KEY` shipped in client JS, no token saved to
  `localStorage` by default.
- **Per-user identity.** Each request is associated with a verified Google
  identity; abuse can be rate-limited and audited per user.
- **Workflow unchanged.** Studios still call the same five workflows. The
  `imageEditingService.ts` boundary stays intact. Hooks/components don't see
  the proxy.
- **Local dev still works.** Developers without proxy credentials can still
  point at a local proxy or upstream API by entering a key in studio settings
  (existing per-provider settings flow). The bundle just no longer ships a
  default key.
- **One consistent contract.** Both providers (Grok, GPT Image) speak through
  the same `/api/proxy/<provider>/<path>` shape so any future provider plugs
  in identically.

## Non-Goals

- **Not a rewrite of provider services.** `grokImageService.ts` and
  `gptImageService.ts` only swap their base URL.
- **Not a custom auth system.** No JWT signing, no session DB, no password
  flow. Verify Google ID tokens against Google's JWKS and that's it.
- **Not a multi-region distributed proxy.** One Vercel project, one region;
  optional per-deploy region pinning later.
- **Not a model-level guardrail layer.** Proxy validates the path and quotas;
  it does not parse prompts.

## Validated Decisions

- **Vercel serverless functions** (Edge Runtime where streaming matters,
  Node runtime where the OpenAI SDK helpers help). Project already deploys to
  Vercel and `vercel.json` already exists.
- **Google ID token** as proxy identity. The app already runs Google Drive
  OAuth (`GoogleDriveContext`) — the same `id_token` is the cheapest source
  of "is this a real user?" without standing up a backend.
- **Path-based routing** (`/api/proxy/<provider>/<...path>`) over
  one-route-per-endpoint, so the proxy stays thin and adding a future
  provider is a single `providerRegistry` entry on the server side.
- **Pass-through streaming.** Forward request/response bodies as streams.
  Don't buffer the multipart `image[]` payload for GPT Image edits — that
  would defeat the 60–90 s upstream window and bust serverless memory
  limits.
- **Two operating modes** at runtime:
  1. **Hosted mode** (default in production): client posts to
     `/api/proxy/<provider>/...`; the server reads the upstream key from
     `GROK_API_KEY` / `GPT_IMAGE_API_KEY` env vars (no `VITE_` prefix).
  2. **Direct mode** (default in dev / self-hosted): client posts to the
     URL the user entered in studio settings, exactly like today, with the
     user-provided key. Toggled by `VITE_PROVIDER_PROXY_URL` being absent
     or empty.
  Mode is decided at runtime in `getProviderClientConfig()`, not via
  separate code paths.
- **Bring-your-own-key still works.** Any user can override the proxy and
  call upstream directly with their own key (existing settings panel).
  Proxy is the default, not the only path.
- **Hard rate limit: per-user-per-minute window** stored in Vercel KV (or an
  in-memory fallback for local dev). Exceeded requests return 429 with
  retry-after.
- **Allowlist of upstream paths.** Proxy only forwards
  `/v1/images/generations` and `/v1/images/edits` to known upstream hosts.
  Anything else is 404, so a leaked proxy origin can't be turned into a
  general-purpose OpenAI / xAI tunnel.

## Phases

| Phase | Name | Status | Purpose |
|-------|------|--------|---------|
| 1 | [Architecture](./phase-01-architecture.md) | Pending | Decide hosting layer (Vercel runtime, KV vs. in-mem rate limit, request shape) and produce the contract the rest of the plan implements against. |
| 2 | [Auth & Identity](./phase-02-auth-identity.md) | Pending | Verify Google ID tokens at the proxy edge, derive a stable user id, and surface the token from the existing GoogleDriveContext. |
| 3 | [Proxy Routes](./phase-03-proxy-routes.md) | Pending | Implement `api/proxy/<provider>/<...path>.ts` for Grok and GPT Image, with streaming forward, path allowlist, and per-user rate limits. |
| 4 | [Client Migration](./phase-04-client-migration.md) | Pending | Add `getProviderClientConfig()` so services pick proxy URL + ID token automatically when `VITE_PROVIDER_PROXY_URL` is set, while keeping the bring-your-own-key path. |
| 5 | [Tests & Docs](./phase-05-tests-docs.md) | Pending | Vitest coverage for the new helpers, integration tests against a stubbed proxy, deployment-guide updates, and a v2 entry in `docs/CHANGELOG.md`. |

## Dependencies

- **Builds on** `plans/260530-1351-three-provider-studios/`. That plan put
  the studios, services, registries, and `ApiProviderContext` in place; this
  plan is the v2 follow-up explicitly called out in its security note.
- **Vercel project + KV** already provisioned (the project deploys there
  today). KV is optional — fall back to in-memory rate limit if not present.
- **Google OAuth client ID** already in `GoogleDriveContext`. Same client id
  is reused; no new console project required.

## Primary Touchpoints

### Server (new)

- Create: `api/proxy/[provider]/[...path].ts` — Vercel serverless handler
- Create: `api/_lib/auth.ts` — Google ID token verification (JWKS cache)
- Create: `api/_lib/upstream.ts` — provider id → upstream host + API key env
- Create: `api/_lib/rateLimit.ts` — per-user sliding window via KV with
  in-memory fallback
- Create: `api/_lib/forwardHeaders.ts` — strip / rewrite headers between
  client and upstream

### Client (modified, not replaced)

- Modify: `src/services/providers/grok/grokImageService.ts` — use
  `getProviderClientConfig('grok')` instead of `{ apiKey, baseUrl }` from
  context
- Modify: `src/services/providers/gpt-image/gptImageService.ts` — same swap
- Modify: `src/services/providers/shared/safeFetch.ts` — attach
  `Authorization: Bearer <google-id-token>` when a proxy is in use
- Create: `src/services/providers/shared/getProviderClientConfig.ts` — the
  runtime mode chooser
- Modify: `src/contexts/GoogleDriveContext.tsx` — expose the active
  `id_token` and a refresh helper
- Modify: `src/contexts/ApiProviderContext.tsx` — note when a provider is
  in proxy mode (so the studio settings panel can hide the API key field
  or label it as "override-only")
- Modify: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
  — show "Using hosted proxy" affordance instead of asking for a key in
  hosted mode

### Config (modified)

- Modify: `vite.config.ts` — drop `GROK_API_KEY` / `GPT_IMAGE_API_KEY` from
  the `define` block; introduce `VITE_PROVIDER_PROXY_URL`
- Modify: `vercel.json` — add the function block (route, region pinning,
  duration)
- Modify: `.env.example` — document the new var split (server vs client)
- Modify: `docs/deployment-guide.md` — proxy-mode setup for hosted; direct
  mode for self-hosted
- Modify: `docs/CHANGELOG.md` — entry under Security

## Success Criteria

- [ ] No build artifact under `dist/` contains the strings `GROK_API_KEY`,
      `GPT_IMAGE_API_KEY`, or any production upstream key.
- [ ] Production hosted deployment serves all 10 provider workflows through
      the proxy without the user entering an API key.
- [ ] Self-hosted / dev deployment without `VITE_PROVIDER_PROXY_URL` still
      works exactly like today, including the local proxy at
      `http://localhost:8333`.
- [ ] Per-user rate limit returns 429 + retry-after when a single Google
      identity exceeds N requests per minute.
- [ ] Path allowlist returns 404 for any upstream path that is not in the
      `/v1/images/generations` or `/v1/images/edits` set.
- [ ] Streaming `/v1/images/edits` requests over multipart upload do not
      buffer the full request body in memory.
- [ ] Existing 627+ tests still pass.
- [ ] New tests cover: identity verification (valid, expired, wrong
      audience), path allowlist, rate limit boundary, mode switch
      (proxy vs direct).
- [ ] `vbsec` security scan or follow-up `/impeccable security` pass
      reports zero P0/P1 findings tied to provider key storage.

## Risks

- **Vercel function cold start on the 60–90 s GPT Image edit window.**
  Mitigate by pinning the function to a region close to OpenAI, sizing
  memory low (cold start cost is logarithmic in memory), and setting
  `maxDuration: 90` on the function. If OpenAI raises latency, revisit.
- **Google ID token expiry mid-session.** Mitigate by reading the existing
  refresh path in `GoogleDriveContext` and calling it from
  `getProviderClientConfig` when the cached token is within 60 s of expiry.
- **KV not provisioned in some environments.** Fall back to in-memory rate
  limit (per-instance), warn in logs that limits won't be enforced across
  warm instances.
- **CORS misconfig blocks the client.** Same-origin by deploying the proxy
  on the same Vercel project; explicit allowlist if cross-origin is ever
  needed.
- **Dev setup gets harder.** Mitigate by making proxy-mode opt-in
  (`VITE_PROVIDER_PROXY_URL` empty → direct mode = today's behavior). The
  README and deployment guide must walk through both modes.

## Rollout

1. Phase 1 lands plan, contract, and a runnable hello-world proxy stub.
2. Phase 2 wires identity. Once Phase 2 is green, the proxy refuses
   anonymous calls.
3. Phase 3 lands the real two routes behind a feature flag
   (`VITE_PROVIDER_PROXY_URL`). Hosted preview deployments get the flag.
4. Phase 4 makes the client read the flag and switch modes.
5. Phase 5 documents and tests. Once tests are green and the staging
   environment runs all 10 workflows, flip the production env var.
6. Remove `GROK_API_KEY` / `GPT_IMAGE_API_KEY` from
   `vite.config.ts:define` only after the production cutover is verified.

## Open Questions

- **Quota & billing.** When proxy keys are shared, one abusive user can
  spend the org's budget. Phase 1 needs to decide whether the v2 launch
  also ships a per-user monthly cap, or whether the per-minute rate limit
  is enough until usage signals say otherwise.
- **Anonymous fallback.** Should the proxy let users without a Google
  identity in (e.g. by accepting a small allowlist of static keys signed
  by the deployment), or is "Google ID token required" acceptable for
  hosted mode? Default position: required; revisit if the public demo
  needs it.
- **Worker vs Function.** Vercel Functions (Node) get more memory and the
  OpenAI SDK helpers; Workers (Edge) get faster cold starts. Phase 1
  benchmarks both for the 60–90 s edit case.
