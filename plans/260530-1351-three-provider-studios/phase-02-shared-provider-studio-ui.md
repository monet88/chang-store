---
phase: 2
title: "Shared Provider Components"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Shared Provider Components

## Overview

Build the minimal set of shared components and utilities used by both Grok and GPT Image studios: settings panel, results grid, OpenAI-compatible response parser, and bounded retry utility. Provider settings are owned by `ApiProviderContext`. Each provider renders its own workflow UI — this phase does not create shared workflow shells.

## Requirements

- Functional: Settings panel for base URL and API key backed by `ApiProviderContext`, with localStorage persistence and env defaults handled by that context.
- Functional: Base URL validation — only allow HTTPS URLs matching known provider domains (api.x.ai, api.openai.com) by default. Custom URLs require explicit user confirmation with warning that API key will be sent to that domain.
- Functional: Results grid displays local-only images from provider responses.
- Functional: Response parser extracts `ImageFile[]` from OpenAI-compatible `data[].b64_json` format. Must check for `response.error` field before extraction and throw typed error if present. Provider services must request or normalize to this format before calling the parser.
- Functional: Retry utility handles 429/503/auth_unavailable with exponential backoff + jitter.
- Functional: Retry utility accepts `AbortSignal` for cancellation on studio switch.
- Functional: Prompt validation utility enforces max length (10,000 chars), strips null bytes/control characters.
- Non-functional: Components remain thin UI wrappers; no service calls.
- Non-functional: Tailwind only; follow existing Runway-inspired styling.
- Non-functional: No imports from Gemini services or prompt builders.
- Non-functional: Services MUST throw typed `ProviderApiError { status: number; code?: string; message: string }` on non-2xx responses. `withRetry`'s `retryOn` evaluates this error type.

## Architecture

```text
Shared components (used by both GrokStudio and GptImageStudio):
  → ProviderSettingsPanel (URL + API key inputs, context callbacks, URL validation)
  → ProviderResultsGrid (local ImageFile[] display)

Shared utilities:
  → openaiCompatibleResponse.ts (parse data[].b64_json → ImageFile[], error envelope detection)
  → withRetry.ts (bounded retry with exponential backoff + jitter, AbortSignal support)
  → providerRegistry.ts (provider metadata and env-name mapping)
  → provider-url-validation.ts (base URL allowlist)
  → validatePrompt.ts (max length, control char stripping)
  → ProviderApiError (typed error class for non-2xx responses)
```

## Related Code Files

- Create: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
- Create: `src/components/studios/provider-studio/ProviderResultsGrid.tsx`
- Create: `src/services/providers/shared/openaiCompatibleResponse.ts`
- Create: `src/services/providers/shared/withRetry.ts`
- Create: `src/services/providers/shared/validatePrompt.ts`
- Create: `src/services/providers/shared/ProviderApiError.ts`
- Create: `src/config/providerRegistry.ts`
- Create: `src/utils/provider-url-validation.ts`
- Modify: `src/contexts/ApiProviderContext.tsx`
- Reuse/read: `src/components/GeneratedImage.tsx` (for result display)
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Test: `__tests__/components/studios/provider-studio/ProviderSettingsPanel.test.tsx`
- Test: `__tests__/services/providers/shared/openaiCompatibleResponse.test.ts`
- Test: `__tests__/services/providers/shared/withRetry.test.ts`
- Test: `__tests__/contexts/ApiProviderContext.test.tsx`
- Test: `__tests__/config/providerRegistry.test.ts`
- Test: `__tests__/utils/provider-url-validation.test.ts`

## Implementation Steps

1. Extend `ApiProviderContext` for provider settings:
   - Add provider ids for `grok` and `gptImage`.
   - Resolve env defaults from the injected provider key/base URL names, with VITE-prefixed fallback handled in `vite.config.ts`.
   - Preserve the existing guarded localStorage pattern for user overrides.
   - Expose `providerSettings`, `setProviderSettings`, and `resetProviderSettings` APIs.
   - Base URL validation: allowlist of known domains (`api.x.ai`, `api.openai.com`). Custom URLs require HTTPS and user confirmation.

2. Implement `ProviderApiError.ts`:
   - `class ProviderApiError extends Error { status: number; code?: string }`.
   - All provider services throw this on non-2xx responses.

3. Build `ProviderSettingsPanel`:
   - Base URL and API key text inputs.
   - Receives current settings and save/reset callbacks from the studio hook/context.
   - Does not read or write localStorage directly.
   - Password-masked API key field.
   - URL validation warning when custom domain entered.

4. Build `ProviderResultsGrid`:
   - Accepts `results: ImageFile[]` prop.
   - Renders grid of images with download option.
   - No Gallery context integration.

5. Implement `openaiCompatibleResponse.ts`:
   - Check for `response.error` field FIRST — if present, throw `ProviderApiError` with error details.
   - Parse `{ data: [{ b64_json: string }] }` → `ImageFile[]`.
   - Handle missing/malformed data gracefully.

6. Implement `validatePrompt.ts`:
   - `function validatePrompt(input: string): string` — enforces max 10,000 chars, strips null bytes and control characters, trims whitespace.
   - Called at hook level before payload construction.

7. Implement `withRetry.ts`:
   - `async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, options?: { retries?: number; delay?: number; retryOn?: (err: unknown) => boolean; signal?: AbortSignal }): Promise<T>`
   - Default: 3 retries, exponential backoff with jitter: `delay * 2^attempt + random(0, delay/2)`.
   - Default `retryOn`: `err instanceof ProviderApiError && [429, 503].includes(err.status)` OR error message contains `auth_unavailable`.
   - Respects `AbortSignal` — throws immediately if aborted between retries.

8. Add i18n keys for settings panel labels and validation messages.

9. Add unit tests for all utilities and component rendering.

## Success Criteria

- [ ] Settings panel renders with context-provided env defaults and saves overrides through `ApiProviderContext`.
- [ ] Base URL validation warns on non-allowlisted domains; blocks non-HTTPS.
- [ ] Results grid displays `ImageFile[]` without Gallery side effects.
- [ ] Response parser checks for error envelope before extracting images.
- [ ] Response parser correctly extracts images from OpenAI-compatible JSON.
- [ ] Retry utility uses exponential backoff with jitter (not fixed delay).
- [ ] Retry utility respects AbortSignal for cancellation.
- [ ] Retry evaluates `ProviderApiError` type (not string matching).
- [ ] Prompt validation enforces max length and strips control characters.
- [ ] No imports from Gemini services or prompt builders.
- [ ] No standalone provider settings persistence service exists outside `ApiProviderContext`.

## Risk Assessment

- Risk: localStorage key collisions.
  - Mitigation: Namespace keys with provider prefix (e.g., `provider:grok:apiKey`).
- Risk: Over-general settings panel.
  - Mitigation: Accept provider label/description as props; keep component thin.
- Risk: User-controlled base URL sends API key to attacker server.
  - Mitigation: Allowlist known domains; require HTTPS; show confirmation warning for custom URLs.
- Risk: API returns 200 with error body (some proxies do this).
  - Mitigation: `parseOpenAIResponse` checks for `error` field before `data[]` extraction.

<!-- Updated: Validation Session 2 — superseded by Session 3; provider settings now belong to ApiProviderContext -->
<!-- Updated: Red Team Session — base URL validation, prompt validation, withRetry exponential backoff + jitter + AbortSignal, ProviderApiError typed class, error envelope detection, env var access pattern -->
<!-- Updated: Session 3 — ProviderSettingsPanel receives settings/callbacks from context-backed hook; providerRegistry and provider-url-validation replace standalone providerSettings.ts -->
