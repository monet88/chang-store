# Changelog

## [Unreleased] — 2026-07-01

### Removed

- Vertex gateway moved to a separate repo (https://github.com/monet88/vertex-gateway). Removed the local `gateway/` source, root `docker-compose.yml`, and the `gcp/` Cloud Run deployment artifacts (bootstrap/deploy scripts, Cloud Build config, env example, rollout plan). Run the gateway and its Cloud Run deploy from the new repo; app API usage and feature behavior are unchanged.

## [Unreleased] — 2026-06-02

### Added

- Vertex CLI Proxy Toggle for Gemini settings and runtime routing: a new Settings modal section stores `vertexProxySettings` (`enabled`, `url`, `apiKey`) in localStorage with fail-closed restore validation, browser warning copy, and exact `@google/genai` proxy client wiring through `httpOptions.baseUrl` + `apiVersion: 'v1beta'`.
- Proxy-aware Gemini text-to-image generation path: `generateImageFromText()` uses `models.generateContent()` with `responseModalities: [IMAGE]`, inlineData parsing, one-request-per-image loop, and 30s proxy request timeout.
- Cloud Run deployment artifacts under `gcp/`: a bootstrap script for APIs / Artifact Registry / runtime service account / Secret Manager, a deploy script for Cloud Run, and a rollout plan tied to the current GCP project context.

### Changed

- Gemini model defaults now align with the tested Vertex gateway list: image edit and image generation default to `gemini-3.1-flash-image`; text generation defaults to `gemini-3.5-flash`; Pro text uses `gemini-3.1-pro-preview`.
- Gateway image upscale now also falls back to the stable default image model `gemini-3.1-flash-image` instead of the old preview alias, keeping local app, gateway runtime, and rollout docs consistent.
- Removed app and gateway support for retired Google image generation paths and fallback metadata. Gemini image generation now stays on the Gemini image models in `src/config/modelRegistry.ts`.
- Removed Gemini video generation service and tests because video workflows are not part of the supported model set.
- Expanded verification coverage for proxy client wiring, settings persistence, Gemini image generation, and model-default migration.

## [Unreleased] — 2026-05-31

### Added

- Provider studio UI parity with Gemini (Phases 1–4 checkpoint, plan
  `260531-2132-provider-studio-ui-parity`): extracted a shared
  `ProviderStudioShell` + `ProviderStudioController` so Grok and GPT studios no
  longer duplicate layout; stepped, rounded-card panels (Upload → Customize →
  Generate) via `StepPanel` + shared `provider-studio-styles`; Gemini-style
  per-item source cards (`ProviderSourceItemCard`/`Grid`) with centralized
  index-aligned add/remove/update helpers in `useProviderStudioFields`; and a
  Multi-Model / Wardrobe toggle backed by a service-agnostic
  `useProviderWardrobe` engine (GPT capped at 2 sets, concurrency 1, with a time
  warning). Provider results remain local-only; the Gemini pipeline is
  untouched.
- Provider Lookbook rich output (Phase 5): a provider-specific
  `ProviderLookbookOutput` with main / variations / close-up tabs and a
  refinement version history, driven by a service-agnostic
  `useProviderLookbookOutput` engine (GPT capped at 1 variation, serial). Built
  on the shared lookbook prompt builders; the Gemini `LookbookOutput` stays a
  visual reference only and is unchanged.
- Hook-scoped boundary test forbidding `src/services`/`src/config` imports in
  shared `src/hooks/useProvider*.ts` helpers, and an en/vi locale key-parity
  test to prevent silent translation drift.

### Docs

- Resynced `docs/` to current codebase truth (story US-002,
  `E02-docs-harness-sync`).
- Added `docs/product/provider-studios.md` documenting the three-provider
  studio split (Gemini / Grok / GPT Image), provider service contracts, and
  isolation rules.
- Corrected `docs/product/overview.md` and root `README.md` from "Gemini-only"
  to the three-provider model.
- Rewrote the `docs/HARNESS_COMPONENTS.md` File Inventory and NexAU map to match
  real tracked files; removed upstream harness-template leftovers
  (`Cargo.*`, `crates/*`, `PHASE2.md`, `docs/demo/*`, installer/release scripts,
  and stale story trees).
- Updated `codebase-summary.md`, `system-architecture.md`, `project-roadmap.md`,
  and `docs/README.md` to include Studio Modes and provider services.
- Removed unwired `useSwapFace` and `useInpainting` hooks plus their locale keys;
  closed Harness backlog item #2.

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
- Brought the Grok and GPT Image studios to feature parity with Gemini: provider
  studios now reuse the Gemini prompt builders (garment/preservation rules) via
  `provider-studio-prompt-adapter.ts`; add per-source-item type/note, dedicated
  background and extra-instruction fields; refine, upscale (2K/4K), and
  regenerate-single per result tile; multi-person red-dot targeting and batch
  subjects (bounded concurrency); and the full Lookbook control surface
  (style/garment/fabric/negative). See the parity matrix in `docs/ARCHITECTURE.md`.
  Lookbook variations/close-ups and auto-describe are deferred as a documented
  subset. The Gemini pipeline is unchanged (builders reused read-only).

### Changed

- Hardened the global a11y surface (2026-05-31): `LanguageProvider` now
  mirrors the active locale onto `document.documentElement.lang` so screen
  readers pronounce VI strings with VI phonemes; added a Vietnamese-first
  skip-to-main-content link as the first focusable child of the app shell;
  added a global `:focus-visible` rule that paints a 2px amber outline on
  every interactive element (button, input, textarea, select, anchor,
  role=button, tabindex). Fixed two axe violations: `aria-expanded` on the
  MentionTextarea is now declared with `role=combobox`; `aria-label` on the
  decorative ImageUploader chip and ProviderResultsGrid container now have
  matching `role` values.
- Bumped touch targets to ≥44 px across every segmented control
  (StudioModeSwitch, LanguageSwitcher, AspectRatioSelector, QualitySelector,
  ResolutionSelector, VirtualTryOn mode toggle, PoseChanger and
  BackgroundReplacer camera-view pickers, ImageUploader library button,
  WardrobeSetCard / VirtualTryOn primary+secondary buttons, the pose
  browse-library button, and the studio utilities dock toggle). Used literal
  `min-h-[44px]` arbitrary values because the project sets html font-size to
  12 px in `src/index.css`, which silently shrinks rem-based utilities.
- Tightened heading hierarchy: 8 Gemini feature components had nested `<h2>`
  duplicates with the App.tsx feature heading; demoted to `<h3>`. Pruned
  three eyebrow scaffolds from the sidebar (Studio label, Tool clusters,
  Media-first badge, Language label) and three uppercase tracked button
  labels in ClothingTransfer. The sidebar now keeps one deliberate
  "Workspace" kicker on the brand block instead of the eyebrow-on-every-
  section AI grammar pattern.
- Distilled iconography density: dropped the decorative `MagicWandIcon`
  inside the RefinementInput textarea (the field already labels itself via
  placeholder + adjacent Refine button); recolored the HoverableImage
  send-to-album button from purple to the standard zinc/black-on-white
  hover treatment used by the surrounding gallery actions, restoring the
  single-accent contract.
- Added `loading="lazy" decoding="async"` to 8 thumbnail-style `<img>` tags
  (ClothingTransfer concept previews, VirtualTryOn subject previews,
  GoogleDriveSettings avatar, ImageSelectionModal grid items,
  PoseLibraryModal grid thumbnails, PredefinedBackgroundSelector tiles).
  Reduced Header sidebar `backdrop-blur` from 2xl (40px) to md (12px) to
  cut paint cost on the always-visible chrome.
- Improved the GalleryModal empty state from a single muted text line to an
  icon-chip + heading + description composition, reaching parity with the
  product-register empty-state contract.
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
- Hardened provider-studio concurrency: full generate, batch generate, and
  per-tile actions are now mutually exclusive; result updates merge onto the
  latest state instead of a stale snapshot; and Lookbook controls now expose
  folded-presentation and product-shot subtypes plus accessory/footwear
  toggles.
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
