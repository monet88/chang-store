---
phase: 4
title: "Client Migration"
status: pending
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4: Client Migration

## Overview

Switch the client to the proxy at runtime when `VITE_PROVIDER_PROXY_URL`
is configured. Keep the bring-your-own-key path working for direct mode.
Hide the API key field in studio settings while in hosted mode and replace
it with a "Using hosted proxy" affordance.

## Requirements

### Functional

- `getProviderClientConfig(provider)` returns
  `{ baseUrl, apiKey, mode, getIdToken? }` based on this decision tree:
  1. If `VITE_PROVIDER_PROXY_URL` is set AND no per-provider override
     exists → mode `'proxy'`. `baseUrl` = the proxy URL +
     `/<provider>`. `apiKey` = `''` (not used). `getIdToken` returns
     the GoogleDriveContext id token.
  2. If a per-provider override exists in `ApiProviderContext` (the user
     entered their own key+URL) → mode `'direct'`. `baseUrl` = override
     URL. `apiKey` = override key. `getIdToken` undefined.
  3. Else if proxy URL not set AND no override → mode `'unset'`.
     Studios surface the existing "configure your API key" empty state.
- `safeFetch` accepts the optional `getIdToken` and attaches the
  `Authorization: Bearer <token>` header on every call when in proxy
  mode.
- Provider services (`grokImageService`, `gptImageService`) consume
  `getProviderClientConfig` instead of pulling raw `{ apiKey, baseUrl }`
  from the hook.
- `ProviderSettingsPanel` adapts to the mode:
  - `'proxy'`: read-only "Hosted proxy active" message + sign-in status.
    Optional "Use my own key" toggle that flips to direct mode (writes
    the override).
  - `'direct'`: the existing inputs.
  - `'unset'`: prompt the user to either sign in (if proxy URL is set
    but no token) or enter a key.

### Non-functional

- Mode resolution is a pure function — testable without the React tree.
- The studio hooks remain as the only file that reads
  `getProviderClientConfig`; components stay decoupled.

## Architecture

### Mode resolver

```ts
// src/services/providers/shared/getProviderClientConfig.ts
import type { ProviderId } from '../../../config/providerRegistry';

const PROXY_URL = import.meta.env.VITE_PROVIDER_PROXY_URL ?? '';

export type ProviderMode = 'proxy' | 'direct' | 'unset';

export interface ProviderClientConfig {
  mode: ProviderMode;
  baseUrl: string;
  apiKey: string;
  getIdToken?: () => Promise<string | null>;
}

export function getProviderClientConfig(
  provider: ProviderId,
  override: { apiKey: string; baseUrl: string } | null,
  getIdToken: () => Promise<string | null>,
): ProviderClientConfig {
  if (override?.apiKey || override?.baseUrl) {
    return { mode: 'direct', baseUrl: override.baseUrl, apiKey: override.apiKey };
  }
  if (PROXY_URL) {
    return {
      mode: 'proxy',
      baseUrl: `${PROXY_URL.replace(/\/+$/, '')}/${provider}`,
      apiKey: '',
      getIdToken,
    };
  }
  return { mode: 'unset', baseUrl: '', apiKey: '' };
}
```

### Service signature change

```ts
// before
export interface GrokServiceConfig { apiKey: string; baseUrl: string }

// after
export type GrokServiceConfig = ProviderClientConfig;
```

Services keep validating the URL and required fields. The
`assertConfig` in each service learns one extra branch:

```ts
if (config.mode === 'proxy' && !(await config.getIdToken?.())) {
  throw new ProviderApiError('error.provider.signInRequired', 401, 'sign_in_required');
}
if (config.mode === 'direct' && !config.apiKey) {
  throw new ProviderApiError('error.provider.missingApiKey', 401, 'missing_api_key');
}
```

### `safeFetch` extension

```ts
export async function safeFetch(
  input: RequestInfo,
  init?: RequestInit & { getIdToken?: () => Promise<string | null> },
): Promise<Response> {
  let headers = new Headers(init?.headers);
  if (init?.getIdToken) {
    const token = await init.getIdToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
```

The `Authorization` header in proxy mode now carries the **Google ID
token**, not the upstream key. The proxy server-side is the one that
substitutes the upstream key.

### Settings panel mode states

- Proxy mode: panel shows "Đang dùng proxy lưu trữ • Đã đăng nhập là
  user@example.com" and a small "Dùng key của tôi" link that flips the
  override.
- Direct mode: existing inputs, plus a "Quay lại proxy lưu trữ" link
  if the proxy URL is set.
- Unset mode: existing inputs, no proxy hint.

## Related Code Files

- Create: `src/services/providers/shared/getProviderClientConfig.ts`
- Modify: `src/services/providers/grok/grokImageService.ts`
- Modify: `src/services/providers/gpt-image/gptImageService.ts`
- Modify: `src/services/providers/shared/safeFetch.ts`
- Modify: `src/hooks/useGrokStudio.ts` (compose config from context)
- Modify: `src/hooks/useGptImageStudio.ts` (compose config from context)
- Modify: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
- Modify: `src/locales/en.ts`, `src/locales/vi.ts`
- Modify: `vite.config.ts` — drop `GROK_API_KEY` and
  `GPT_IMAGE_API_KEY` from the `define` block; add only
  `VITE_PROVIDER_PROXY_URL` to the env-var passthrough.
- Modify: `.env.example`

## Implementation Steps

1. Add `getProviderClientConfig.ts` with the resolver and unit tests.
2. Update `safeFetch` to accept and use `getIdToken`.
3. Refactor `grokImageService` and `gptImageService` to take a
   `ProviderClientConfig` and pass `getIdToken` into `safeFetch`.
4. Update the two studio hooks to compose the config from
   `ApiProviderContext` (override) + `GoogleDriveContext` (token) +
   the env var (proxy URL).
5. Replace the inline panel branches with the three-mode rendering.
   Add the locale keys.
6. Remove `GROK_API_KEY` / `GPT_IMAGE_API_KEY` and the matching `VITE_`
   variants from `vite.config.ts:define`. Verify they are gone from
   `dist/assets/*.js` after `npm run build`.
7. Manual smoke against staging: hosted mode through the proxy, direct
   mode against a localhost upstream, sign-out → sign-in → new request.

## Success Criteria

- [ ] `npm run build` produces no occurrence of an upstream API key in
      `dist/`.
- [ ] All 10 provider workflows still pass via the proxy with a signed-in
      user.
- [ ] The same workflows still pass in direct mode with a per-provider
      override.
- [ ] Signing out clears the studio CTA's enabled state in proxy mode
      (no token → button surfaces "Sign in to continue").
- [ ] Settings panel correctly reflects proxy / direct / unset.
- [ ] Existing tests pass; new resolver tests cover all three modes.

## Risk Assessment

- **Risk:** Studio mode flips while a request is in flight (user toggles
  override mid-call). **Mitigation:** AbortController already aborts on
  `activeFeature` change after the recent fix; extend the dependency
  list to also abort on mode change.
- **Risk:** ID token is null on first paint (token client still
  initializing). **Mitigation:** `getIdToken()` returns a promise that
  resolves once the client is ready; studios that already check
  `!isLoading` get this for free.
- **Risk:** Panel locale keys diverge between EN and VI. **Mitigation:**
  Mirror the VI block from EN immediately and run the existing
  `__tests__/locales/parity.test.ts` if present, or add one if not.
