---
phase: 3
title: "Proxy Image Generation"
status: completed
priority: P2
effort: "2.5h"
dependencies: [1, 2]
---

# Phase 3: Proxy Image Generation

## Context links

- `src/services/gemini/image.ts:134-161`
- `docs/api/vertex-ai-api-guide.md:133-185`
- `implementation_plan.md:78-97`

## Overview

Add a proxy-enabled text-to-image branch in `generateImageFromText()` that uses `generateContent()` and parses `inlineData`, while preserving the direct Gemini `generateImages()` path.

## Requirements

- Functional:
  - Detect whether proxy mode is enabled.
  - Direct path: keep existing `ai.models.generateImages()` behavior.
  - Proxy path: call `ai.models.generateContent()` with `responseModalities: [Modality.IMAGE]`.
  - Parse `response.candidates[].content.parts[].inlineData` into `ImageFile[]`.
  - Handle `numberOfImages` by looping one `generateContent()` request per requested output image.
  - Add a timeout/cancellation path for each proxy image request so UI cannot hang forever when cliproxy stalls.
  - Proxy image requests must use a 30-second timeout AbortSignal wrapper. <!-- Updated: Validation Session 1 - 30s AbortSignal timeout -->
  - Check `response.promptFeedback?.blockReason` and candidate `finishReason` before reading `parts`/`inlineData`.
  - Preserve existing error key behavior, including `error.api.safetyBlock` for safety blocks.
- Non-functional:
  - No video changes.
  - No service boundary changes for hooks/components.
  - Avoid duplicating large response-parsing logic if existing edit/upscale parsing can be safely shared.

## Architecture

Proxy path loops this request once per requested output image for reliability. Keep the request body aligned with the verified cliproxy `generateContent` docs: text prompt + image response modality first; do not send multi-image count in the proxy request.

```ts
await ai.models.generateContent({
  model,
  contents: [{ parts: [{ text: prompt }] }],
  config: {
    responseModalities: [Modality.IMAGE],
  },
})
```

`aspectRatio` support for proxy `generateContent()` is implementation-time/manual-smoke verified. Do not make unit tests require unverified image generation option fields; requested image count is provided by the outer loop.

Response parser:

```text
candidates → content.parts → inlineData.data / inlineData.mimeType
```

## Related Code Files

- Modify: `src/services/gemini/image.ts`
- Modify: `__tests__/services/gemini/image.test.ts`

## Implementation Steps

1. Run GitNexus impact for `generateImageFromText` before editing.
2. Add a small exported/internal helper in `apiClient.ts` or image service to know proxy enabled state if needed.
3. Add `generateImageFromTextViaGenerateContent()` helper for proxy path.
4. Keep direct `generateImages()` logic unchanged for non-proxy path.
5. Reuse existing safety/no-image/text-only checks where practical.
6. Ensure `aspectRatio === 'Default'` maps to `1:1` like current direct path; for proxy, include aspect ratio only if verified accepted by cliproxy/SDK.
7. For proxy mode, loop `numberOfImages` times and request one image per `generateContent()` call.
8. Do not send `numberOfImages` in the proxy `generateContent()` request body.
9. Add per-request timeout/cancellation for proxy image calls; default target: ~30s unless existing app timeout conventions say otherwise.
10. Before reading `parts`/`inlineData`, check `promptFeedback.blockReason` and candidate `finishReason`; throw `error.api.safetyBlock` for safety blocks.
11. Aggregate inlineData results; if any call fails, surface the existing Gemini failure error format.

## TDD Structure

### RED

- Add failing test: proxy enabled calls `models.generateContent`, not `models.generateImages`.
- Add failing test: inlineData response returns `ImageFile[]`.
- Add failing test: `numberOfImages > 1` loops one proxy request per image.
- Add failing test: proxy request does not send multi-image count; one output is requested per loop iteration.
- Add failing test: proxy image request timeout surfaces a user-safe Gemini failure error instead of hanging forever.
- Add failing test: prompt feedback safety block maps to `error.api.safetyBlock` before reading image parts.
- Add failing test: candidate safety finish reason maps to `error.api.safetyBlock` before reading image parts.
- Add failing test: text-only/no candidate response maps to existing error keys.
- Add failing test: direct path still calls `models.generateImages`.

### GREEN

- Implement proxy branch and parser.

### REFACTOR

- Extract image part parsing helper if duplicated across edit/upscale/generate.

## Success Criteria

- [ ] Proxy text-to-image works with Imagen `generateContent` response shape.
- [ ] Proxy text-to-image loops one request per requested output image.
- [ ] Direct text-to-image path remains compatible.
- [ ] Error mapping remains stable for UI.
- [ ] No hooks/components changed for image generation.

## Risk Assessment

- SDK config naming may differ for image generation options; keep proxy unit tests aligned to verified `responseModalities` request shape, and verify aspect ratio support via manual smoke before relying on it.
- Looping multiple images increases latency; acceptable for reliability because proxy behavior for multi-image single request is uncertain.

## Open Questions

None.
