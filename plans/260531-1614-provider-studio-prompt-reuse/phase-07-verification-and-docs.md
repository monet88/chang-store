---
phase: 7
title: "Verification, Parity Matrix and Docs"
status: complete
priority: P2
effort: "3h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verification, Parity Matrix and Docs

## Verification Results (2026-05-31)

- **Quality gates:** `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run test` ✅
  (669 tests, 61 files).
- **Gemini isolation:** `gitnexus_detect_changes` → no indexed-symbol changes;
  `git diff --stat` confirms all changes confined to `components/studios/`,
  provider hooks, provider utils, and locales. Gemini builders reused read-only.
- **Live empirical smoke test (Try-On, default prompt, BOTH providers):** ran the
  real adapter + real provider edit service against the local proxy
  (`scripts/provider-tryon-smoke.ts [grok|gpt|both]`). Composed default prompt
  contains "never tucked in" (length 2633). Results verified via vision model:
  - **Grok** (`grok-imagine-image-quality`): 1 image in ~9s — outfit applied,
    top untucked, no distortion.
  - **GPT Image** (`gpt-image-2`): 1 image in ~122s — outfit applied, top
    untucked, no distortion (slow, matches the 60-90s warning).
  Both confirm the tucked-in defect is resolved by the reused builder rules; no
  fallback to a curated rule excerpt needed (red-team F1/F3 cleared).
- **Parity matrix:** added to `docs/ARCHITECTURE.md`. Capabilities 1–11 ticked
  across both providers (upscale ⚠️ on GPT via preservation prompt); 12–14
  (Lookbook variations/close-ups, auto-describe) documented as a deferred subset.

## Overview

Final phase: run full quality gates, produce a Gemini-vs-provider **parity matrix** proving
each capability is covered (or documenting an API-constrained equivalent), run the live Grok
Try-On before/after smoke test, and update docs.

## Requirements

- Functional: A parity matrix table (capability × Gemini × Grok × GPT Image, status + notes)
  lives in docs and is fully ticked or has a documented constraint.
- Functional: Unit tests exist for the adapter, the new hook behaviors (refine/upscale/
  regenerate/batch/multi-person), and the Lookbook branch.
- Functional: Live empirical smoke test confirms the Try-On tucked-in defect is resolved with
  the DEFAULT prompt.
- Non-functional: All gates pass; Gemini pipeline untouched (verified via `gitnexus_detect_changes`).

## Related Code Files

- Create: `__tests__/utils/provider-studio-prompt-adapter.test.ts` (if not already from P1/P3)
- Modify/extend: `__tests__/hooks/useGrokStudio.test.tsx`, `useGptImageStudio.test.tsx`
- Modify (docs): `docs/ARCHITECTURE.md` (provider parity architecture),
  `docs/CHANGELOG.md`, `docs/product/*` provider studio notes, plan plan.md (mark complete)

## Implementation Steps

1. Run `npx tsc --noEmit`, `npm run lint`, `npm run test`; fix until green.
2. Build the parity matrix in `docs/ARCHITECTURE.md` (capability × provider, with notes for
   any API-constrained items, e.g. GPT prompt-based upscale, ref-image caps).
3. Live smoke test (browser via Playwright): Grok Try-On, DEFAULT prompt, people.jpg +
   outfit-2.jpg → confirm untucked, capture timing + before/after.
4. Spot-check one workflow per new capability per provider (refine, upscale, batch, multi-person,
   Lookbook style change).
5. `gitnexus_detect_changes()` — confirm zero Gemini symbol changes; scope limited to provider
   studio files + tests + docs.
6. Update `docs/CHANGELOG.md`; mark plan phases complete via `ck plan check`.

## Success Criteria

- [x] `npm run test`, `npx tsc --noEmit`, `npm run lint` all pass.
- [x] Parity matrix complete; every capability ticked or documented as constrained.
- [x] Live Try-On default-prompt result is untucked on BOTH providers (Grok + GPT, captured).
- [x] `gitnexus_detect_changes()` shows no Gemini-symbol changes.
- [x] Docs updated (`ARCHITECTURE.md`, `CHANGELOG.md`).

## Risk Assessment

- **Test brittleness**: assert contained rule phrases, not full prompt equality.
- **Matrix reveals true gaps**: if a capability proves infeasible on a provider, document the
  constraint + closest equivalent rather than faking parity (honesty over green checkmarks).
