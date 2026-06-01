---
phase: 2
title: "Provider Studio Adapter Wiring"
status: complete
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Provider Studio Adapter Wiring

## Overview

Wire the Phase 1 adapter into both provider hooks so that, at generation time, the prompt
sent to the service is the composed (builder-enriched) prompt while the UI textarea keeps
showing the user's raw text. Images continue to be passed to the service unchanged.

## Requirements

- Functional: `useGrokStudio.handleGenerate` and `useGptImageStudio.handleGenerate` call
  `buildProviderStudioPrompt(activeFeature, prompt, images)` and send the result as the
  service `prompt`, instead of sending the raw `prompt` state.
- Functional: The `prompt` React state (bound to the textarea) is unchanged — users still
  see and edit only their own words. Composition happens transiently inside `handleGenerate`.
- Functional: Applies to both edit (`images.length > 0`) and generate (text-only) paths.
  For text-only Pattern Generator, the adapter still enriches with `TASK_PROMPT`.
- Non-functional: No new state, no new context. Keep the existing AbortController and
  error-handling structure intact.

## Architecture

- Both hooks already have `activeFeature` in scope (hook argument) and `prompt`/`images`
  in state. Add one import and one line:

```ts
import { buildProviderStudioPrompt } from '../utils/provider-studio-prompt-adapter';
// inside handleGenerate, before building params:
const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, images);
// then use composedPrompt in place of `prompt` in editGrokImage/generateGrokImage params
```

- Update the `useCallback` dependency arrays to include `activeFeature` (currently absent
  in `useGrokStudio`; both must list it so the composed prompt tracks the active feature).

## Related Code Files

- Modify: `src/hooks/useGrokStudio.ts` (handleGenerate: compose prompt; deps array)
- Modify: `src/hooks/useGptImageStudio.ts` (handleGenerate: compose prompt; deps array)
- Modify: `src/locales/en.ts`, `src/locales/vi.ts` (Try-On + Clothing Transfer upload-label
  image-order hint copy)
- Read for context: `src/utils/provider-studio-prompt-adapter.ts` (Phase 1 output),
  `src/services/providers/grok/grokImageService.ts`,
  `src/services/providers/gpt-image/gptImageService.ts`

## Implementation Steps

1. In `useGrokStudio.ts`: import the adapter. In `handleGenerate`, compute
   `const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, images);`
   before the `editGrokImage`/`generateGrokImage` calls; pass `prompt: composedPrompt`.
2. Add `activeFeature` to the `handleGenerate` `useCallback` deps array in `useGrokStudio`.
3. Repeat steps 1–2 in `useGptImageStudio.ts` for `editGptImage`/`generateGptImage`.
4. Confirm no UI changes are needed for prompt flow — `studio.prompt` (textarea binding) and
   `studio.setPrompt` stay as-is; only the value sent to the service changes.
5. **Image-order hint (red-team F4):** update the Try-On and Clothing Transfer upload-label
   i18n strings (`studio.workflows.tryOn.upload`, `studio.workflows.clothingTransfer.upload`
   in `src/locales/en.ts` + `vi.ts`) to state the order convention, e.g. "Ảnh đầu = người
   mẫu/bối cảnh, ảnh sau = trang phục". Matches the adapter's image[0]=subject assumption.
6. Run `npx tsc --noEmit` and `npm run lint` on the modified files.

## Staged Rollout (red-team F1/F3)

Wire **Try-On first** and run an empirical smoke test before trusting the
other features. The adapter already routes all features, but verification gates the
rollout: Try-On is the feature with a known, reproducible defect (tucked-in shirt), so it
is the proof case. If the full builder text underperforms a targeted rule subset on Try-On,
fall back to a curated rules excerpt in the adapter before continuing to later phases.
(The final consolidated smoke test + parity matrix run in Phase 7.)

## Success Criteria

- [ ] Generating in Grok/GPT Try-On sends a prompt containing the garment rules (verify via
      a unit/integration test that stubs the service and asserts the prompt argument).
- [ ] Textarea still displays only the user's raw prompt after submit.
- [ ] AI Editor path sends the raw prompt (adapter passthrough).
- [ ] Existing provider-hook tests still pass (update any that assert the raw prompt is sent).
- [ ] `npx tsc --noEmit`, `npm run lint` clean.

## Risk Assessment

- **Stale closure**: forgetting `activeFeature` in the deps array would compose for the wrong
  feature after a switch. Mitigation: explicit deps update is a numbered step + reviewed.
- **Existing tests asserting raw prompt**: provider hook/service tests may assert the exact
  prompt sent. Mitigation: update those assertions in this phase to expect the composed prompt
  (or assert a contained rule phrase rather than full equality).
