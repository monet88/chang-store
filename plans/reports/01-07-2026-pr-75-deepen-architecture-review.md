# Review: PR #75 — refactor: deepen architecture (prompt builders, upscale seam, provider engine, refine lifecycle)

**Date**: 2026-07-01  
**Reviewer**: Grok (following local review skill + code-standards)  
**Branch**: refactor/deepen-architecture → main  
**PR**: https://github.com/monet88/chang-store/pull/75 (OPEN)

## Summary of Change (from PR body + inspection)
Four deepening refactors with explicit "no behavior change" claim:
1. Extract prompt builders (pose, background, ai-editor, photo-album) + unify upscale.
2. Collapse Grok/GPT studio twins into `useProviderStudioEngine` + thin driver-injecting hooks.
3. Extract `useImageRefinement` for shared refine lifecycle (TryOn / ClothingTransfer / BackgroundReplacer only).
4. Remove gateway/ + gcp/ + related artifacts (moved to https://github.com/monet88/vertex-gateway); update docs.

**Validation performed (local + CI)**:
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- Targeted: `npm run test -- __tests__/utils/prompt-builders.test.ts __tests__/hooks/useImageRefinement.test.tsx` → 14 passed
- CI: build-and-test (22.x) passed; Vercel preview deployed
- Per PR: full 723 tests (+16), `npm run build` OK

CodeGraph + manual reads used for blast radius and symbol tracing.

## Standards Axis (docs/code-standards.md + ARCHITECTURE.md)
Hard violations:
- `src/hooks/useProviderStudioEngine.ts`: 324 lines (limit 200). Central orchestrator composing many sub-hooks + flows. Extract smaller modules required.
- Several feature hooks still exceed: usePoseChanger 329, usePhotoAlbum 251, useVirtualTryOn 513 (pre-existing), imageEditingService 241.
- useBackgroundReplacer ~201 borderline.

Positive adherence:
- Thin provider studios (useGrokStudio 155, useGptImageStudio 125) — own only options + stable `useMemo<ProviderImageDriver>`.
- Prompt builders are small pure kebab-case utils (<90 LOC).
- `useImageRefinement` (128 LOC) focused deep module.
- Service boundaries respected: engine receives driver (no provider/gemini imports); Gemini hooks use facade; components thin.
- Error handling pattern (`getErrorMessage(err, t)`, try/finally) followed.
- Memoization for drivers/handlers/getSignal addresses prior automated review feedback on render thrash.
- Naming, imports (@/), i18n via t, no inline styles etc. followed.

Automated reviews (gemini-code-assist, cubic) main points addressed in current HEAD (memo + model-clear effect present).

## Spec Axis (PR description contract)
All four core requirements implemented:
- Builders extracted for the named hooks; used by Gemini + via adapter for providers.
- Upscale unified with noun param; `buildUpscalePromptTable('model' | 'subject')` used by service and provider-refine-prompt. Tests assert exact strings for upscale.
- Provider engine + thin drivers: exact match to description.
- Refinement module adopted by the three listed features; Lookbook/Pattern + per-slot upscale intentionally excluded (documented).

Evidence of byte-identical:
- Pure builder functions.
- Upscale tests use `.toBe()` / exact tables.
- Other builders use structural tests; extraction diffs show literal string moves.

Minor observations:
- One builder (`background-replacer-prompt-builder`) trims `promptText` before conditional clause (old did not). Low impact for whitespace-only inputs.
- Supporting files (provider-refine-prompt, wiring) added as necessary but not explicitly listed in summary — not creep.
- No new user-visible behavior or scope beyond stated.

## Files / Modules Changed (non-deletion focus)
- New deep modules: useProviderStudioEngine, useImageRefinement, 6 *-prompt-builder.ts
- Thinned: useGrokStudio, useGptImageStudio
- Updated consumers: PoseChanger, BackgroundReplacer, AIEditor, PhotoAlbum, VirtualTryOn, ClothingTransfer, imageEditingService
- Tests + docs + package.json (gateway:* scripts removed)
- ~100 files total; bulk = gateway + gcp + understand-anything removal (clean, no src/ dangling refs)

Blast radius (CodeGraph): refinement called by 3 hooks; studio hooks called only by their studio components; engine internal composition via stable sub-hooks.

## Architecture / Dependency / Risk
- Strengthens intended shape (thin UI → hook → small interfaces → stateless services / injected drivers).
- Provider isolation preserved (Red Team #2 concern).
- No security impact (no auth/crypto changes, no secrets introduced).
- Perf: memoization improves on previous duplication; abort/reset effects present for studio switches.
- Concentrated risk now in engine + refinement; mitigated by new tests + boundary tests (per PR notes).
- Gateway removal: external consumers must now use separate repo. Docs (CHANGELOG, deployment-guide) updated. No tracked gateway files remain.

## Recommendation
**Approve** (with note).

The refactor successfully deepens the architecture per spec with clean boundaries and passing gates. Primary follow-up: split `useProviderStudioEngine.ts` (and address other >200-line hooks opportunistically) to restore compliance with code-standards line limits.

Residual risk: low (byte-identical claim holds for critical paths; trim edge case cosmetic).

Existing automated review feedback has been incorporated.

---
*Generated as part of PR review on 01-07-2026. Use `git diff origin/main...HEAD` and the sub-agent reports for deeper drill-down.*