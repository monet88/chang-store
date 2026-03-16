# Architecture Research: Improve Upscale Feature

**Domain:** Hybrid Upscale workflow for existing AI fashion studio  
**Researched:** 2026-03-16  
**Confidence:** High for repo integration, medium for some external-tool detail

## Recommended Architecture

Keep Upscale as one feature screen, but split it into two sibling flows behind one canonical hook:

`Component -> Hook -> Service facades -> Provider implementations`

- Direct in-app upscale stays on the existing `services/imageEditingService.ts` path
- AI Studio guidance becomes a new text-first service path that returns one structured report object
- `components/Upscale.tsx` should stop owning orchestration directly

## Recommended Screen Shape

1. Shared image upload at the top
2. Two sibling action areas in the same screen:
   - `Quick Upscale`
   - `AI Studio`
3. Result area renders both independently:
   - comparator/result for direct upscale
   - structured report cards for analysis, prompt, preview description, and tool guides

## New Modules

### `hooks/useUpscale.ts`

Canonical runtime hook that owns:

- uploaded-image state
- direct-upscale state
- studio-report state
- separate loading/error channels
- reset behavior when image changes
- copy/export helpers

### `services/upscaleStudioService.ts`

New facade for non-image-execution AI Studio output.

Responsibilities:

- route provider choice for studio analysis
- validate and normalize response shape
- throw translation-key-style errors
- keep tool-playbook logic out of UI code

### `services/gemini/upscaleStudio.ts`

Gemini implementation for AI Studio report generation.

### `utils/upscaleStudioPromptBuilder.ts`

Prompt-builder logic for the AI Studio request.

### `utils/upscaleStudioSchema.ts`

Shared response contract / schema helper for report normalization.

### Suggested leaf UI components

- `components/UpscaleQuickActions.tsx`
- `components/UpscaleStudioActions.tsx`
- `components/UpscaleStudioReport.tsx`

## Modified Modules

- `components/Upscale.tsx`
- `types.ts`
- `locales/en.ts`
- `locales/vi.ts`
- new tests on the canonical runtime path

## Data Contract Direction

Use one structured `UpscaleStudioReport` object instead of multiple unrelated strings.

Suggested sections:

- `analysis`
- `promptPackage`
- `simulatedPreview`
- `toolGuides`

## Provider Strategy

### Direct path

Keep exactly where it is:

`useUpscale -> imageEditingService.upscaleImage`

### Studio path

Use a separate service facade:

`useUpscale -> upscaleStudioService.generateUpscaleStudioReport`

Recommended v1 behavior:

- support Gemini-backed structured output first
- if configured provider cannot support reliable structured output, show a clear feature-scoped error instead of degrading silently

## Build Order

1. Establish data contract and locale keys
2. Build studio service path and tests
3. Refactor Upscale to the canonical hook
4. Split and rebuild the UI
5. Add polish, retries, resets, and unsupported-provider UX

## Risks

- Hook bloat if all orchestration stays in one file
- Provider-capability mismatch for structured output
- Async state collision between direct upscale and studio report
- Stale outputs after re-upload
- Test drift if runtime and tested paths diverge

## Key Recommendation

The cleanest repo fit is `components/Upscale.tsx` -> `hooks/useUpscale.ts` -> two sibling service paths, with `imageEditingService.ts` preserved for direct upscale and a new `upscaleStudioService.ts` for the structured AI Studio report.

## Unresolved Questions

- Should the studio-report lane be explicitly Gemini-only in v1
- How strict the structured response contract should be on day one
