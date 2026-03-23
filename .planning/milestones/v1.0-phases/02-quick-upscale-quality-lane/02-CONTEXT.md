# Phase 2: Quick Upscale Quality Lane - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the locked preservation-first Quick Upscale path with 2K/4K quality options, dedicated Gemini 3.x model selection, polished comparison UX, and refined post-upscale feedback. Users can run one-click upscale on the active session image, choose quality and model, compare result against the original, and re-upscale with different settings. This phase refines the Quick Upscale lane only; AI Studio analysis/prompt features arrive in later phases.

</domain>

<decisions>
## Implementation Decisions

### Prompt pattern
- Use the user's preservation-first prompt template from PROJECT.md as the base, with minor runtime adjustments allowed (e.g., soften fashion-specific language if image isn't fashion)
- Keep mentioning resolution in prompt text even though `imageSize` API param already controls output resolution — reinforces AI intent for better quality
- Single prompt defined at facade level (`imageEditingService.ts`), passed down to all providers. `gemini/image.ts` must not hardcode its own upscale prompt
- Prompt is hidden from user — pure implementation detail, no UI exposure
- Quality-to-variable mapping is direct match:
  - 2K → `target_resolution = "2K"`, `output_quality = "2K quality"`
  - 4K → `target_resolution = "4K"`, `output_quality = "4K quality"`
- Final 2K prompt: "Upscale this image to 2K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 2K quality."
- Final 4K prompt: "Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 4K quality."

### Model selection
- Quick Upscale hardcodes 2 model options only: Flash (`gemini-3.1-flash-image-preview`) and Pro (`gemini-3-pro-image-preview`)
- Default model: Flash
- Do NOT use model from Settings for Quick Upscale — only these 2 models support `imageSize: "2K"/"4K"`
- `gemini-2.5-flash-image` excluded — does not support `imageSize`
- UI: small dropdown next to quality selector showing "Flash ▾", compact, doesn't take extra space
- Local/Anti providers still allowed for Quick Upscale as best-effort — prompt text sent without `imageSize` API control, result may not match exact resolution

### Comparison interaction
- Current slider overlay comparison (`ImageComparator`) is sufficient — no side-by-side, zoom, or additional modes needed
- Show light metadata below comparison: output resolution (e.g., "2048×2048") and file size
- Download filename is context-aware: pattern like `upscale-2K-flash-20260316.png` with quality, model, and timestamp
- Before image is always the original upload, regardless of how many times user re-upscales. Never changes.

### Success feedback and re-upscale flow
- When result is ready: output panel flashes/glows briefly to draw attention. No auto-scroll
- Before overwriting an existing result (re-upscale): show confirmation dialog to prevent accidental loss
- Button text after first result: "Re-upscale (4K · Flash)" with current quality + model context visible on the button
- Error recovery: show error message + auto-suggest solution based on error type (safety block → suggest switching to Pro model, timeout → suggest retry, etc.)

### Claude's Discretion
- Exact flash/glow animation style and duration for result notification
- Exact confirmation dialog wording and design
- How to detect image content for minor prompt adjustments (fashion vs non-fashion)
- Mobile adaptation of model dropdown and metadata display
- Exact error-to-suggestion mapping for all error types

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/useUpscale.ts`: Already has `handleQuickUpscale()`, `setActiveQuality()`, quality state per image. Phase 2 extends with model selection state and confirmation logic
- `components/upscale/UpscaleQuickPanel.tsx`: Already has quality selector (2K/4K segmented buttons) and upscale button. Phase 2 adds model dropdown and re-upscale button text
- `components/upscale/UpscaleOutputPanel.tsx`: Already renders `ImageComparator` for before/after. Phase 2 adds metadata display below
- `components/ImageComparator.tsx`: Existing slider comparison with download button. Phase 2 updates download filename logic and adds metadata
- `services/imageEditingService.ts` line 200-244: `upscaleImage()` facade already routes by provider prefix. Phase 2 consolidates prompt here instead of dual-hardcoded prompts
- `services/gemini/image.ts` line 163-229: `upscaleImage()` already sends `imageSize: quality` via API config. Phase 2 removes hardcoded prompt, receives from facade
- `components/Spinner.tsx` / `ErrorDisplay`: Existing error display component. Phase 2 extends with auto-suggestion logic

### Established Patterns
- Thin component → hook orchestration: `UpscaleQuickPanel` is UI-only, `useUpscale` owns all logic
- Provider routing via model prefix: `local--`, `anti--`, or default Gemini in `imageEditingService.ts`
- Localized strings in `locales/en.ts` and `locales/vi.ts` — new button labels, metadata labels, confirmation text need both
- Error flow: `getErrorMessage(err, t)` for localized error messages

### Integration Points
- `useUpscale.ts` → `upscaleImage()` call at line 178 needs to pass the new model (Flash/Pro) instead of relying on Settings model
- `UpscaleSessionImage.quickQuality` type already supports `'2K' | '4K'` — needs new field for Quick Upscale model choice
- `types.ts` `UPSCALE_QUALITIES` constant already lists quality options — model options need similar constant

</code_context>

<specifics>
## Specific Ideas

- Prompt pattern is user-provided and locked — the exact wording from PROJECT.md is the source of truth, only variable substitution changes
- `imageSize` API parameter is the primary resolution control; prompt text reinforces rather than controls
- Quick Upscale model selection is deliberately separate from Settings model — avoids confusion when Settings has a model that doesn't support `imageSize`
- Confirmation before re-upscale prevents accidental loss — user explicitly opted for this friction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-quick-upscale-quality-lane*
*Context gathered: 2026-03-16*
