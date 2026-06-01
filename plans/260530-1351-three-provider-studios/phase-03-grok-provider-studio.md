---
phase: 3
title: "Grok Provider Studio"
status: complete
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Grok Provider Studio

## Overview

Implement the Grok studio with dedicated hook, model registry, and service. Grok supports five feature workflows through official xAI JSON image generation/edit endpoints. Each workflow is implemented and tested sequentially before moving to the next. Uses shared retry utility and response parser from Phase 2 with explicit `response_format: 'b64_json'` requests.

## Requirements

- Functional: Grok studio supports five feature workflows: Virtual Try-On, Lookbook, Clothing Transfer, Pattern Generator, AI Editor.
- Functional: Workflows implemented sequentially — each tested before starting the next.
- Functional: Models: support `grok-imagine-image` and `grok-imagine-image-quality`; default to `grok-imagine-image-quality` unless product direction changes.
- Functional: All requests are JSON; single-image edit uses an `image` object and multi-image edit uses an `images` object array.
- Functional: User selects output count `n` via slider (1–10), aspect ratio from xAI-supported presets, and resolution (`1k` or `2k`); enforce the official multi-image edit limit of 3 source images.
- Functional: Provider settings are read from `ApiProviderContext` with env defaults and localStorage override.
- Functional: Results are local-only; no `ImageGalleryContext.addImage` calls and no "Send to PhotoAlbum" cross-studio transfer.
- Non-functional: No imports from Gemini `imageEditingService.ts`, Gemini model registry, or Gemini prompt builders.
- Non-functional: Hook builds payloads directly — no workflowPayloadBuilder abstraction.

## Architecture

```text
GrokStudio.tsx (renders own workflow UI + shared settings/results)
  → useGrokStudio.ts (all state, handlers, payload building)
      → grokModelRegistry.ts (model labels, limits)
      → services/providers/grok/grokImageService.ts
          → fetch with configurable base URL + bearer token
          → JSON request body only
          → withRetry for 429/503 errors
          → parseOpenAIResponse for b64_json extraction
      → ApiProviderContext provider settings
```

Grok request contracts:

```ts
// generate
POST /v1/images/generations
{
  model: 'grok-imagine-image' | 'grok-imagine-image-quality',
  prompt: string,
  n: number (1–10),   // user-selected via slider
  aspect_ratio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '9:19.5' | '19.5:9' | '9:20' | '20:9' | '1:2' | '2:1' | 'auto',
  resolution: '1k' | '2k',
  response_format: 'b64_json'
}

// edit
POST /v1/images/edits
{
  model: 'grok-imagine-image' | 'grok-imagine-image-quality',
  prompt: string,
  image?: { type: 'image_url', url: string },
  images?: Array<{ type: 'image_url', url: string }>,
  n: number (1–10),   // user-selected via slider
  aspect_ratio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '9:19.5' | '19.5:9' | '9:20' | '20:9' | '1:2' | '2:1' | 'auto',
  resolution: '1k' | '2k',
  response_format: 'b64_json'
}
```

> The xAI REST Images reference accepts a 14-value `aspect_ratio` enum. The
> Grok studio UI currently exposes a curated subset (`1:1`, `2:3`, `3:2`,
> `9:16`, `16:9`) plus the `Default` (omit) option that maps to `auto`,
> because those five cover every fashion-output ratio the product targets.
> Power users can still send the full enum by typing into a future advanced
> input; the wire contract above lists every accepted value so the service
> validator never rejects a legitimate request.

## Workflow Implementation Order

1. **AI Editor** — simplest: single image + prompt → edit
2. **Virtual Try-On** — subject image + clothing images → edit
3. **Lookbook** — clothing images → generate styled photos
4. **Clothing Transfer** — reference images + concept image → edit
5. **Pattern Generator** — prompt-only or prompt + reference → generate

Each workflow: implement → test → verify → next.

## Related Code Files

- Create: `src/components/studios/GrokStudio.tsx`
- Create: `src/hooks/useGrokStudio.ts`
- Create: `src/config/grokModelRegistry.ts`
- Create: `src/services/providers/grok/grokImageService.ts`
- Reuse: `src/contexts/ApiProviderContext.tsx`
- Reuse: `src/services/providers/shared/openaiCompatibleResponse.ts`
- Reuse: `src/services/providers/shared/withRetry.ts`
- Reuse: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
- Reuse: `src/components/studios/provider-studio/ProviderResultsGrid.tsx`
- Modify: `src/App.tsx` to render Grok studio branch.
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Test: `__tests__/hooks/useGrokStudio.test.ts`
- Test: `__tests__/services/providers/grok/grokImageService.test.ts`

## Implementation Steps

1. Define Grok model registry with labels for `grok-imagine-image` and `grok-imagine-image-quality`, max outputs (10), max reference images (3), aspect ratio presets, resolution options (`1k`, `2k`), and response-time guidance.
2. Implement `generateGrokImage` — JSON body, validate n/aspect ratio/resolution, validate prompt via `validatePrompt()`, request `response_format: 'b64_json'`, use `withRetry` with AbortSignal, parse with `parseOpenAIResponse`. Throw `ProviderApiError` on non-2xx and throw a typed unsupported-response error if the provider returns only URLs.
3. Implement `editGrokImage` — JSON body with official `image` object for one source or `images` object array for multiple sources, `response_format: 'b64_json'`, selected resolution, and selected aspect ratio when applicable. Validate max 3 reference images before the network call. Throw `ProviderApiError` on non-2xx.
4. Implement `useGrokStudio` hook: receives `studioMode` as argument (props drilling, no context). Manage feature, settings, model, prompt, images, n (slider), loading, errors, local results. Create `AbortController` on mount; abort on unmount via useEffect cleanup. Pass signal to all service calls. Disable submit button while `loading` is true (prevents double-submit).
5. Build `GrokStudio.tsx` with its own workflow UI:
   - Sidebar shows 5 provider features (via Phase 1 sidebar swap).
   - Workflow panel renders per-feature inputs (image uploaders, prompt, n slider).
   - Settings panel and results grid from shared components.
6. Wire AI Editor workflow first → test → verify.
7. Wire Virtual Try-On → test → verify.
8. Wire Lookbook → test → verify.
9. Wire Clothing Transfer → test → verify.
10. Wire Pattern Generator → test → verify.
11. Add service tests with fetch mocks verifying URL, method, headers, JSON body, limits, retry, and response parsing.

## Success Criteria

- [ ] Grok studio settings panel loads env defaults and accepts runtime overrides.
- [ ] All five feature workflows work via Grok service calls.
- [ ] User can select `n` (1–10), aspect ratio, and resolution in workflow panel.
- [ ] Edit sends official xAI JSON `image` or `images` object shape, not multipart and not a raw data URI array.
- [ ] Service requests `response_format: 'b64_json'` and fails with a typed unsupported-response error if the provider returns only URLs.
- [ ] More than 3 reference images fails before network call.
- [ ] `n > 10` fails before network call.
- [ ] Retry handles 429/503 transient errors.
- [ ] Results are local-only; no gallery context side effects.
- [ ] Gemini service, registry, and prompt builders are untouched by Grok additions.

## Risk Assessment

- Risk: Browser-exposed bearer token in client-side Vite env.
  - Mitigation: Document as dev/proxy key; accepted for v1.
- Risk: Large base64 payloads in JSON body (5 images × ~10MB each = 50MB).
  - Mitigation: Enforce image count early AND validate total payload size (warn if >20MB). Compress/resize before encoding if feasible.
- Risk: Gemini prompt builders produce `Part[]` that does not map cleanly.
  - Mitigation: Build payloads from plain prompt strings and `ImageFile[]` directly in hook.
- Risk: In-flight API call continues after studio switch (6-12s response time).
  - Mitigation: AbortController in hook; abort on unmount. withRetry respects AbortSignal.

<!-- Updated: Validation Session 1 — "Send to PhotoAlbum" cross-studio transfer explicitly disabled in provider mode -->
<!-- Updated: Validation Session 2 — Hook receives studioMode as argument (props drilling, no context) -->
<!-- Updated: Red Team Session — AbortController on mount/unmount, prompt validation, ProviderApiError throw contract, payload size validation, loading state disables submit -->
<!-- Updated: Session 3 — xAI contract corrected to JSON image/images objects, max 3 sources, ApiProviderContext settings, and explicit b64_json proof requirement -->
<!-- Updated: Session 5 — xAI REST Images reference proves aspect_ratio/resolution and response_format=b64_json for generation and edits; supports grok-imagine-image and grok-imagine-image-quality -->
