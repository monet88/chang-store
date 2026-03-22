---
plan: 02-01
status: done
started: 2026-03-16T17:00:00
completed: 2026-03-16T17:45:00
requirements-completed: [UPS-02, UPS-06]
---

# Phase 02-01 Summary: Quick Upscale Quality Lane

## What Was Done

### Task 1 — Quick Upscale model types ✅
- Added `UpscaleQuickModel` type, `UPSCALE_QUICK_MODELS` constant, `UPSCALE_QUICK_MODEL_LABELS` record, `DEFAULT_UPSCALE_QUICK_MODEL` to `types.ts`
- Extended `UpscaleSessionImage` with `quickModel` field

### Task 2 — Prompt consolidation at facade ✅
- `imageEditingService.ts`: single source of truth via `UPSCALE_PROMPTS` record (2K/4K)
- `gemini/image.ts`: refactored to accept `prompt` + `model` from caller (thin pass-through)
- `quickModel` parameter bypasses Settings model for Gemini calls

### Task 3 — Hook model selection, confirmation, error-suggestion, glow ✅
- `useUpscale.ts`: `setActiveModel`, `requestReupscale`/`confirmReupscale`/`cancelReupscale`, `getErrorSuggestion`, `showResultGlow` with 2s auto-reset

### Task 4 — Model dropdown + context-aware button ✅
- `UpscaleQuickPanel.tsx`: Segmented Flash/Pro model buttons, button text shows `Re-upscale (quality · model)` after first result
- i18n keys added to `en.ts` and `vi.ts`

### Task 5 — Metadata, glow, smart download ✅
- `UpscaleOutputPanel.tsx`: Metadata strip (resolution, model, file size), glow ring animation, error suggestion display
- `ImageComparator.tsx`: `downloadName` prop for context-aware filenames

### Task 6 — Confirmation dialog wiring ✅
- `Upscale.tsx`: All Phase 2 props wired (model, confirmation overlay, glow, error suggestion)
- Inline confirmation dialog overlaid on output panel

### Task 7 — Regression tests ✅
- 8 new Phase 2 tests in `useUpscale.test.tsx`: model default, model update, model persistence, confirmation flow (3), glow trigger, error suggestion
- Fixed `imageEditingService.test.ts` assertion for new 4-arg gemini call

## Verification

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass |
| `npx vite build` | ✅ Pass |
| `npx vitest run` | ✅ 452/452 tests pass (19 files) |

## Files Modified (10)

| File | Change |
|------|--------|
| `types.ts` | +UpscaleQuickModel, quickModel field |
| `services/gemini/image.ts` | Accept prompt+model from caller |
| `services/imageEditingService.ts` | UPSCALE_PROMPTS + quickModel override |
| `hooks/useUpscale.ts` | Model selection, confirm, glow, error-suggestion |
| `components/upscale/UpscaleQuickPanel.tsx` | Model selector + context button |
| `components/upscale/UpscaleOutputPanel.tsx` | Metadata, glow, error suggestion |
| `components/ImageComparator.tsx` | downloadName prop |
| `components/Upscale.tsx` | Wire all Phase 2 state/props |
| `locales/en.ts` | +15 Phase 2 keys |
| `locales/vi.ts` | +15 Phase 2 keys |

## Commits

1. `feat(02-01): add UpscaleQuickModel types and quickModel field`
2. `feat(02-01): consolidate upscale prompt at facade, refactor gemini pass-through`
3. `feat(02-01): add model selection, confirmation, glow, error-suggestion to useUpscale`
4. `feat(02-01): add model dropdown, context-aware button, i18n keys for Phase 2`
5. `feat(02-01): add metadata, glow animation, smart download, error suggestion to output`
6. `feat(02-01): wire confirmation dialog, model selector, glow, error-suggestion into Upscale`
7. `test(02-01): add Phase 2 regression tests for model, confirmation, glow, error-suggestion`
8. `fix(02-01): fix imageEditingService test assertion to match new upscale signature`
