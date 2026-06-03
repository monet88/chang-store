---
phase: 1
title: "Proxy Client Wiring"
status: completed
priority: P2
effort: "2h"
dependencies: []
---

# Phase 1: Proxy Client Wiring

## Context links

- `src/services/apiClient.ts:1-37`
- `implementation_plan.md:11-25`

## Overview

Teach the existing Gemini SDK singleton to switch between direct Gemini and cliproxy by adding base URL state and `apiVersion: 'v1beta'`.

## Requirements

- Functional:
  - Add `setGeminiBaseUrl(url: string | null)` for compatibility with the settings checklist.
  - Add an atomic client configuration path so API key + base URL cannot be observed half-updated.
  - Reset `geminiClientInstance` when API key or base URL changes.
  - Instantiate `GoogleGenAI` with `apiVersion: 'v1beta'`.
  - Pass proxy URL through `httpOptions.baseUrl`, not top-level `baseURL`.
  - In proxy mode, require the proxy API key and never fallback to `process.env.GEMINI_API_KEY`.
  - Add `getDirectGeminiClient()` for features that must never route through cliproxy, especially Video/Veo long-polling flows.
- Non-functional:
  - Keep existing direct Gemini fallback behavior when proxy is disabled.
  - Do not introduce account JSON, server auth, or new backend code.
  - Keep API client small and testable.

## Architecture

Current singleton:

```ts
new GoogleGenAI({ apiKey: activeKey })
```

Target singleton:

```ts
new GoogleGenAI({
  apiKey: activeKey,
  apiVersion: 'v1beta',
  ...(customBaseUrl && {
    httpOptions: { baseUrl: customBaseUrl },
  }),
})
```

`customBaseUrl === null` means direct Google Gemini path. Proxy mode must use a non-empty proxy API key; it must not fall back to the direct Gemini environment key.

Preferred atomic configuration shape:

```ts
configureGeminiClient({
  apiKey: proxyEnabled ? vertexProxyApiKey : googleApiKey,
  baseUrl: proxyEnabled ? normalizedProxyUrl : null,
  requireExplicitApiKey: proxyEnabled,
})
```

Keep `setGeminiBaseUrl()` as the small compatibility setter if the existing checklist requires it, but tests must prove no client is created with proxy URL + direct key or direct URL + proxy key.

## Related Code Files

- Modify: `src/services/apiClient.ts`
- Modify: `__tests__/services/apiClient.test.ts`

## Implementation Steps

1. Run GitNexus impact for `getGeminiClient`, `setGeminiApiKey`, and `getActiveApiKey` before editing.
2. Add module-level `customBaseUrl: string | null`.
3. Add exported `setGeminiBaseUrl(url: string | null): void`.
4. Add or equivalent atomic `configureGeminiClient()` so key/base URL updates happen together.
5. Reset singleton whenever key/base URL changes.
6. Add `apiVersion: 'v1beta'` to SDK construction.
7. Add `httpOptions.baseUrl` only when normalized `customBaseUrl` is non-null.
8. In proxy mode, reject empty proxy key and do not use `process.env.GEMINI_API_KEY` as fallback.
9. Add `getDirectGeminiClient()` that always constructs a direct Google Gemini client with no `httpOptions.baseUrl`.
10. Update `src/services/gemini/video.ts` to use `getDirectGeminiClient()` because Veo/long-polling is not supported by cliproxy.
11. Preserve existing `getActiveApiKey()` precedence for direct mode only.

## TDD Structure

### RED

- Add failing test: `setGeminiBaseUrl('https://cliproxy.monet.uno')` creates client with `httpOptions.baseUrl`.
- Add failing test: `setGeminiBaseUrl(null)` removes proxy config.
- Add failing test: changing base URL resets singleton.
- Add failing test: SDK construction includes `apiVersion: 'v1beta'`.
- Add failing test: proxy enabled + empty proxy key throws proxy-specific missing-key error and never uses `process.env.GEMINI_API_KEY`.
- Add failing test: enable then disable proxy restores direct key/null and does not reuse `vertexProxyApiKey`.
- Add failing test: no client can be constructed with mixed proxy URL + direct key or direct URL + proxy key.
- Add failing test: `getDirectGeminiClient()` never includes `httpOptions.baseUrl` even when proxy is enabled.
- Add failing test or import-boundary assertion: `src/services/gemini/video.ts` uses `getDirectGeminiClient()`, not `getGeminiClient()`.

### GREEN

- Implement `customBaseUrl`, setter, and constructor options.

### REFACTOR

- Keep constructor option assembly in a small helper only if tests become noisy.

## Success Criteria

- [ ] Direct path still works with `GEMINI_API_KEY` or custom key.
- [ ] Proxy path uses `httpOptions.baseUrl`.
- [ ] Proxy mode requires explicit proxy API key and never falls back to direct Gemini env key.
- [ ] Enable/disable transitions cannot leave a stale proxy key active on direct Gemini.
- [ ] No account JSON or server-only concept appears in `apiClient.ts`.
- [ ] `__tests__/services/apiClient.test.ts` covers direct/proxy reset and mixed-state prevention behavior.

## Risk Assessment

- SDK option mismatch: use `httpOptions.baseUrl`, verified from earlier SDK inspection/tests.
- Singleton stale/mixed config: prefer atomic client configuration, reset on every key/base URL change, and test proxy/direct transitions.
- Proxy key leakage through direct fallback: proxy mode must require explicit proxy key and never reuse direct env key.

## Open Questions

None.
