---
phase: 4
title: "Wardrobe Mode for Providers"
status: pending
priority: P2
effort: "2d"
dependencies: [1, 3]
---

# Phase 4: Wardrobe Mode for Providers

## Overview

Add the Multi-Model / Wardrobe mode toggle to provider Try-On and implement a provider
wardrobe engine (sets × items, per-set batch) mirroring Gemini's `useWardrobeMode`,
reusing the fully-presentational `WardrobeSetCard`.

## Requirements

- Functional: Try-On shows a Multi-Model / Wardrobe toggle. Wardrobe mode lets the user
  build up to N sets, each with up to M items (image + type + note), plus a single subject
  and background/extra prompt; generation runs each set as its own request and groups
  results per set.
- Non-functional: respect provider request constraints (Grok n-slider; GPT slow/serial).
  Cap GPT Wardrobe at 2 sets, run GPT concurrency at 1, and show a prominent time warning.

## Architecture

Gemini's `useWardrobeMode` (sets max 4, items max 4, `runBoundedWorkers` concurrency 4)
calls `editImage` directly — not reusable in providers (service import). Build a provider
analog:

- New `src/hooks/useProviderWardrobe.ts` — owns `sets: WardrobeSet[]`, `subject`,
  `backgroundPrompt`, `extraPrompt`, per-set results, generating/error/progress. Takes a
  `generateSet(subject, items, signal)` callback supplied by the studio hook (which builds
  the prompt via `buildProviderStudioPrompt` and calls the provider service). This keeps
  the service import inside the studio hook, not the wardrobe hook (boundary-safe).
- Concurrency: reuse `runBoundedWorkers`; default 4 for Grok, exactly 1 for GPT (pass as param). GPT max sets = 2.
- `WardrobeSetCard` reused as-is (presentational). Subject uploader via `ImageUploader`.
- Studio hook (`useGrokStudio` / `useGptImageStudio`) gains a `tryOnMode: 'multi-model' | 'wardrobe'`
  and composes `useProviderWardrobe`, passing a `generateSet` that maps a set's items into the
  `images[]` + source arrays shape the prompt adapter expects.
- `ProviderStudioShell` (or a `ProviderTryOnSection`) renders the mode toggle and switches
  between the multi-model layout (Phase 3 cards + batch subjects from `ProviderTryOnExtras`)
  and the wardrobe layout (sets of `WardrobeSetCard` + subject + prompts).

## Related Code Files

- Create: `src/hooks/useProviderWardrobe.ts`
- Create: `src/components/studios/provider-studio/ProviderWardrobePanel.tsx`
- Modify: `src/hooks/useGrokStudio.ts` (add `tryOnMode`, compose wardrobe, supply `generateSet`)
- Modify: `src/hooks/useGptImageStudio.ts` (same; low concurrency)
- Modify: `src/components/studios/provider-studio/ProviderStudioShell.tsx` (mode toggle + switch)
- Reuse: `src/components/WardrobeSetCard.tsx`, `src/utils/run-bounded-workers.ts`
- Read: `src/hooks/useWardrobeMode.ts` (engine reference)

## Implementation Steps

1. Build `useProviderWardrobe(generateSet, { maxSets, maxItems, concurrency })`: set/item
   CRUD (id counters), subject, background/extra, per-set results, `runBatch` via
   `runBoundedWorkers`, abort support.
2. In the studio hooks, add `tryOnMode` state and a `generateSet(subject, items)` that
   composes the prompt (subject + items as source array) and calls the provider service.
   Pass concurrency 4 (Grok) / 1 (GPT) and maxSets 2 for GPT.
3. Build `ProviderWardrobePanel` reusing `WardrobeSetCard` + subject uploader + prompt
   fields + per-set results grid (`ProviderResultsGrid`).
4. Add the Multi-Model / Wardrobe toggle to the Try-On section in the shell; render the
   correct panel per mode.
5. Reset wardrobe state on feature/studio switch (extend the existing reset effect).
6. Test both providers; for GPT surface the time warning and keep concurrency minimal.
7. Run tsc, lint, boundary test.

## Success Criteria

- [ ] Try-On shows Multi-Model / Wardrobe toggle in both providers.
- [ ] Wardrobe builds sets × items, generates per set, groups results per set.
- [ ] GPT wardrobe caps at 2 sets, uses concurrency 1, and shows a time warning.
- [ ] Gemini wardrobe untouched; `useWardrobeMode` not modified.
- [ ] `npx tsc --noEmit` clean; lint clean; boundary test passes.

## Risk Assessment

- Risk: GPT timeout storms from parallel slow calls. Mitigation: max 2 sets, concurrency 1 for GPT,
  prominent warning, abort on unmount.
- Risk: boundary violation if wardrobe hook imports services. Mitigation: wardrobe hook is
  service-agnostic; takes a `generateSet` callback from the studio hook.
- Risk: state reset gaps on feature switch. Mitigation: extend existing abort/reset effect
  to clear wardrobe sets.
