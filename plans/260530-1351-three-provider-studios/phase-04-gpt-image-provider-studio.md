---
phase: 4
title: "GPT Image Provider Studio"
status: pending
priority: P1
effort: "1.5d"
dependencies: [2, 3]
---

# Phase 4: GPT Image Provider Studio

## Overview

Implement the GPT Image studio with dedicated hook, registry, and service. GPT Image uses JSON for text-to-image and multipart `image[]` file uploads for image editing in the raw HTTP contract. Uses shared retry utility for auth_unavailable/503 failures. Starts after Phase 3 (Grok) completes for faster feedback loop. Workflows implemented sequentially.

## Requirements

- Functional: GPT Image studio supports five feature workflows: Virtual Try-On, Lookbook, Clothing Transfer, Pattern Generator, AI Editor.
- Functional: Workflows implemented sequentially — each tested before starting the next.
- Functional: Model: `gpt-image-2`.
- Functional: Text-to-image sends JSON to `/v1/images/generations` with user-selected size and quality.
- Functional: Image edit sends `multipart/form-data` to `/v1/images/edits` with repeated `image[]` file fields in raw HTTP.
- Functional: Do not manually set `Content-Type` for multipart edit requests.
- Functional: User selects quality (`low`, `medium`, `high`, `auto`) and size (`auto`, `1024x1024`, `1536x1024`, `1024x1536`) via dropdowns.
- Functional: Uses shared `withRetry` for transient failures with exponential backoff + jitter.
- Functional: Provider settings are read from `ApiProviderContext` with env defaults and localStorage override.
- Functional: Results are local-only; no `ImageGalleryContext.addImage` calls and no "Send to PhotoAlbum" cross-studio transfer.
- Non-functional: No imports from Gemini `imageEditingService.ts`, Gemini model registry, or Gemini prompt builders.
- Non-functional: Hook builds payloads directly — no workflowPayloadBuilder abstraction.

## Architecture

```text
GptImageStudio.tsx (renders own workflow UI + shared settings/results)
  → useGptImageStudio.ts (all state, handlers, payload building)
      → gptImageModelRegistry.ts (model, quality options, size options)
      → services/providers/gpt-image/gptImageService.ts
          → JSON text-to-image
          → multipart image edit
          → withRetry for auth_unavailable/503
          → parseOpenAIResponse for b64_json extraction
      → ApiProviderContext provider settings
```

GPT request contracts:

```ts
// generate
POST /v1/images/generations
{
  model: 'gpt-image-2',
  prompt,
  n: 1,
  size: 'auto' | '1024x1024' | '1536x1024' | '1024x1536',  // user-selected
  quality: 'low' | 'medium' | 'high' | 'auto'              // user-selected
}

// edit
POST /v1/images/edits
Content-Type: multipart/form-data (auto-set)
body = new FormData()
form.append('model', 'gpt-image-2')
form.append('prompt', prompt)
form.append('n', '1')
form.append('size', selectedSize)
form.append('quality', selectedQuality)
// repeat per reference in raw HTTP:
form.append('image[]', blob, filename)
```

## Workflow Implementation Order

Same order as Grok (Phase 3) for consistency:

1. **AI Editor** — simplest: single image + prompt → edit
2. **Virtual Try-On** — subject image + clothing images → edit
3. **Lookbook** — clothing images → generate styled photos
4. **Clothing Transfer** — reference images + concept image → edit
5. **Pattern Generator** — prompt-only or prompt + reference → generate

Each workflow: implement → test → verify → next.

## Related Code Files

- Create: `src/components/studios/GptImageStudio.tsx`
- Create: `src/hooks/useGptImageStudio.ts`
- Create: `src/config/gptImageModelRegistry.ts`
- Create: `src/services/providers/gpt-image/gptImageService.ts`
- Reuse: `src/contexts/ApiProviderContext.tsx`
- Reuse: `src/services/providers/shared/openaiCompatibleResponse.ts`
- Reuse: `src/services/providers/shared/withRetry.ts`
- Reuse: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
- Reuse: `src/components/studios/provider-studio/ProviderResultsGrid.tsx`
- Modify: `src/App.tsx` to render GPT Image studio branch.
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Test: `__tests__/hooks/useGptImageStudio.test.ts`
- Test: `__tests__/services/providers/gpt-image/gptImageService.test.ts`

## Implementation Steps

1. Define GPT Image model/quality/size registry with user-facing warnings: slow response (~60-90s), `n` effectively one, multipart edit required, quality values limited to `low`, `medium`, `high`, and `auto`.
2. Implement `generateGptImage` — JSON body with user-selected size and quality params, validate prompt via `validatePrompt()`, `withRetry` with AbortSignal, `parseOpenAIResponse`. Throw `ProviderApiError` on non-2xx.
3. Implement `editGptImage` multipart request:
   - Convert each `ImageFile` to `Blob` with preserved MIME type.
   - Append repeated `form.append('image[]', blob, filename)` per reference image in raw HTTP.
   - Validate prompt via `validatePrompt()`.
   - Do not set `Content-Type` header manually.
   - Use `withRetry` with AbortSignal for transient failures.
   - Throw `ProviderApiError` on non-2xx.
4. Validate reference image count before network call; OpenAI docs allow up to 16 images, but product cap remains `MAX_GPT_REFERENCE_IMAGES = 10` to avoid timeout and UX overload.
5. Implement `useGptImageStudio` hook: receives `studioMode` as argument (props drilling, no context). Manage feature, settings, model, prompt, images, quality dropdown, size dropdown, loading, errors, local results. Create `AbortController` on mount; abort on unmount via useEffect cleanup. Pass signal to all service calls. Disable submit button while `loading` is true (prevents double-submit).
6. Build `GptImageStudio.tsx` with its own workflow UI:
   - Quality and size dropdowns in workflow panel.
   - Estimated response time warning (~60-90s).
   - Settings panel and results grid from shared components.
7. Wire AI Editor workflow first → test → verify.
8. Wire Virtual Try-On → test → verify.
9. Wire Lookbook → test → verify.
10. Wire Clothing Transfer → test → verify.
11. Wire Pattern Generator → test → verify.
12. Add service tests with fetch mocks verifying JSON body for generate, multipart fields for edit, missing content-type header, retry behavior, and response parsing.

## Success Criteria

- [ ] GPT Image studio settings panel loads env defaults and accepts runtime overrides.
- [ ] All five feature workflows work via GPT Image service calls.
- [ ] User can select quality and size via dropdowns.
- [ ] Multipart edit sends repeated `image[]` file fields with correct MIME types.
- [ ] `Content-Type` header is not manually set for multipart edit requests.
- [ ] Retry triggers only for transient failures (429/503/auth_unavailable) via shared `withRetry`.
- [ ] Estimated response time warning visible to user.
- [ ] Results are local-only; no gallery context side effects.
- [ ] Gemini service, registry, and prompt builders are untouched by GPT additions.

## Risk Assessment

- Risk: GPT Image response time is much slower than Grok (~60-90s vs ~6-12s).
  - Mitigation: Show clear estimated response time in UI and robust loading state.
- Risk: Multipart file conversion can break MIME types.
  - Mitigation: Preserve `ImageFile.mimeType` when creating blobs.
- Risk: Large multipart payloads.
  - Mitigation: Cap reference images at `MAX_GPT_REFERENCE_IMAGES = 10`.
- Risk: Browser-exposed API key.
  - Mitigation: Accepted for v1; document risk.
- Risk: In-flight API call continues 60-90s after studio switch.
  - Mitigation: AbortController in hook; abort on unmount. withRetry respects AbortSignal.

<!-- Updated: Validation Session 1 — "Send to PhotoAlbum" cross-studio transfer explicitly disabled in provider mode -->
<!-- Updated: Validation Session 2 — superseded by Session 3 raw HTTP field-name correction -->
<!-- Updated: Red Team Session — AbortController on mount/unmount, prompt validation, ProviderApiError throw contract, concrete MAX_GPT_REFERENCE_IMAGES=10, loading state disables submit -->
<!-- Updated: Session 3 — GPT Image 2 qualities corrected to low/medium/high/auto; raw multipart field corrected to repeated image[]; settings moved to ApiProviderContext -->
