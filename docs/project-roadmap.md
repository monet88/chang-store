# Project Roadmap

Living roadmap for chang-store. Backfilled from current codebase and prior docs
on 2026-05-30.

## Phase 1: Core Foundation — Completed

- React + TypeScript + Vite SPA.
- Gemini AI provider integration as the original/default full-featured studio.
- Feature enum routing in `App.tsx`.
- Provider stack for language, API config, Drive sync, gallery, viewer.
- Local gallery persistence with IndexedDB.

## Phase 2: Virtual Studio Features — Completed

- Virtual Try-On.
- Lookbook Generator.
- Background Replacer.
- Pose Changer.
- Photo Album Creator.
- AI Editor.
- Watermark Remover.
- Clothing Transfer.
- Pattern Generator.

## Phase 3: Archive & Export Workflows — Completed

- Gallery persistence.
- Google Drive sync.
- ZIP download flows for batch outputs.
- Image cache and session persistence helpers.

## Phase 4: Refinement & Optimization — In Progress

- Maintain service-boundary consistency across hooks.
- Keep feature components thin and move logic into paired hooks.
- Expand product docs as behavior changes.
- Improve validation coverage for feature flows.
- Continue UI polish and accessibility checks.

## Phase 4b: Three-Provider Studios — In Progress

- Header studio switch across Gemini (default), Grok (xAI), and GPT Image
  (OpenAI). See story `E01-provider-studios/US-001-three-provider-studios`.
- Provider studios cover five workflows each, isolated from the Gemini pipeline.
- Tracked separately because it adds non-Gemini providers, not just Gemini
  refinement.

## Phase 5: Advanced AI Capabilities — Future

- Video rendering or animation based on generated photos.
- Multi-model comparison workflows.
- Personalized fashion recommendations based on user history.
- More robust batch orchestration and recovery.
- Continue removing unwired or obsolete surfaces as they are discovered.

## Current Documentation Milestone

Docs + test/E2E resync to current codebase (2026-07-03):

- Added measured test-suite metrics and coverage (70 files / 725 tests; 74.85% lines) to `docs/codebase-summary.md` and `docs/TEST_MATRIX.md`.
- Documented the live E2E harness (`scripts/e2e-live/run.mts`) that drives all features against the Vertex gateway `https://vertex.monet.uno/gemini`.
- Fixed and documented the Gemini vision `contents` shape bug in `src/services/gemini/text.ts` (gateway `VALIDATION_FAILED`).
- Added a Gemini Proxy / Gateway routing section to `docs/ARCHITECTURE.md` and `docs/deployment-guide.md`.
- Removed stale `gemini/video` module references from architecture docs.

Docs resync to current codebase (story US-002, 2026-05-31):

- Added `docs/product/provider-studios.md` for the three-provider split.
- Corrected `overview.md` from "Gemini-only" to the three-provider model.
- Rewrote `docs/HARNESS_COMPONENTS.md` File Inventory to match real tracked
  files (removed upstream harness-template leftovers).
- Removed `useSwapFace` / `useInpainting` dead code (backlog #2).

Earlier milestone — Harness v0 installed and docs backfilled (2026-05-30):

- `AGENTS.md` project instructions.
- `docs/product/*` feature contracts.
- `docs/ARCHITECTURE.md` and `docs/system-architecture.md` architecture docs.
- `docs/code-standards.md`, `docs/deployment-guide.md`, and design docs.
