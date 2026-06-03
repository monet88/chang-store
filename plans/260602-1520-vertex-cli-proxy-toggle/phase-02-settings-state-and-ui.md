---
phase: 2
title: "Settings State and UI"
status: completed
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 2: Settings State and UI

## Context links

- `src/contexts/ApiProviderContext.tsx:13-28`
- `src/contexts/ApiProviderContext.tsx:47-179`
- `src/hooks/useSettingsModal.ts:22-43`
- `src/hooks/useSettingsModal.ts:59-150`
- `src/components/modals/SettingsModal.tsx:50-75`
- `src/components/modals/SettingsModal.tsx:109-143`
- `implementation_plan.md:27-68`

## Overview

Add persisted proxy settings to `ApiProviderContext`, draft/save behavior to `useSettingsModal`, and a SettingsModal section for enabling cliproxy.

## Requirements

- Functional:
  - Add one grouped `vertexProxySettings` state object: `{ enabled, url, apiKey }`.
  - Persist proxy enabled/url/API key in localStorage.
  - Default proxy URL: `https://cliproxy.monet.uno`.
  - On app startup/mount, sync rehydrated `vertexProxySettings` into `apiClient.ts`; UI state and SDK runtime state must never diverge after reload.
  - When enabled, atomically configure Gemini client with `vertexProxySettings.url` + `vertexProxySettings.apiKey`.
  - When disabled, atomically clear proxy base URL and restore current Gemini key behavior.
  - Add Settings UI toggle + URL/API key inputs.
  - Add i18n keys in `en.ts` and `vi.ts`.
  - Fail closed: proxy cannot enable/save with invalid URL or empty proxy API key.
- Non-functional:
  - UI copy must say this is a proxy API key, not Google account JSON.
  - No service calls from component; all state logic stays in context/hook.
  - Validate URL with existing `validateProviderBaseUrl` before saving or restoring settings: allow HTTPS; allow HTTP only for local/private developer hosts per the utility; reject invalid/public HTTP.
  - Proxy API key input is masked by default and never appears in toasts, errors, logs, debug output, diagnostics, or backup/export payloads.
  - Show a Settings notice/tooltip that proxy API keys are stored in browser localStorage as plaintext for SPA/provider-studio parity, and should not be used on public/shared devices.
  - Show a prominent yellow warning text below the API key field advising against usage on public/shared devices. <!-- Updated: Validation Session 1 - UI warning notice -->
  - If rehydrated proxy config is invalid at startup, display a Toast alert immediately after app mounts. <!-- Updated: Validation Session 1 - Startup config invalid toast -->

## Architecture

```text
ApiProviderContext
  owns persisted proxy state
  wires proxy state → apiClient setters

useSettingsModal
  owns local draft fields while modal is open
  commits proxy fields on Save

SettingsModal
  renders only toggle/inputs/copy
```

## Related Code Files

- Modify: `src/contexts/ApiProviderContext.tsx`
- Modify: `src/hooks/useSettingsModal.ts`
- Modify: `src/components/modals/SettingsModal.tsx`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Modify: `__tests__/contexts/ApiProviderContext.test.tsx`
- Modify: `__tests__/hooks/useSettingsModal.test.tsx`
- Modify: `__tests__/components/SettingsModal.test.tsx`
- Modify: `__tests__/locales/key-parity.test.ts`

## Implementation Steps

1. Run GitNexus impact for `ApiProvider`, `useSettingsModal`, and `SettingsModal` before editing.
2. Extend `ApiContextType` with grouped `vertexProxySettings` and one atomic setter.
3. Add localStorage keys:
   - `vertex_proxy_enabled`
   - `vertex_proxy_url`
   - `vertex_proxy_api_key`
4. Initialize `vertexProxySettings` from safeStorage as one object.
5. Add a mount/update sync effect in `ApiProvider` that validates rehydrated proxy settings and atomically configures `apiClient.ts`; reload state must match SDK runtime state.
6. Wire proxy changes into atomic API client configuration so key/base URL cannot mismatch.
7. If stored `vertex_proxy_enabled` is true but URL/key is invalid or empty, treat proxy as disabled until user fixes settings.
8. Disabling proxy must immediately stop proxy routing even if stale URL/key remain persisted.
9. Validate proxy URL through `validateProviderBaseUrl` on save and restore; reject invalid/public HTTP.
10. Add draft fields in `useSettingsModal` return type.
11. Sync proxy draft state when modal opens.
12. Commit proxy draft state in `handleSave()` only after validation passes.
13. Validate restored settings before applying `vertexProxyUrl`; do not persist restored invalid proxy URLs.
14. Render a `SectionCard` for Vertex Proxy in `SettingsModal`.
15. Render proxy API key input as masked by default.
16. Add a notice/tooltip that localStorage is plaintext and not suitable for public/shared devices.
17. Ensure clear-data flow removes `vertex_proxy_enabled`, `vertex_proxy_url`, and `vertex_proxy_api_key`.
18. Ensure backup/export excludes or redacts `vertex_proxy_api_key`.
19. Add i18n labels/help text and generic validation errors in both locales.

## TDD Structure

### RED

- Add failing context tests for state init, persistence, and SDK setter wiring.
- Add failing context test: reload with persisted enabled/url/key syncs SDK runtime config on `ApiProvider` mount.
- Add failing tests that grouped `vertexProxySettings` updates atomically; no effect observes enabled=true with stale URL/key.
- Add failing tests for `validateProviderBaseUrl` integration on save and restore.
- Add failing tests for strict URL validation and fail-closed invalid/empty stored values.
- Add failing test that proxy enabled + empty key blocks save or disables proxy.
- Add failing test that disable-after-enable restores direct Gemini path and does not reuse proxy key.
- Add failing hook tests for draft sync and save behavior.
- Add failing component test for toggle/input rendering.
- Add failing component test that proxy key input is masked by default and labels/help text never echo entered key.
- Add failing clear-data/backup tests to remove or redact proxy key.
- Add failing locale parity test for new keys.

### GREEN

- Implement minimal context/hook/UI/i18n changes.

### REFACTOR

- Keep SettingsModal presentational; avoid business logic in JSX.
- Extract repeated field markup only if it reduces noise.

## Success Criteria

- [ ] Proxy settings save and reload from localStorage.
- [ ] Rehydrated proxy settings are synced to `apiClient.ts` on app startup before Gemini requests use the client.
- [ ] Proxy settings update atomically as one object.
- [ ] `validateProviderBaseUrl` validates proxy URL on save and restore; unsafe public HTTP is rejected.
- [ ] Empty proxy key cannot enable proxy routing.
- [ ] Enabling proxy wires URL + proxy API key atomically to SDK config.
- [ ] Disabling proxy clears base URL and restores direct key/null without stale proxy key.
- [ ] Settings UI clearly distinguishes proxy key from account JSON, masks it by default, and warns about plaintext localStorage/public devices.
- [ ] Clear-data removes all proxy keys; backup/export redacts/excludes proxy key.
- [ ] Locale parity passes.

## Risk Assessment

- Persisted proxy key sensitivity: user confirmed localStorage persistence; match existing provider studio behavior, mask in UI, redact/exclude from backup/diagnostics, clearly label as proxy key, and never print/store key in source.
- Unsafe proxy URL can exfiltrate key: strict URL parsing and fail-closed validation are mandatory before enabling proxy routing.
- Context re-render breadth: proxy settings are low-frequency, acceptable in existing context.

## Open Questions

None.
