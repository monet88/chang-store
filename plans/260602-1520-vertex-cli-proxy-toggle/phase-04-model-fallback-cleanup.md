---
phase: 4
title: "Model Fallback Cleanup"
status: completed
priority: P2
effort: "1.5h"
dependencies: [3]
---

# Phase 4: Model Fallback Cleanup

## Context links

- `src/config/modelRegistry.ts:60-115`
- `src/services/gemini/text.ts:6-17`
- `implementation_plan.md:70-76`
- `implementation_plan.md:98-106`

## Overview

Align model defaults/fallbacks with the corrected scope: `gemini-3.5-flash` becomes the default text model choice, `gemini-3.1-pro` is the exact Pro text model, remaining Gemini 2 helper hardcodes migrate to `gemini-3.5-flash`, and proxy image generation automatically falls back to Imagen Fast.

## Requirements

- Functional:
  - Add or keep `gemini-3.5-flash` as the default text model choice.
  - Use exact `gemini-3.1-pro` for the Pro text model; `gemini-3.1-pro-preview` is invalid.
  - Replace the previous default `gemini-3-flash-preview` with `gemini-3.5-flash`.
  - Remove or update any text generation default that still points at Gemini 2.x.
  - Migrate actual internal Gemini text helper hardcodes:
    - `generateText`: `gemini-2.5-pro` → `gemini-3.5-flash`
    - `generateImageDescription`: `gemini-3-flash` → `gemini-3.5-flash`
    - `generateClothingDescription`: `gemini-3-flash` → `gemini-3.5-flash`
    - `generatePoseDescription`: `gemini-3-flash` → `gemini-3.5-flash`
    - `generateStylePromptFromImage`: default `gemini-2.5-pro` → `gemini-3.5-flash`
    - `analyzeScene`: default `gemini-2.5-pro` → `gemini-3.5-flash`
  - Do not add `thinkingBudget` clamp for removed Gemini 2 text models.
  - Remove or conditionally omit hardcoded `thinkingConfig` for models that do not support it, including `gemini-3.5-flash`.
  - Update `src/services/textService.ts` facade functions so `generateImageDescription`, `generateClothingDescription`, and `generatePoseDescription` pass the selected `model` argument down to the Gemini helper layer instead of logging one model while calling another.
  - Automatically fallback to `imagen-4.0-fast-generate-001` only for documented proxy quota errors (`429`, `RESOURCE_EXHAUSTED`) when requested model is not already Fast.
  - Display a warning Toast notifying the user when fallback to Imagen Fast triggers. <!-- Updated: Validation Session 1 - Warning toast on fallback -->
  - Do not fallback on auth (`401/403`), request validation (`400`), safety/no-image/text-only/parser errors, or direct Gemini path.
  - Preserve image model IDs as exact `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`; never introduce `gemini-3.1-flash-image`.
- Non-functional:
  - Avoid broad model registry churn.
  - Keep direct Gemini image default behavior unless intentionally changed.

## Architecture

Current registry previously had default text model `gemini-3-flash-preview` (`src/config/modelRegistry.ts:111-115`). This phase now updates the default to exact `gemini-3.5-flash`, ensures the Pro text option is exact `gemini-3.1-pro` instead of invalid `gemini-3.1-pro-preview`, and migrates internal `gemini/text.ts` helper model hardcodes away from Gemini 2 to exact `gemini-3.5-flash`, per user decision.

Potential fallback policy:

```text
proxy enabled + text-to-image:
  requested Imagen model succeeds → use requested
  requested model is not Fast + error is 429/RESOURCE_EXHAUSTED quota → retry imagen-4.0-fast-generate-001 once
  auth/validation/safety/no-image/parser/direct-path errors → no fallback

direct Gemini:
  keep current DEFAULT_MODEL_BY_SELECTION_TYPE.imageGenerate unless product decision changes
```

## Related Code Files

- Modify: `src/config/modelRegistry.ts` only if adding explicit proxy fallback constant.
- Modify: `src/services/gemini/image.ts` if fallback lives in service logic.
- Modify: `src/services/gemini/text.ts` for exact text model/default migration and unsupported `thinkingConfig` removal/guard.
- Modify: `src/services/textService.ts` to pass selected model arguments through description facades.
- Modify: `src/services/gemini/video.ts` only to switch Video/Veo flows to direct Gemini client if handled in this phase instead of Phase 1.
- Modify: related tests if touched.

## Implementation Steps

1. Run GitNexus impact before editing any touched symbol.
2. Update text model registry/defaults so `gemini-3.5-flash` is the default text model choice.
3. Update Pro text model option to exact `gemini-3.1-pro`; remove invalid `gemini-3.1-pro-preview`.
4. Check `generateText()` default in `src/services/gemini/text.ts`; update to exact `gemini-3.5-flash` if needed.
5. Migrate the exact current `src/services/gemini/text.ts` model literals listed in Requirements to `gemini-3.5-flash`.
6. Remove or conditionally omit hardcoded `thinkingConfig` when the selected model does not support thinking config; `gemini-3.5-flash` must not receive unsupported thinking config.
7. Update `src/services/textService.ts` so image/clothing/pose description facades pass the selected `model` into `geminiTextService` helpers.
8. Add automatic proxy image fallback retry to `imagen-4.0-fast-generate-001` only for documented quota errors (`429`, `RESOURCE_EXHAUSTED`) and only when requested model is not already Fast.
9. Ensure no fallback occurs for auth, request validation, safety/no-image/parser errors, or direct Gemini path.
10. Ensure UI model options remain understandable: Fast is available and clearly labelled.
11. Verify image model IDs remain exact; `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview` are valid, `gemini-3.1-flash-image` is invalid.

## TDD Structure

### RED

- Add failing test if `generateText()` default still references Gemini 2.x.
- Add failing test that Pro text model is exact `gemini-3.1-pro`, not invalid `gemini-3.1-pro-preview`.
- Add failing tests for each migrated text helper/default listed in Requirements to assert `gemini-3.5-flash` model usage unless caller override exists.
- Add failing tests that `gemini-3.5-flash` requests do not include unsupported `thinkingConfig`.
- Add failing tests that `textService.ts` image/clothing/pose description facades pass selected model through to Gemini helpers.
- Add failing test: non-Fast proxy model retries once with `imagen-4.0-fast-generate-001` on `429`/`RESOURCE_EXHAUSTED`.
- Add failing test: already-Fast proxy model does not retry Fast again.
- Add failing test: auth/validation/safety/no-image/parser errors do not fallback.
- Add failing test: fallback only runs in proxy path; direct path remains unchanged.
- Add failing registry test only if adding a new proxy fallback helper.
- Add regression assertion that image model IDs include valid `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`, not invalid `gemini-3.1-flash-image`.

### GREEN

- Implement minimal default/fallback cleanup.

### REFACTOR

- Keep fallback logic named and local; avoid global abstraction unless reused.

## Success Criteria

- [ ] User-facing text generation defaults/fallbacks use `gemini-3.5-flash` as default.
- [ ] Pro text model option uses exact `gemini-3.1-pro`; invalid `gemini-3.1-pro-preview` removed.
- [ ] Actual Gemini text helper hardcodes/defaults listed in Requirements no longer use Gemini 2.x or invalid `gemini-3-flash`.
- [ ] `gemini-3.5-flash` requests do not include unsupported hardcoded `thinkingConfig`.
- [ ] `textService.ts` passes selected model through image/clothing/pose description facades.
- [ ] No `thinkingBudget` clamp added for Gemini 2 text models.
- [ ] Proxy text-to-image retries `imagen-4.0-fast-generate-001` only for documented quota errors on non-Fast proxy models.
- [ ] No fallback for auth, validation, safety/no-image/parser errors, already-Fast model, or direct Gemini path.
- [ ] Image model IDs include valid `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`; no invalid `gemini-3.1-flash-image`.
- [ ] No unrelated image edit model cleanup.

## Risk Assessment

- Hidden/internal text defaults may use different stale literals (`gemini-2.5-pro`, `gemini-3-flash`) than earlier assumptions; migrate the exact symbol list above and test each one.
- Automatic fallback can mask bugs; restrict it to documented quota errors on proxy path only and report chosen fallback clearly.

## Open Questions

None.
