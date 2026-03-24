# Retrospective

## Cross-Milestone Trends

- Tight, feature-scoped milestones keep delivery speed high in this SPA.
- Hook-owned orchestration continues to scale better than pushing workflow logic into shared services too early.
- Verification hygiene still needs to happen inside phase execution; retroactive audit cleanup adds avoidable overhead.
- Structural/infra phases execute faster when planned as one-pass cutover rather than staged bridge migrations.

---

## Milestone: v1.2 — src/ Source Root Migration

**Shipped:** 2026-03-24
**Phases:** 1 | **Plans:** 1 | **Tasks:** 4

### What Was Built
- Moved all runtime source (components, hooks, contexts, services, utils, locales, config, entry files) from repo root into `src/` in one pass.
- Retargeted `@` alias to `src/` across TypeScript (`tsconfig.json`), Vite (`vite.config.ts`), and Vitest (`vitest.config.ts`).
- Updated browser entry in `index.html` to point at `/src/index.tsx`.
- Rewrote all 23 test files' import paths and `vi.mock()` calls to target the migrated `src/` tree.
- Synced all docs and agent guidance (AGENTS.md, CLAUDE.md, README.md, codebase maps, planning files, .github/copilot-instructions.md).

### What Worked
- One-pass cutover (D-07) was the right call — no bridge files, no intermediate dual-source state, no import churn from staged approach.
- Planning the migration as one integrated plan with 4 internal tasks (move → retarget → docs → validate) made execution clean and atomic.
- Pre-existing test failures (4) and type errors (9) were explicitly scoped out, preventing scope creep into unrelated fixes.

### What Was Inefficient
- Windows `git mv` for directories fails with "Permission denied" — had to use `Copy-Item + Remove-Item` PowerShell workaround. Worth documenting this upfront for future file migrations on Windows.
- `npm run test -- --run` caused a duplicate `--run` flag error because `package.json` already includes `--run` in the test script. Future plans should document to use `npm run test` directly.

### Patterns Established
- `src/` is now the canonical application root. All future phases should reference `src/` paths.
- `@/* → src/` is the stable import alias across all tool surfaces — do not regress.
- Doc sync is a first-class task, not an afterthought — stale agent guidance causes cascading confusion across AI-assisted work.

### Key Lessons
- A structural refactor touching 150 files across aliases, configs, test imports, and docs takes ~20 min when planned correctly. The ROI from better project layout is front-loaded.
- Include `.github/copilot-instructions.md` explicitly in the scope of future doc-sync phases — it was missed in the initial plan scope and required a Rule 2 deviation fix.

### Cost Observations
- Model mix: sonnet for planning + executor.
- Sessions: 1 execution session, ~20 min end-to-end.
- Notable: Zero new TS errors or test regressions introduced by the migration.

---

## Milestone: v1.1 — Batch Try-On & Clothing Transfer

**Shipped:** 2026-03-22
**Phases:** 1 | **Plans:** 1

### What Was Built
- Added bounded-parallel batch subject processing to Virtual Try-On with shared outfit reuse.
- Added bounded-parallel batch concept processing to Clothing Transfer with concept-first request assembly.
- Added a shared batch rail, per-item progress states, partial-failure isolation, and localized copy for both features.
- Preserved the existing single-image paths and added hook/component regression coverage for the new contract.

### What Worked
- Keeping the existing `Component -> Hook -> Service` boundary avoided service churn and kept provider contracts stable.
- Shared utilities (`run-bounded-workers` and batch-session remapping) prevented duplicate logic across the two feature flows.

### What Was Inefficient
- v1.1 requirements were tracked in `PROJECT.md` instead of a standalone `REQUIREMENTS.md`, so archival had to be reconstructed manually.
- Nyquist validation evidence was added at milestone completion instead of during phase execution.

### Patterns Established
- Shared bounded worker pools are now the default client-side pattern for parallel image processing features.
- Batch result review works better as a focused item rail than as one flat output grid.

### Key Lessons
- If a milestone adds parallel fan-out, create validation and traceability artifacts in the same phase instead of retrofitting them during archive.

### Cost Observations
- Model mix: mostly local code/test execution on top of the existing Vitest/Vite toolchain.
- Notable: scope stayed clean because batching applied to the source image list only, not outfit/reference cross-products.

---

## Milestone: v1.0 — v1.0 MVP

**Shipped:** 2026-03-16
**Phases:** 5 | **Plans:** 5

### What Was Built
- Multi-Image Session Foundation: Built Upscale session state, multi-image selection, and internal step shell.
- Quick Upscale Quality Lane: Implemented the 2K/4K Quick Upscale lane and comparison behavior.
- AI Studio Analysis And Prompt Package: Implemented Gemini analysis service, report schema, and per-image prompt package output.
- AI Studio Inline Upscale Preview Guidance And Reliability: Added AI Studio inline upscale, preview, Gemini guidance, and reliability handling.
- Nyquist Validation & Verification Compliance: Closed gaps from audit by creating `VERIFICATION.md` and `VALIDATION.md` and updating `SUMMARY.md` across all phases.

### What Worked
- A tight scoping to Gemini-only logic allowed features to advance rapidly without getting bogged down by complicated multi-provider integrations for advanced Studio reports.
- Component structural decomposition around `Upscale` into `useUpscale`, `UpscaleQuickPanel`, and `UpscaleOutputPanel` led to much cleaner, isolated UI modes.

### What Was Inefficient
- We missed some formal Nyquist compliance verification steps as we went, which required a final "mop up" phase (05) purely to satisfy the milestone validation requirements.

### Patterns Established
- Localised hook `useUpscale` handling session orchestration rather than putting it all into an overarching context too early.
- Separating `quickResult` and `studioResult` to tightly isolate Quick Upscale behavior from AI Studio workflow.

### Key Lessons
- Formal verification artifacts (`VERIFICATION.md` and `VALIDATION.md` frontmatter) should be strictly generated within each phase execution's lifecycle to prevent milestone audit gaps.

### Cost Observations
- Model mix: Mostly Opus for planning and execution, Sonnet for validation execution.
- Notable: Great velocity when the requirements scope was proactively constrained out-of-the-gate to be Gemini-only.
