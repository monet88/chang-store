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
- Added the three-provider studio split: a header studio switch routes between
  the Gemini studio (default) and isolated Grok and GPT Image studios. Each
  provider studio supports five workflows (Virtual Try-On, Lookbook, Clothing
  Transfer, Pattern Generator, AI Editor) through provider-specific hooks and
  services.
- Added shared provider infrastructure: `ProviderSettingsPanel`,
  `ProviderResultsGrid`, OpenAI-compatible response parser, bounded `withRetry`
  with exponential backoff + jitter and `AbortSignal` support, prompt
  validation, base URL allowlist validation, and a typed `ProviderApiError`.
- Extended `ApiProviderContext` with per-provider settings (env defaults plus
  namespaced localStorage overrides).
- Injected `GROK_API_KEY`, `GROK_BASE_URL`, `GPT_IMAGE_API_KEY`, and
  `GPT_IMAGE_BASE_URL` (with `VITE_`-prefixed fallbacks) in `vite.config.ts`.

### Changed

- Polished the global chrome via `/impeccable polish` (2026-05-31): the
  Tailwind `slate-*` ramp was migrated to `zinc-*` across 18 components for
  a single neutral family; the amber/orange brand ramp was extracted into
  `--brand-50`-`--brand-900`, `--brand-glow`, and `--brand-gradient` CSS
  variables; the ad-hoc `z-10 / 20 / 30 / 40 / 50 / [52] / [60] / [100]`
  ladder was replaced with a semantic z-index scale
  (`--z-index-dropdown` through `--z-index-tooltip`) plus matching
  `@utility z-*` classes; and the duplicated primary-CTA gradient is now
  expressed once via the `brand-button` utility, replacing 3 hand-rolled
  callsites.
- Provider base URL validation now accepts both `http:` and `https:` so local
  proxies (for example `http://localhost:8333/v1`) can be used during
  development. Non-allowlisted hosts still surface a "key will be sent to
  <host>" warning. Removed the `urlNotHttps` i18n key and the corresponding
  branch in `ProviderSettingsPanel`.
- Extended `vite.config.ts` watcher ignores with `**/.kiro/**` and
  `**/.gitnexus/**` to prevent ENOSPC under heavy local tooling.
- Replaced generic architecture scaffold with actual React/Vite SPA architecture
  in `docs/ARCHITECTURE.md`.
- Updated `docs/README.md` and `docs/product/README.md` to reflect the current
  documentation map.
- Documented known service-boundary debt for `useWatermarkRemover.ts`.
- Corrected the three-provider studio plan to use official xAI/OpenAI request
  contracts and `ApiProviderContext` ownership for provider settings.
- The app is no longer Gemini-only at runtime: Grok and GPT Image studios ship
  alongside the existing Gemini pipeline, which remains fully isolated.

### Security

- Provider API keys are injected into the client bundle and stored in
  localStorage. Accepted for v1 — base URLs are validated against an allowlist
  (`api.x.ai`, `api.openai.com`) and custom HTTPS domains surface a warning that
  the key will be sent there. A serverless proxy is planned for v2.

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
