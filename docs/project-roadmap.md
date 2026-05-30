# Project Roadmap

Living roadmap for chang-store. Backfilled from current codebase and prior docs
on 2026-05-30.

## Phase 1: Core Foundation — Completed

- React + TypeScript + Vite SPA.
- Gemini-only AI provider integration.
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

## Phase 5: Advanced AI Capabilities — Future

- Video rendering or animation based on generated photos.
- Multi-model comparison workflows.
- Personalized fashion recommendations based on user history.
- More robust batch orchestration and recovery.

## Current Documentation Milestone

Harness v0 installed and docs backfilled:

- `AGENTS.md` project instructions.
- `docs/product/*` feature contracts.
- `docs/ARCHITECTURE.md` and `docs/system-architecture.md` architecture docs.
- `docs/code-standards.md`, `docs/deployment-guide.md`, and design docs.
