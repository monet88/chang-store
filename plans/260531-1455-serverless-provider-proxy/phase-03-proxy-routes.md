---
phase: 3
title: "Proxy Routes"
status: pending
priority: P1
effort: "2d"
dependencies: [1, 2]
---

# Phase 3: Proxy Routes

## Overview

Replace the phase 1 stub with the real implementation. Verified identity
in (phase 2), upstream call out, response streamed back. Add per-user
rate limiting and a small audit log line per request. After this phase,
the proxy is production-shaped — only the client side hasn't switched
over yet.

## Requirements

### Functional

- For each verified request:
  1. Allowlist the joined upstream path; 404 otherwise.
  2. Increment the rate-limit counter for `identity.sub`; 429 if over.
  3. Attach `Authorization: Bearer <env_key>` server-side and forward.
  4. Stream request and response bodies in both directions.
  5. Log one line per request: `{ ts, sub, provider, path, status, ms }`.
- Rate limit window: 60 calls per minute per `sub` per provider, sliding
  window. Configurable via env (`PROXY_RATE_LIMIT_PER_MIN`).
- Upstream timeout per provider:
  - Grok: 60 s (default registry value).
  - GPT Image: 90 s.
- On upstream error:
  - 5xx from upstream → forward as 502 with the upstream error JSON.
  - 4xx from upstream → forward as-is (the client already knows how to
    parse OpenAI-style error envelopes).

### Non-functional

- Memory neutral on multipart uploads — body is piped, not buffered.
- Response body is streamed back as soon as the upstream returns
  headers; do not wait for the full response.
- All upstream credentials are read at function init, not per request,
  to keep the hot path tight.

## Architecture

### Handler skeleton

```ts
// api/proxy/[provider]/[...path].ts
import { requireIdentity } from '../../_lib/auth';
import { UPSTREAM } from '../../_lib/upstream';
import { allowOrThrow } from '../../_lib/upstream';
import { takeRateLimitToken } from '../../_lib/rateLimit';
import { passthroughHeaders } from '../../_lib/forwardHeaders';

export const config = { runtime: 'nodejs20.x', maxDuration: 90 };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const [, , provider, ...rest] = url.pathname.split('/'); // /api/proxy/<p>/<...>
  const upstream = UPSTREAM[provider as keyof typeof UPSTREAM];
  if (!upstream) return new Response('not found', { status: 404 });

  const path = `/${rest.join('/')}`;
  if (!upstream.allowlistPaths.includes(path)) {
    return new Response('not found', { status: 404 });
  }

  let identity;
  try {
    identity = await requireIdentity(req);
  } catch (e) {
    return e.toResponse();
  }

  const rl = await takeRateLimitToken(identity.sub, provider);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: { code: 'rate_limited', retry_after: rl.retryAfter } }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(rl.retryAfter) } },
    );
  }

  const upstreamUrl = `${upstream.host}${path}${url.search}`;
  const apiKey = process.env[upstream.apiKeyEnv];
  if (!apiKey) return new Response('upstream_not_configured', { status: 503 });

  const startedAt = Date.now();
  const upstreamRes = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      ...passthroughHeaders(req.headers),
      authorization: `Bearer ${apiKey}`,
    },
    body: req.body,
    duplex: 'half',
    signal: AbortSignal.timeout(upstream.timeoutMs),
  });

  audit({ sub: identity.sub, provider, path, status: upstreamRes.status, ms: Date.now() - startedAt });

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: passthroughHeaders(upstreamRes.headers),
  });
}
```

### Rate limit (KV-backed sliding window)

```ts
// api/_lib/rateLimit.ts
import { kv } from '@vercel/kv'; // optional; if absent, fall back

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.PROXY_RATE_LIMIT_PER_MIN ?? 60);

export async function takeRateLimitToken(sub: string, provider: string) {
  const key = `rl:${provider}:${sub}`;
  const now = Date.now();
  if (kv) {
    // ZADD now, ZREMRANGEBYSCORE -inf, now-WINDOW, ZCARD, EXPIRE WINDOW
    // ... pipeline
  } else {
    // in-memory map fallback (per-instance only)
  }
  return { ok: count <= LIMIT, retryAfter: 60 };
}
```

The KV path uses a sorted-set sliding window. The in-memory path uses a
trimmed array of timestamps per key. Phase 3 ships both; the choice is
made at init time based on whether `KV_REST_API_URL` env is set.

### Header forwarding

`passthroughHeaders` strips:
- `host`, `cookie`, `set-cookie` (avoid leaking proxy-side state)
- `authorization` from the client direction (replaced with upstream key)
- `vercel-*`, `x-forwarded-*`, `x-real-ip` (don't leak network topology
  back to upstream or client)

Forwards everything else verbatim, including `content-type` (multipart
boundary intact) and `accept-encoding`.

### Audit log

`console.log(JSON.stringify({ event: 'proxy', ts, sub, email, provider, path, status, ms }))`
— Vercel automatically aggregates structured logs and the team can later
ship them to a sink without touching application code.

## Related Code Files

- Modify: `api/proxy/[provider]/[...path].ts` (real implementation)
- Create: `api/_lib/rateLimit.ts`
- Create: `api/_lib/audit.ts` (single function wrapping the structured
  log line so future sinks plug in here)
- Modify: `api/_lib/upstream.ts` (add `allowOrThrow` helper)
- Modify: `vercel.json` (KV bindings)
- Modify: `.env.example`
  (`PROXY_RATE_LIMIT_PER_MIN`, `KV_REST_API_URL`,
  `KV_REST_API_TOKEN`)
- Modify: `package.json` (add `@vercel/kv`)

## Implementation Steps

1. Add `@vercel/kv` (optional dep) and refactor `api/proxy/...` to the
   handler skeleton above.
2. Implement `api/_lib/rateLimit.ts` with the KV path using a Redis
   sorted-set (sliding window via `ZADD` + `ZREMRANGEBYSCORE` + `ZCARD`)
   and an in-memory fallback.
3. Implement `passthroughHeaders` and the audit function.
4. End-to-end smoke against the local dev tunnel: with a valid Google
   ID token, hit the proxy with both providers, both endpoints, both
   bodies (JSON + multipart). Confirm:
   - Streaming works for the multipart edit (verify with a 5+ MB image).
   - Rate limit kicks in at 61 calls / min (set `PROXY_RATE_LIMIT_PER_MIN`
     low for the test).
5. Verify the structured log appears in Vercel logs with the expected
   keys.

## Success Criteria

- [ ] All 10 provider workflows return 200 OK from the proxy when called
      with a valid ID token.
- [ ] 401 / 404 / 429 / 502 / 503 are emitted on the matching failure
      cases.
- [ ] Multipart edits stream both ways without `RangeError: out of
      memory` warnings on a 4 MB upload.
- [ ] Rate-limit counter resets after the window.
- [ ] Audit log line shows up in Vercel logs with `sub` (truncated for
      privacy if required) for every request.
- [ ] No upstream API key appears in any client-side code or response
      payload.

## Risk Assessment

- **Risk:** `AbortSignal.timeout(95s)` may not be honored on Hobby tier
  if the function itself is killed at 60 s. **Mitigation:** Document the
  Pro-tier requirement in `docs/deployment-guide.md`; document the
  60 s ceiling for self-hosters who can't bump the limit.
- **Risk:** KV pipeline ordering races. **Mitigation:** Use `MULTI/EXEC`
  on `@vercel/kv`'s native pipeline API; tests cover the bursty case.
- **Risk:** `duplex: 'half'` rejects `body: ReadableStream` in some
  Node 20 minor releases. **Mitigation:** Pin a minor known to work in
  CI; test with the largest expected payload.
- **Risk:** Audit log leaks emails to third parties if Vercel logs are
  shipped to a vendor. **Mitigation:** Default the audit field to `sub`
  only; emit `email` only when `PROXY_AUDIT_EMAIL=1` is set.
