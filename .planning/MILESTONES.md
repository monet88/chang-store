# Project Milestones: Chang-Store

## v1.4 Prompt Library (Shipped: 2026-04-02)

**Phases completed:** 2 phases, 4 plans
**Files changed:** 37 | **Lines:** +1,195 / -51
**Timeline:** 2026-04-01 → 2026-04-02

**Key accomplishments:**

- Designed `usePromptLibrary.ts` providing seamless CRUD operations and `localStorage` syncing, establishing a durable store for user prompts.
- Built `PromptLibraryModal.tsx`—a responsive, interactive modal with search functionalities, expanded/collapsed views, and integrated localization (EN/VI).
- Added read-only curated preset prompts on first-load (e.g., *Remove Hand from Pocket*, *Untucked Shirt*, *Combo*) to bootstrap the user experience without setup.
- Enabled users to add their own custom prompts (with titles), edit existing custom prompts, delete them safely, and immediately copy the text directly to the clipboard.
- Reduced friction for prompt reusability by introducing a globally accessible Prompt Library FAB (Floating Action Button). Supported a streamlined, manual Copy-and-Paste flow across all AI image manipulation modules.

---
## v1.3 Virtual Try-On Prompt Optimization (Shipped: 2026-04-01)

**Phases completed:** 2 phases, 5 plans
**Files changed:** 54 | **Lines:** +1,241 / -2,998 (net -1,757)
**Timeline:** 2026-03-24 → 2026-03-28

**Key accomplishments:**

- Rewrote Virtual Try-On prompt builder from text `string` to interleaved `Part[]` for native Gemini compliance
- Added Gemini-only model guard with i18n error messaging across hooks and service facade
- Comprehensive test suite for builder structure, validation, content sections, and hook integration
- Removed all Local Provider and Anti Provider code — Gemini-only architecture (-2,068 lines, 7 files deleted, 34 files cleaned)
- All quality gates green: 468/468 tests passing, zero type errors, zero lint errors

---

## v1.2 src/ Source Root Migration (Shipped: 2026-03-24)

**Phases completed:** 1 phases, 1 plans, 4 tasks

**Key accomplishments:**

- Runtime source tree relocated into src/ with alias retarget, 23 test file import rewrites, and full doc sync — build/lint/test all green

---

## v1.1 Batch Try-On & Clothing Transfer (Shipped: 2026-03-22)

**Phases completed:** 1 phase, 1 plan, 8 tasks

**Key accomplishments:**

- Added bounded-parallel batch processing to Virtual Try-On with shared outfit reuse.
- Added bounded-parallel batch processing to Clothing Transfer with concept-first request assembly.
- Added per-item status, partial-failure isolation, and a shared batch review rail in both features.
- Preserved single-image paths while extending test coverage and localization for the new batch flows.

---

## v1.0 v1.0 MVP (Shipped: 2026-03-16)

**Phases completed:** 5 phases, 5 plans, 7 tasks

**Key accomplishments:**

- (none recorded)
