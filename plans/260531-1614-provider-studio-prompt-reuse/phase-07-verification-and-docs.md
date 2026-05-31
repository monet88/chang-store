---
phase: 7
title: "Verification, Parity Matrix and Docs"
status: pending
priority: P2
effort: "3h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verification, Parity Matrix and Docs

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

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint` all pass.
- [ ] Parity matrix complete; every capability ticked or documented as constrained.
- [ ] Live Grok Try-On default-prompt result is untucked (before/after captured).
- [ ] `gitnexus_detect_changes()` shows no Gemini-symbol changes.
- [ ] Docs updated (`ARCHITECTURE.md`, `CHANGELOG.md`, provider studio docs).

## Risk Assessment

- **Test brittleness**: assert contained rule phrases, not full prompt equality.
- **Matrix reveals true gaps**: if a capability proves infeasible on a provider, document the
  constraint + closest equivalent rather than faking parity (honesty over green checkmarks).
