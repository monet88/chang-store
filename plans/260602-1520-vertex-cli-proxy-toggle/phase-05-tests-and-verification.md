---
phase: 5
title: "Tests and Verification"
status: completed
priority: P2
effort: "2h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Tests and Verification

## Context links

- `README.md:90-99`
- `__tests__/services/apiClient.test.ts`
- `__tests__/contexts/ApiProviderContext.test.tsx`
- `__tests__/hooks/useSettingsModal.test.tsx`
- `__tests__/components/SettingsModal.test.tsx`
- `__tests__/services/gemini/image.test.ts`
- `__tests__/locales/key-parity.test.ts`

## Overview

Validate direct and proxy paths, settings persistence, locale parity, and production build safety.

## Requirements

- Functional:
  - Unit tests cover API client base URL wiring.
  - Unit/integration tests cover proxy settings state and modal behavior.
  - Service tests cover proxy `generateContent()` image generation.
  - Tests verify no Gemini 2 text generation default/helper remains if text service touched.
  - Tests verify `gemini-3.5-flash` requests omit unsupported `thinkingConfig`.
  - Tests verify textService description facades pass selected model through.
  - Tests update existing hardcoded model assertions in `__tests__/App.test.tsx`, `__tests__/components/SettingsModal.test.tsx`, `__tests__/contexts/ApiProviderContext.test.tsx`, and `__tests__/hooks/useModelSelection.test.ts`.
  - Tests verify video/Veo services use direct Gemini client and are not routed through proxy.
  - Tests verify text default uses `gemini-3.5-flash`.
  - Tests verify Pro text model uses exact `gemini-3.1-pro`, not invalid `gemini-3.1-pro-preview`.
  - Tests verify image model IDs include `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`, not invalid `gemini-3.1-flash-image`.
- Non-functional:
  - No fake data or temporary hacks just to pass tests.
  - No API key printed in test output.
  - Full quality gates pass before implementation is considered complete.

## Test Plan

### Unit / integration suites

- `__tests__/services/apiClient.test.ts`
  - `setGeminiBaseUrl()` setter
  - singleton reset
  - `apiVersion: 'v1beta'`
  - `httpOptions.baseUrl`
  - proxy mode requires explicit proxy key and never falls back to env Gemini key
  - `getDirectGeminiClient()` ignores proxy base URL
- `__tests__/contexts/ApiProviderContext.test.tsx`
  - proxy state persistence
  - grouped `vertexProxySettings` atomic updates
  - startup/mount sync from persisted proxy settings to SDK runtime config
  - setter wiring to API client
  - invalid restored URL fails closed
- `__tests__/hooks/useSettingsModal.test.tsx`
  - draft sync on open
  - save commits proxy settings
- `__tests__/components/SettingsModal.test.tsx`
  - toggle/input render
  - labels/help text visible
- `__tests__/services/gemini/image.test.ts`
  - proxy enabled uses `generateContent()`
  - direct path uses `generateImages()`
  - inlineData parser
  - prompt feedback/candidate finishReason safety blocks map to `error.api.safetyBlock`
  - proxy request timeout does not hang loading forever
  - no-image/text-only errors
  - `RESOURCE_EXHAUSTED`/`429` on non-Fast proxy model retries once with `imagen-4.0-fast-generate-001`
  - already-Fast quota error does not retry Fast again
  - auth/validation/safety/no-image/parser errors do not fallback
  - fallback only in proxy path; direct path unchanged
- `__tests__/services/gemini/text.test.ts`
  - text default uses `gemini-3.5-flash`
  - Pro text model uses exact `gemini-3.1-pro`
  - migrated helper/default functions use `gemini-3.5-flash` unless caller override exists
  - invalid model literals `gemini-3.1-pro-preview` and `gemini-3-flash` are absent
  - `gemini-3.5-flash` calls omit unsupported `thinkingConfig`
  - image/clothing/pose description facades pass selected model through to Gemini helpers
- `__tests__/services/gemini/video.test.ts` or equivalent
  - video/Veo flows use `getDirectGeminiClient()` even when proxy is enabled
- `__tests__/locales/key-parity.test.ts`
  - new en/vi keys match
- Security/negative settings tests
  - invalid URL blocks save or disables proxy with generic validation text
  - empty key + enabled blocks save or disables proxy
  - toggling proxy off clears active SDK proxy wiring and avoids stale proxy key
  - no toast/alert/error/log includes the key value
  - DOM assertions confirm labels/help text never mirror entered key
  - backup/export excludes or redacts proxy key; clear-data removes proxy storage keys

### Commands

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

### Manual smoke

1. Open Settings.
2. Enable Vertex Proxy.
3. Set URL to `https://cliproxy.monet.uno`.
4. Enter proxy API key.
5. Generate text with Gemini 3 text model.
6. Edit/upscale image with Gemini image model.
7. Generate image from text using `imagen-4.0-fast-generate-001`.
8. Disable proxy and verify direct Gemini path is restored.
9. Reload page and verify proxy config persistence.
10. Try invalid proxy URLs and empty key; verify proxy does not enable and no key appears in UI/errors.
11. Disable proxy after successful enable; verify direct Gemini path no longer uses proxy URL/key.

## Related Code Files

- Modify tests listed above.
- No production files owned by this phase unless fixing validation failures from earlier phases.

## Implementation Steps

1. Run focused tests after each phase.
2. Run full quality gates after all phases.
3. If manual smoke uses real proxy key, never print it or store it in code.
4. Run GitNexus `detect_changes()` before any commit to confirm affected flows are expected.

## TDD Structure

### RED

- Each phase starts with its failing tests.

### GREEN

- Implement minimal code to pass the targeted suite.

### REFACTOR

- Simplify duplicated test fixtures and keep mocks behavior-focused.

## Success Criteria

- [ ] All focused tests pass.
- [ ] Full `npm run test` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Manual proxy smoke passes or skipped with reason if proxy key/environment unavailable.
- [ ] Negative security cases pass: invalid URL, empty key, stale localStorage, toggle-off, and key non-disclosure.

## Risk Assessment

- Tests may mock SDK too tightly; assert behavior/request shape, not SDK internals beyond necessary constructor options.
- Manual smoke depends on live cliproxy quota; failures must distinguish app bug vs quota/error response.

## Open Questions

None.
