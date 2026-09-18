# Changelog

## [Unreleased] — 2026-09-18

### Added

- A studio-scoped image engine (`src/contexts/ImageEngineContext.tsx`): feature
  hooks take their driver, model and generation options from it, so the same
  Try-On, Lookbook, Clothing Transfer, AI Editor and Identity Transfer engines
  run on either lane. The GPT lane implements the contract in
  `src/services/providers/gpt-image/gptImageEngine.ts` — a requested ratio maps
  to the pixel size the active (gateway, model) pair actually honors, and a
  refine becomes one stateless preservation-wrapped edit.
- A dedicated GPT studio (`src/components/studios/GptStudio.tsx` plus five
  cloned views) with its own generation panel: the ratios the product offers on
  that lane, the pixel size each resolves to, and the quality — each shown only
  when the capability says the gateway honors it.
- Gallery results carry the feature that produced them and the engine that ran
  it, so a GPT result can be routed into another workflow like a Gemini one.
- A fresh install seeds one image-lane profile from the `XOMPET_*` /
  `GPT_IMAGE_*` build-time values (default base URL `https://api.openai.com/v1`).

### Removed

- The Grok (xAI) provider: model registry, service, studio view, driver entry,
  locale keys, env vars, and every live-documentation reference. The app ships
  two engines.
- The provider-studio shell (16 components, 12 hooks, its tests) and the legacy
  provider settings layer — `src/config/providerRegistry.ts`, the
  `providerSettings` slice, and the `provider:*` localStorage mirror. Image
  credentials live only in gateway profiles; stored `provider:grok:*` /
  `provider:gptImage:*` keys and profiles whose driver no longer exists are
  dropped on load.

### Changed

- GPT refinements are stateless: consecutive refines do not carry prior turns,
  and lookbook variation/close-up consistency is weaker than Gemini's chat.
  The refine control stays visible on both lanes.

## [Unreleased] — 2026-09-17

### Added

- A capability-driven image model catalog (`src/config/imageModelCatalog.ts`) is
  now the single source for image model ids, sizes, and response shapes;
  `gptImageModelRegistry.ts`, `grokModelRegistry.ts`, and the
  `RegisteredModel`/`ModelCapability` section of `modelRegistry.ts` derive from
  it. Capabilities are evidence-dated (`verifiedAt`, `sizeObservations`) and
  carry per-gateway overrides keyed by bare host, so a measured "this gateway
  ignores `size`" is recorded rather than assumed.
- Gateway model discovery: `GET {baseUrl}/v1/models` (10-minute TTL cache) tells
  the app which models the configured key may use before a generation is
  attempted. 401 maps to "the gateway rejected this key", 403 to an edge/UA
  block, and only an unexpected body shape to a malformed response.
- Settings → **Gateway** now edits profiles: one Gemini (CPA) profile plus any
  number of image-gateway profiles (GPT Image / OpenAI Images and Grok), each
  with its own name, API shape, base URL, key, enable toggle, and **Check**
  button. Stored under `gateway_profiles_v1`; legacy `cpa_gateway_*` /
  `vertex_proxy_*` and `provider:gptImage:*` / `provider:grok:*` keys migrate
  into the matching profile.
- The GPT Image and Grok studios have a provider selector above the model
  selector. The model list is the catalog ∩ what that gateway serves, with
  served-but-unmeasured ids in a separate group.
- Identity Transfer pre-fills the Face and Body references with the bundled
  defaults (`docs/images/FACE_ANGLES.png`, `docs/images/BODY.png`) on mount; an
  upload or clear made before the default resolves still wins over the late
  default. The Face Reference part now also declares that the reference may be a
  single photograph or a multi-panel contact sheet of one person at several head
  angles: the model reads one single identity, takes identity and hair from the
  panel whose head angle is closest to the destination head angle, and never
  reproduces the panel layout, panel borders, gutters, repeated frames, or panel
  count.

### Changed

- Image requests now send only the fields the active gateway is measured to
  honor, and say so: `response_format` is set explicitly (`b64_json`), and
  `size` / `quality` are omitted — with their controls hidden — for gateways
  measured to ignore them (the CPA gateway answers its own size, so
  `gpt-image-2.5-sunburst` and friends now offer no size dropdown there).
  Dropped fields are logged through the debug service instead of disappearing
  silently.
- `url` responses are supported instead of rejected: the image is fetched and
  turned into base64, so a gateway that answers with a link no longer fails with
  `error.provider.response.urlOnly`.
- When a gateway answers a different size than requested, the result tile says
  so (`requested → returned`) instead of presenting the image as if the size had
  been honored; the image is still kept. A size measured as inconsistent
  (`honorsSize: 'flaky'`) shows the measured honor rate next to the size control.
- Gemini routing is now always the CPA gateway (`https://cliproxy.monet.uno`,
  CLIProxyAPI). The enable/disable toggle and the direct-Gemini API key field
  are gone, so no per-session gateway setup is needed; the gateway key defaults
  to `CLIPROXY_API_KEY` from the build environment and can be overridden in
  Settings. The retired `https://vertex.monet.uno/gemini` URL is no longer
  referenced, and the stored-URL rewrite that replaced cliproxy URLs with it was
  removed. Stored settings move from `vertex_proxy_*` to `cpa_gateway_*`
  localStorage keys with a one-time migration.
- The model registry now lists only models the gateway serves. Images:
  `gemini-3.1-flash-image`. Text: `gemini-3.8-flash` (default),
  `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro`,
  `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`. Removed because the gateway
  `400 unknown provider for model`: `gemini-3-pro-image`,
  `gemini-3.1-flash-lite-image`, `gemini-2.5-flash-image`,
  `gemini-3.1-pro-preview`, `gemini-3.5-flash`.
- Removed the leftover direct-Gemini credential path from
  `src/services/apiClient.ts`: `setGeminiApiKey`, the unused
  `setGeminiBaseUrl`/`getGeminiBaseUrl` accessors, the `directApiKeyOverride`
  slot, and the `requireExplicitApiKey` option (a configured base URL already
  makes the gateway key the only accepted credential). `configureGeminiClient`,
  `isProxyEnabled`, `getActiveApiKey`, `getGeminiClient`, and
  `reinitializeGeminiClient` remain the module's surface.

### Removed

- Google Drive sync: `src/services/googleDriveService.ts`,
  `src/contexts/GoogleDriveContext.tsx`, `src/hooks/useGoogleDriveSync*.ts`,
  `src/components/GoogleDriveSettings.tsx`, `types/google.d.ts`, and their tests.
  The gallery keeps its local IndexedDB persistence and no longer merges a
  remote copy, so the settings section, the `googleDrive` locale block, the
  `GOOGLE_CLIENT_ID` build variable, and the Google Identity Services script are
  gone as well.

### Verified

- Resolution matrix for `gemini-3.1-flash-image`, probed live against the
  gateway (`generationConfig.imageConfig`, JPEG output): 1K → 1:1 1024x1024,
  3:4 896x1200, 4:3 1200x896, 9:16 768x1376, 16:9 1376x768, 2:3 848x1264,
  3:2 1264x848, 4:5 928x1152, 5:4 1152x928, 21:9 1584x672; 2K → 3:4
  1792x2400, 16:9 2752x1536; 4K → 3:4 3584x4800, 1:1 4096x4096. The gateway
  also accepts the ratios the app does not offer (2:3, 3:2, 4:5, 5:4, 21:9);
  the app's `IMAGE_ASPECT_RATIOS` remains `1:1, 3:4, 4:3, 9:16, 16:9`.
- Live run from the app at 4K: selecting the `4K` option and generating issued
  one gateway request and produced a 3584x4800 image with `1 / 1 hoàn tất · 0 lỗi`.

- `GET https://cliproxy.monet.uno/v1/models` lists 23 models; each Gemini id
  kept in the registry was probed with a real request (text ids returned a text
  candidate, `gemini-3.1-flash-image` returned inline image data), and each
  removed id returned `400 unknown provider for model`.
- Live run from the built app: the page issued
  `POST https://cliproxy.monet.uno/v1beta/models/gemini-3.1-flash-image:generateContent`
  and Identity Transfer reported `1 / 1 hoàn tất · 0 lỗi` with 1792x2400 output.
- curl checks against the same gateway: image edit with one and with three input
  images, and `generationConfig.imageConfig` passthrough (1:1 @ 1K → 1024x1024;
  3:4 @ 2K → 1792x2400).

## [Unreleased] — 2026-07-16

### Docs

- Recovered the public application documentation and story packets from the
  dated Harness backup.
- Reconciled the documentation map, product index, application architecture
  notes, test matrix, Harness component inventory references, and docs-sync
  story with the current Windows Harness CLI and source tree while preserving
  the current Harness policy files.
- Marked the retired live-E2E and provider smoke helpers as historical or
  unavailable instead of documenting them as runnable commands.

## [Unreleased] — 2026-07-03

### Fixed

- Gemini vision helpers in `src/services/gemini/text.ts` (`generateImageDescription`, `generateClothingDescription`, `generatePoseDescription`, `generateStylePromptFromImage`, `analyzeScene`) sent `contents: { parts }` without a `role`, which a Vertex gateway rejects with `VALIDATION_FAILED`. Changed to `contents: [{ role: 'user', parts }]` and updated the affected `text.test.ts` assertions. Verified live against `https://vertex.monet.uno/gemini`.

### Added

- Live E2E harness `scripts/e2e-live/run.mts` (run with `tsx`) that drives the real app service layer against a Vertex gateway using the `docs/image-test/` samples, covering all nine features plus text generation, vision description, image generation, and upscale (13 flows). Last run: 11/13 valid; the two non-passing flows were external-runtime conditions (model refusal on a specific watermark sample, transient upstream quota), not app defects.

### Docs

- Resynced `docs/codebase-summary.md`, `docs/TEST_MATRIX.md`, `docs/ARCHITECTURE.md`, and `docs/deployment-guide.md` to the current codebase: recorded test-suite metrics (725 tests / 70 files) and V8 coverage (74.85% lines), documented the live E2E verification, added a Gemini proxy/gateway routing + deployment section, and removed the stale `gemini/video` module reference.

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

