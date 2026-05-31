---
phase: 1
title: "Architecture"
status: pending
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Architecture

## Overview

Lock the runtime contract before writing any handler. Output of this phase
is one decision document and one runnable hello-world proxy stub that every
later phase can refine. No client wiring, no real upstream call — just the
shape.

## Requirements

### Functional

- Single serverless route at `/api/proxy/[provider]/[...path]` that:
  - Validates `provider` is one of `grok` / `gptImage`.
  - Validates the upstream path is in the allowlist.
  - Returns 404 immediately when either check fails.
  - Streams the request body to the upstream and the upstream response
    back to the client.
- A working "hello-world" handler that does the validation but echoes a
  fixed JSON body instead of contacting upstream. Lets phase 2 + 3 plug
  in incrementally without breaking dev.
- A decision doc captured under `docs/api/serverless-provider-proxy.md`
  that names the chosen runtime (Edge vs Node), the streaming approach,
  the timeout, and the rate-limit storage choice (KV vs memory).

### Non-functional

- Cold-start budget: < 500 ms p95 for the proxy itself (excluding the
  upstream round-trip).
- Memory budget: < 256 MB for the Edge variant (Workers limit).
- The route must accept multipart streaming uploads (GPT Image edits) and
  JSON bodies (Grok edits / both providers' generations).
- All env vars used by the route are server-only — they must not appear
  in `vite.config.ts:define` and must not be `VITE_`-prefixed.

## Architecture

### Request shape

```text
POST /api/proxy/grok/v1/images/edits
Authorization: Bearer <google-id-token>
Content-Type: multipart/form-data | application/json

→ proxy verifies token (phase 2), checks path allowlist, attaches
  Authorization: Bearer <GROK_API_KEY> (server env), forwards to
  https://api.x.ai/v1/images/edits and pipes the response back.
```

### Provider registry (server-side)

```ts
// api/_lib/upstream.ts
export const UPSTREAM = {
  grok: {
    host: 'https://api.x.ai',
    apiKeyEnv: 'GROK_API_KEY',
    allowlistPaths: ['/v1/images/generations', '/v1/images/edits'],
    timeoutMs: 60_000,
  },
  gptImage: {
    host: 'https://api.openai.com',
    apiKeyEnv: 'GPT_IMAGE_API_KEY',
    allowlistPaths: ['/v1/images/generations', '/v1/images/edits'],
    timeoutMs: 95_000,
  },
} as const;
```

### Vercel runtime decision

- **Default to Node.js runtime** for the v2 launch, because the GPT Image
  edit pipeline can run up to 90 seconds and Edge functions on Vercel cap
  out earlier on Hobby and have memory limits that are tight for the
  multipart pipe.
- **Revisit after the launch.** If cold starts hurt and the 90 s edit
  window is comfortably below Edge limits at the time, port to Edge.
- Function config sits in `vercel.json`:

```json
{
  "functions": {
    "api/proxy/[provider]/[...path].ts": {
      "runtime": "nodejs20.x",
      "memory": 256,
      "maxDuration": 90
    }
  }
}
```

### Streaming model

Use Web Streams (`Request.body`, `fetch(..., { duplex: 'half' })`) so the
proxy never buffers either side. The Node 18+ `fetch` implementation
supports request-side streaming with the `duplex: 'half'` flag. For
multipart payloads larger than the function's body buffer, this is the
only option that keeps memory flat.

### Rate limit storage

- **Default:** Vercel KV (Redis under the hood) with a sliding-window
  counter keyed on the verified Google `sub` claim.
- **Fallback:** in-memory `Map` with a 60 s expiry. Per-instance only,
  not safe across warm instances, but acceptable for solo dev and small
  self-hosted deployments. Phase 3 wires this in.

## Related Code Files

- Create: `api/proxy/[provider]/[...path].ts` (hello-world stub)
- Create: `api/_lib/upstream.ts`
- Create: `api/_lib/forwardHeaders.ts`
- Create: `docs/api/serverless-provider-proxy.md`
- Modify: `vercel.json`
- Modify: `package.json` (add `@vercel/node` as a dev dep if not already
  pulled in transitively)
- Modify: `.env.example`

## Implementation Steps

1. Add a Node Vercel function at `api/proxy/[provider]/[...path].ts` that:
   - Reads `provider` and `path` from the route params.
   - Looks up the provider in `UPSTREAM`.
   - 404s when provider is unknown or the joined path is not in the
     allowlist.
   - Returns `{ ok: true, provider, path }` (no upstream call).
2. Add `api/_lib/upstream.ts` with the registry and a helper to build the
   upstream URL from `(provider, path, search)`.
3. Add `api/_lib/forwardHeaders.ts` that:
   - Strips `host`, `cookie`, `set-cookie`, `vercel-*`, `x-forwarded-*`.
   - Drops the client `Authorization` header (replaced server-side with
     the upstream key in phase 3).
   - Forwards `content-type`, `accept`, `accept-encoding`,
     `content-length`.
4. Wire `vercel.json` `functions` block. Confirm with `vercel build` that
   the function compiles.
5. Add `docs/api/serverless-provider-proxy.md` capturing the request
   shape, env vars, runtime choice, allowlist, and rate-limit defaults.
6. Add `.env.example` entries for the server-only `GROK_API_KEY` /
   `GPT_IMAGE_API_KEY` (no `VITE_` prefix) plus the optional
   `VITE_PROVIDER_PROXY_URL` for the client.

## Success Criteria

- [ ] `npx vercel dev` can boot the function locally.
- [ ] `curl -X POST http://localhost:3000/api/proxy/grok/v1/images/generations`
      returns `{"ok":true,...}` (stub).
- [ ] `curl -X POST http://localhost:3000/api/proxy/grok/v1/chat/completions`
      returns 404.
- [ ] `curl -X POST http://localhost:3000/api/proxy/unknown/v1/images/generations`
      returns 404.
- [ ] `npm run build` still succeeds (no client changes break).
- [ ] No `VITE_GROK_*` / `VITE_GPT_IMAGE_*` keys appear in
      `dist/assets/*.js`.

## Risk Assessment

- **Risk:** Vercel Hobby free tier may not support `maxDuration: 90`.
  **Mitigation:** Document the requirement in the deployment guide and
  default `maxDuration` to the highest the active plan supports; the
  client already shows the "60–90 s" warning.
- **Risk:** `duplex: 'half'` not available in older Node runtimes.
  **Mitigation:** Pin `nodejs20.x`; the feature is GA there.
- **Risk:** Path allowlist regex/equality drift causes false 404s on a
  legitimate path with a query string. **Mitigation:** Compare the
  pathname only (`new URL(req.url).pathname`), not the full URL, and
  carry the search string through in the upstream URL builder.
