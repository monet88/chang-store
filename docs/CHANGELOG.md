# Changelog

## [Unreleased] — 2026-05-30

### Added

- Installed Harness v0 documentation and durable-state structure.
- Added project-specific `AGENTS.md` instructions for chang-store agents.
- Added `docs/product/*` operational product contracts for every current
  `Feature` enum value.
- Added backfilled docs for deployment, design, roadmap, codebase summary, PDR,
  and system architecture.
- Added high-risk story packet and short API planning notes for the planned
  three-provider studio work.

### Changed

- Replaced generic architecture scaffold with actual React/Vite SPA architecture
  in `docs/ARCHITECTURE.md`.
- Updated `docs/README.md` and `docs/product/README.md` to reflect the current
  documentation map.
- Documented known service-boundary debt for `useWatermarkRemover.ts`.
- Corrected the three-provider studio plan to use official xAI/OpenAI request
  contracts and `ApiProviderContext` ownership for provider settings.

### Removed

- Retired stale bulk API reference docs from `docs/api/` as part of Harness docs
  restructuring. Gemini integration remains documented through architecture,
  deployment, and service-boundary docs.

## Historical Summary

Prior docs recorded these major milestones:

- v1.0: initial Gemini-powered fashion studio features.
- v1.2-v1.5: model registry, Drive-backed gallery, Runway UI redesign, and
  feature-level refinements.
- v1.0.4: production Gemini API key injection fix and session hydration
  hardening.

Use git history for exact pre-Harness entries if detailed archaeology is needed.
