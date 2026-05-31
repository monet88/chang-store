---
phase: 6
title: "Lookbook Control Surface and Auto-Describe"
status: pending
priority: P2
effort: "6h"
dependencies: [1]
---

# Phase 6: Lookbook Control Surface and Auto-Describe

## Overview

Bring provider Lookbook to parity with Gemini Lookbook: expose the full control surface
(style, garment type, fabric texture/description, negative prompt) plus variations, close-ups,
and auto-describe-clothing — instead of forcing a single hardcoded style. The prompt text all
comes from the existing `lookbookPromptBuilder`, which already returns a string (no `Part[]`
extraction needed).

## Requirements

- Functional: Provider Lookbook UI lets the user pick `lookbookStyle` (7 options), `garmentType`,
  optional fabric texture image + description, and a negative prompt — same inputs as Gemini.
- Functional: Variations and close-up generation available (reuse `buildVariationPrompt`,
  `buildCloseUpPrompts`, `buildCloseUpNegativePrompt`).
- Functional: Auto-describe clothing via the text model (`generateClothingDescription`),
  routed through the provider's chat/text endpoint if available; otherwise document as a
  Gemini-only assist and hide the button for that provider.
- Non-functional: Reuse `LookbookForm`-style controls or a trimmed provider variant; keep logic
  in the hook. No Gemini changes.

## Architecture

- Adapter Lookbook branch takes a real (user-driven) `LookbookFormState` instead of a forced
  default; `buildLookbookPrompt(formState, images, fabricTextureImage)` returns the prompt.
- Provider hook holds the Lookbook form state (or reuse the existing `LookbookFormState` type).
- Variations/close-ups: loop the provider generate/edit with the builder's variation/close-up
  prompts; collect into result tabs (main/variations/closeup) like Gemini.
- Auto-describe: call the text model via the provider base URL if it exposes a chat endpoint
  (the local proxy does); else feature-flag off per provider.

## Related Code Files

- Modify: `src/utils/provider-studio-prompt-adapter.ts` (Lookbook branch uses real form state)
- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts` (Lookbook form state,
  variations/close-ups, describe)
- Modify: `src/components/studios/GrokStudio.tsx`, `GptImageStudio.tsx` (Lookbook controls;
  consider extracting a shared `ProviderLookbookControls` from `LookbookForm.tsx` patterns)
- Read/reuse: `src/utils/lookbookPromptBuilder.ts` (all build fns),
  `src/components/LookbookGenerator.prompts.ts` (style/garment/mannequin types),
  `src/hooks/useLookbookGenerator.ts` (form-state + variation/close-up flow),
  `src/services/textService.ts` (`generateClothingDescription`)
- Modify: `src/locales/en.ts`, `src/locales/vi.ts`

## Implementation Steps

1. Add Lookbook form state to the provider hooks (reuse `LookbookFormState`).
2. Update adapter Lookbook branch to consume the real form state.
3. Build provider Lookbook controls (style/garment/fabric/negative) — extract a shared
   presentational component from `LookbookForm.tsx` if feasible, else a trimmed provider copy.
4. Add variations + close-up generation using the builder's prompt functions; add result tabs.
5. Add auto-describe via text endpoint; feature-flag per provider based on endpoint support.
6. i18n (EN + VI); `npx tsc --noEmit`, `npm run lint`; tests for the Lookbook adapter branch.

## Success Criteria

- [ ] Provider Lookbook offers the same style/garment/fabric/negative controls as Gemini.
- [ ] Variations and close-ups generate and display in tabs.
- [ ] Auto-describe works where the provider exposes a text endpoint (else documented off).
- [ ] Composed Lookbook prompt matches the user-chosen style (not a forced default).
- [ ] `npx tsc --noEmit`, `npm run lint` clean; Lookbook adapter tests pass.

## Risk Assessment

- **Largest UI surface to port**. Mitigation: extract/share `LookbookForm` presentation; keep
  business logic in the hook.
- **Auto-describe needs a text model**: not guaranteed on every provider base URL. Mitigation:
  feature-flag per provider; the local proxy supports chat so it works there.
- **Variations multiply cost/latency**: many provider calls. Mitigation: cap variation count;
  reuse bounded workers.
