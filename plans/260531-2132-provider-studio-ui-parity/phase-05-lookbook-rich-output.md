---
phase: 5
title: "Lookbook Rich Output"
status: pending
priority: P3
effort: "2d"
dependencies: [1]
---

# Phase 5: Lookbook Rich Output

## Overview

Bring provider Lookbook output to Gemini parity: instead of a flat results grid, show a
multi-stage output — main image, variations, optional close-up, and a refinement version
history — driven by a provider-side engine. The input controls (`ProviderLookbookControls`)
are already at parity; this phase is about the OUTPUT stage.

## Requirements

- Functional: after generating a lookbook, the user can request variations and a close-up
  crop, and iteratively refine with a version history they can step back through — all
  local-only, using provider services.
- Non-functional: create a provider-specific `ProviderLookbookOutput` using
  `LookbookOutput` only as a visual reference; no Gemini component changes and no Gemini service calls.

## Architecture

Gemini's `useLookbookGenerator` owns variations/close-up/refinement version history and
calls `editImage` + `textService`. `LookbookOutput.tsx` is presentational but expects that
result shape.

Plan:
- New `src/hooks/useProviderLookbookOutput.ts` — owns `main`, `variations[]`, `closeUp`,
  and a `versions[]` refinement history with a current index. Takes `generateVariation`,
  `generateCloseUp`, `refine` callbacks from the studio hook (service calls stay in the
  studio hook for boundary safety).
- New `ProviderLookbookOutput.tsx` for provider rich output. Use `LookbookOutput.tsx` only
  as a visual reference; do not generalize or modify Gemini's output component for this phase.
- Variations = N additional edit calls with varied prompts; close-up = an edit with a
  crop/zoom instruction; refine = edit-on-result feeding back as source (same pattern as
  `useProviderResultActions`).
- Studio hook composes `useProviderLookbookOutput` only for `Feature.Lookbook`; supplies
  the three callbacks built on `buildProviderStudioPrompt` + provider service.
- GPT: cap variation count at exactly 1, run serially, and surface a prominent time warning.
- This P3 phase can ship after Phases 1-4 as a follow-up if the earlier checkpoint is green.

## Related Code Files

- Create: `src/hooks/useProviderLookbookOutput.ts`
- Create: `src/components/studios/provider-studio/ProviderLookbookOutput.tsx`
- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts` (compose for Lookbook)
- Modify: `src/components/studios/provider-studio/ProviderStudioShell.tsx` (render rich output for Lookbook)
- Read: `src/hooks/useLookbookGenerator.ts`, `src/components/LookbookOutput.tsx` (reference)

## Implementation Steps

1. Inspect `LookbookOutput.tsx` markup for visual reference only; create a separate
   `ProviderLookbookOutput` API for provider data/callbacks.
2. Build `useProviderLookbookOutput(callbacks, { maxVariations })`: state for main,
   variations, close-up, version history (current index, push/step-back), busy flags.
3. In studio hooks, add `generateVariation/generateCloseUp/refine` built on
   `buildProviderStudioPrompt` + `provider-refine-prompt` + the provider service.
4. Render the rich output for `Feature.Lookbook` in the shell, replacing the flat grid.
5. GPT: cap variations at 1, show time warning, use serial execution.
6. Reset lookbook output on feature/studio switch.
7. Run tsc, lint, boundary test.

## Success Criteria

- [ ] Provider Lookbook shows main + variations + optional close-up + refinement history.
- [ ] Refinement version history can step back/forward.
- [ ] All output generated via provider services (no Gemini calls); local-only.
- [ ] GPT variation count capped at 1; time warning shown.
- [ ] `npx tsc --noEmit` clean; lint clean; boundary test passes.

## Risk Assessment

- Risk: `LookbookOutput` too coupled to Gemini shape. Mitigation: create a provider-specific
  output component reusing its markup rather than forcing reuse.
- Risk: GPT cost/time from variations. Mitigation: cap GPT variations at 1, serial execution, warning.
- Risk: this is the deepest phase — can be deferred. Mitigation: independent of Phases 3/4;
  plan allows shipping 1-4 first and 5 later.
