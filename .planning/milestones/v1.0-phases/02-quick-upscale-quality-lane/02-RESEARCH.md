# Phase 2: Quick Upscale Quality Lane — Research

**Researched:** 2026-03-16
**Status:** Complete

## Executive Summary

Phase 2 locks in the preservation-first Quick Upscale path. The codebase already has 80%+ of the infrastructure from Phase 1. Key work: consolidate prompt at facade level, add model selection (Flash/Pro), add metadata + smart download, add confirmation + glow feedback, extend error handling with auto-suggestions.

## Current Architecture Analysis

### Service Layer — Dual Prompt Problem

**`services/imageEditingService.ts` (line 200-244):**
- `upscaleImage()` defines a generic prompt: `"Upscale this image to a high-resolution ${quality} format..."` (line 208)
- For Local/Anti: wraps via `editImage()` passing that prompt
- For Gemini: delegates to `geminiImageService.upscaleImage(image, quality)` — which has its OWN hardcoded prompt

**`services/gemini/image.ts` (line 163-229):**
- `upscaleImage()` hardcodes a DIFFERENT prompt: `"Upscale this image with enhanced details, sharpness, and texture clarity..."` (line 167)
- Hardcodes model to `'gemini-3.1-flash-image-preview'` (line 170) — ignores the model passed from facade
- Sets `imageConfig: { imageSize: quality }` (line 174)

**Resolution:** Per CONTEXT.md decisions:
1. Single prompt at facade level → gemini/image.ts removes its hardcoded prompt
2. Facade sends prompt + model + quality to gemini layer
3. Gemini layer becomes a thin pass-through for upscale

### Hook Layer — `useUpscale.ts`

**Current state (line 167-191):**
```typescript
const result = await upscaleImage(
  activeImage.original,
  imageEditModel,        // ← from Settings via getModelsForFeature
  buildServiceConfig(setLoadingMessage),
  activeImage.quickQuality,
);
```

**What needs changing:**
- `imageEditModel` comes from Settings — Phase 2 needs Quick Upscale to use its own hardcoded Flash/Pro model, NOT Settings
- Add `quickModel` per-image state (default: Flash)
- Pass the selected Quick Upscale model instead of Settings model
- Add confirmation logic before re-upscale (when `quickResult` already exists)

### Component Layer

**`UpscaleQuickPanel.tsx`:**
- Already has quality selector (2K/4K segmented buttons)
- Already has upscale button with loading state
- Needs: model dropdown (Flash ▾ / Pro), re-upscale button text change

**`UpscaleOutputPanel.tsx`:**
- Already renders `ImageComparator` for before/after
- Needs: metadata display (resolution, file size) below comparator
- Needs: glow animation on result ready

**`ImageComparator.tsx`:**
- Download hardcoded to `"upscaled-image.png"` (line 32)
- Needs: smart filename via prop (`upscale-2K-flash-20260316.png`)

### Type Layer — `types.ts`

**Existing:**
- `UpscaleQuality = '2K' | '4K'`
- `UPSCALE_QUALITIES = ['2K', '4K']`
- `UpscaleSessionImage` has `quickQuality` but no `quickModel`

**Needed:**
- `UpscaleQuickModel` type: `'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview'`
- `UPSCALE_QUICK_MODELS` constant with labels
- `UpscaleSessionImage.quickModel` field

### Model Registry — `config/modelRegistry.ts`

- `gemini-3` prefix → `supportsImageSize: true` — both Flash and Pro match
- No changes needed to registry itself

## Implementation Strategy

### Change 1: Prompt Consolidation at Facade

**File:** `services/imageEditingService.ts`
- Replace generic prompt (line 208) with locked preservation-first prompts from CONTEXT.md
- The facade already selects prompt based on quality — keep that pattern
- Add `model` parameter override for Quick Upscale (separate from Settings model)

**File:** `services/gemini/image.ts`
- Refactor `upscaleImage()` to accept prompt and model from caller
- Remove hardcoded prompt and model
- Keep `imageConfig: { imageSize: quality }` logic

### Change 2: Model Selection State

**File:** `types.ts`
- Add `UpscaleQuickModel` type and `UPSCALE_QUICK_MODELS` constant
- Add `quickModel` to `UpscaleSessionImage`

**File:** `hooks/useUpscale.ts`
- Add `setActiveModel()` action
- Pass `activeImage.quickModel` to `upscaleImage()` instead of `imageEditModel`
- Add confirmation dialog state for re-upscale

### Change 3: UI Enhancements

**`UpscaleQuickPanel.tsx`:**
- Add compact model dropdown next to quality selector
- Change button text after first result: "Re-upscale (4K · Flash)"

**`UpscaleOutputPanel.tsx`:**
- Add metadata section below comparator (resolution, file size)
- Add CSS glow/flash animation on result ready

**`ImageComparator.tsx`:**
- Accept `downloadFilename` prop
- Generate pattern: `upscale-{quality}-{model}-{timestamp}.png`

### Change 4: Error Auto-Suggestions

**`hooks/useUpscale.ts` or new util:**
- Map error types to suggestions:
  - `error.api.safetyBlock` → "Try switching to Pro model"
  - `error.api.noImageGenerated` → "Try a different quality setting or retry"
  - Timeout/network → "Check connection and retry"
- Store suggestion alongside error in state

### Change 5: Confirmation Dialog

**New component or modal:**
- Shown before overwriting existing `quickResult`
- Simple confirm/cancel dialog
- Existing modal patterns in the codebase should be reused

## Validation Architecture

### Unit Tests
- `useUpscale.ts`: test model selection, prompt construction, confirmation flow
- `UpscaleQuickPanel.tsx`: test model dropdown rendering, button text changes
- `UpscaleOutputPanel.tsx`: test metadata display, glow animation trigger
- `ImageComparator.tsx`: test custom download filename

### Integration Tests
- Facade → Gemini: verify prompt and model pass-through
- Full upscale flow: upload → select quality/model → upscale → compare → re-upscale with confirmation

### Success Criteria Mapping
1. "User can trigger Quick Upscale on the active session image" → Phase 1 already covers; Phase 2 extends with model
2. "User can choose 2K or 4K" → Already works; Phase 2 adds model choice
3. "Uses locked preservation-first prompt" → Prompt consolidation change
4. "User can compare original and result" → Already works; Phase 2 adds metadata

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt change degrades quality | High | Use exact wording from CONTEXT.md, test with real images |
| Model dropdown clutters compact UI | Medium | Keep inline, small "Flash ▾" next to quality selector |
| Confirmation dialog disrupts flow | Low | Quick single-button confirm, not a full modal |
| Error suggestions mislead users | Low | Keep suggestions factual, never promise fix |

## Dependencies

- Phase 1 complete ✅ (multi-image session, mode switching, hook architecture)
- No external API changes needed — just routing existing parameters differently
- No new npm packages required

---

*Phase: 02-quick-upscale-quality-lane*
*Research completed: 2026-03-16*
