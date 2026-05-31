---
phase: 1
title: "Research and Shared Foundation"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Research and Shared Foundation

## Overview

Extract the duplicated `GrokStudio.tsx` / `GptImageStudio.tsx` layout into one shared
`ProviderStudioShell` component so subsequent richness lands once for both providers.
No behavior change — pure refactor + safety net.

## Requirements

- Functional: Grok and GPT studios render identically to today after the refactor.
- Non-functional: zero duplicated JSX layout between the two studios; boundary rules
  preserved (no `src/services/*` or `src/config/*` imports in components).

## Architecture

Today `GrokStudio.tsx` and `GptImageStudio.tsx` are ~95% identical: header, settings
panel, uploader, source fields, try-on extras, lookbook controls, prompt, options,
results. Only the options block (Grok = model/aspect/resolution/n; GPT = quality/size)
and the hook (`useGrokStudio` vs `useGptImageStudio`) differ.

Design:
- New `src/components/studios/provider-studio/ProviderStudioShell.tsx` — receives the
  resolved studio hook return as a `studio` prop (typed via a shared
  `ProviderStudioController` interface) plus a `providerLabelKey` and an
  `optionsSlot: React.ReactNode` (the provider-specific options block).
- `GrokStudio.tsx` / `GptImageStudio.tsx` become thin: call their hook, build the
  `optionsSlot`, render `<ProviderStudioShell studio={studio} ... />`.
- Define `ProviderStudioController` type as the union/intersection of fields both
  hooks already expose (settings, images, prompt, source fields, try-on batch,
  lookbook, result actions). Place it next to the shell.

## Related Code Files

- Create: `src/components/studios/provider-studio/ProviderStudioShell.tsx`
- Create: `src/components/studios/provider-studio/provider-studio-controller.ts` (shared type)
- Modify: `src/components/studios/GrokStudio.tsx` (reduce to thin wrapper + options slot)
- Modify: `src/components/studios/GptImageStudio.tsx` (reduce to thin wrapper + options slot)
- Read for context: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts`,
  `src/components/studios/provider-studio/*`

## Implementation Steps

1. Read both studio components side by side; diff the JSX to confirm the only deltas
   are the options block and the hook.
2. Define `ProviderStudioController` interface capturing the shared surface both hook
   returns satisfy (reuse the existing `UseProvider*Return` intersections).
3. Create `ProviderStudioShell` taking `{ studio, providerLabelKey, idPrefix, optionsSlot, workflow }`.
   Move all shared JSX in. Keep the right-column results + per-tile actions wiring.
4. Rewrite `GrokStudio.tsx` to call `useGrokStudio`, build the Grok options slot
   (model/aspect/resolution/n), and render the shell.
5. Rewrite `GptImageStudio.tsx` the same way with the GPT options slot (quality/size)
   and the existing ~60-90s time warning banner.
6. Run `npx tsc --noEmit`, `npm run lint`, and the UI boundary test.

## Success Criteria

- [ ] `ProviderStudioShell` renders both studios with no visual change vs current.
- [ ] No duplicated layout JSX remains across the two studio files.
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `__tests__/components/ui-boundary-imports.test.ts` passes.
- [ ] Existing provider studio tests still pass.

## Risk Assessment

- Risk: subtle prop wiring drift during extraction. Mitigation: refactor first with no
  feature change; rely on existing tests + a manual smoke of one workflow per provider.
- Risk: controller type too loose. Mitigation: derive from existing `UseProvider*Return`
  intersections rather than re-declaring fields.
