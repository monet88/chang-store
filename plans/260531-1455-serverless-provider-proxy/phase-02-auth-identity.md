---
phase: 2
title: "Auth & Identity"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Auth & Identity

## Overview

Make the proxy refuse anonymous calls. Verify Google ID tokens against
Google's published JWKS, derive a stable user identifier from the verified
claims, and surface that identity to the rate limiter and any future audit
log. Also expose the active ID token from the existing
`GoogleDriveContext` so the client can attach it to the proxy request.

## Requirements

### Functional

- Reject any request to `/api/proxy/...` without a valid
  `Authorization: Bearer <google-id-token>` header.
- Verify the bearer JWT against Google's JWKS endpoint
  (`https://www.googleapis.com/oauth2/v3/certs`):
  - Signature valid for one of the published keys.
  - `iss` claim is `https://accounts.google.com` or `accounts.google.com`.
  - `aud` claim equals the configured Google OAuth client id.
  - `exp` claim is in the future (with 30 s skew tolerance).
- Cache the JWKS for `kid` lookups (5 min TTL) so the proxy is not hammered
  by per-call key fetches.
- Attach the resolved `{ sub, email }` to the request object so phase 3
  can rate-limit and log.
- Expose the active `id_token` from `GoogleDriveContext` to the client
  services so they can attach it on every proxy call.
- Refresh the `id_token` automatically when it is within 60 s of expiry.

### Non-functional

- JWKS verification must be done with a maintained library (jose,
  google-auth-library) — no hand-rolled JWS verification.
- The verifier must run in the Vercel Node runtime; no native deps.
- A failed verification must respond with `401` and a JSON body that does
  not echo the raw token back.

## Architecture

### Server: `api/_lib/auth.ts`

```ts
import * as jose from 'jose';

const JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
  { cooldownDuration: 30_000, cacheMaxAge: 5 * 60_000 },
);

export interface VerifiedIdentity {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

export async function verifyGoogleIdToken(token: string): Promise<VerifiedIdentity> {
  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clockTolerance: 30,
  });
  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: payload.email_verified === true,
  };
}

export async function requireIdentity(req: Request): Promise<VerifiedIdentity> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    throw new HttpError(401, 'missing_authorization');
  }
  return verifyGoogleIdToken(auth.slice('Bearer '.length).trim());
}
```

### Client: surface the ID token

`GoogleDriveContext` already runs `google.accounts.oauth2.initTokenClient`
for the access-token grant, but the proxy needs the **ID token**, not the
access token. The cleanest path is:

1. Use `google.accounts.id.initialize` (the GIS one-tap library, already
   loaded by the existing flow) to obtain an `id_token` JWT.
2. Store it next to the existing access token; refresh on a parallel timer.
3. Expose `getIdToken(): Promise<string | null>` from `GoogleDriveContext`.

If keeping a single OAuth flow is simpler, swap the existing grant from
`token` (access token only) to `code` (which can return an id_token in the
authorization response) — but only do that if the migration cost is
contained. Phase 1 prototypes both and picks the cheapest path.

### Hosted vs direct mode

- **Hosted mode** (proxy URL set): `getProviderClientConfig()` calls
  `getIdToken()` on every request. If null, surface a clear error
  (`error.provider.signInRequired` locale key).
- **Direct mode** (no proxy URL): `getIdToken()` is never called. Studio
  settings panel still asks for a key as today.

### Rate limit lookup key

Phase 3 will use `identity.sub` as the rate-limit bucket key. `email` is
forwarded for audit logs only — never used for authorization decisions.

## Related Code Files

- Create: `api/_lib/auth.ts`
- Create: `api/_lib/httpError.ts` (typed error → `Response`)
- Modify: `api/proxy/[provider]/[...path].ts` (call `requireIdentity`)
- Modify: `src/contexts/GoogleDriveContext.tsx` (expose `getIdToken`)
- Modify: `src/services/providers/shared/safeFetch.ts` (attach token when
  in hosted mode)
- Modify: `src/locales/en.ts`, `src/locales/vi.ts`
  (`error.provider.signInRequired`)
- Modify: `package.json` (add `jose` dep)

## Implementation Steps

1. Add `jose` to dependencies.
2. Implement `api/_lib/auth.ts` with `verifyGoogleIdToken` and
   `requireIdentity`. Cover: missing header, malformed JWT, expired
   token, wrong audience, valid token.
3. Add `api/_lib/httpError.ts` for typed `HttpError(status, code)`
   rendering to `{ error: { code, message? } }` JSON.
4. Wire `requireIdentity` into the proxy stub from phase 1 — call it
   first, return the identity object as part of the stub response so
   phase 3 can read it.
5. In `GoogleDriveContext`, add the GIS one-tap initialization (or the
   `code`-flow swap) and expose `getIdToken` returning the latest valid
   token.
6. In `safeFetch`, accept an optional `getIdToken` callable. When the
   request URL points at the proxy origin, call it and attach
   `Authorization: Bearer <token>`.
7. Add the new locale keys (EN + VI).
8. Vitest: tests for `verifyGoogleIdToken` against fixture tokens (use
   `jose` to mint a signed JWT in-test against a generated key pair, then
   monkey-patch the JWKS resolver) and for `requireIdentity` rejecting
   missing / malformed / wrong-aud / expired tokens.

## Success Criteria

- [ ] `curl -X POST .../api/proxy/grok/v1/images/generations` without an
      `Authorization` header returns 401 `{ error: { code:
      "missing_authorization" } }`.
- [ ] A request with a token signed by an unrelated key returns 401.
- [ ] A request with a token whose `aud` is not the configured client id
      returns 401.
- [ ] A request with a valid Google ID token reaches the stub and the
      stub echoes back `{ identity: { sub, email } }`.
- [ ] Client services attach the ID token automatically when proxy mode
      is active and never include it in direct mode.
- [ ] Vitest covers all five identity branches (valid, missing,
      malformed, wrong aud, expired).

## Risk Assessment

- **Risk:** GIS one-tap requires extra UI prompts; existing access-token
  flow already surfaces the consent dialog. **Mitigation:** Prefer the
  `code`-grant swap if it returns the id_token cleanly; fall back to the
  one-tap path only if the token-client API doesn't expose it.
- **Risk:** Token refresh races with in-flight requests. **Mitigation:**
  `getIdToken` returns a single in-flight promise per refresh; callers
  await it before each call. Already a pattern in the existing access
  token refresh.
- **Risk:** Self-hosted deployments may not have a Google OAuth client.
  **Mitigation:** Document that proxy-mode requires `GOOGLE_OAUTH_CLIENT_ID`
  on the server and Google sign-in on the client; direct mode covers the
  no-Google path.
