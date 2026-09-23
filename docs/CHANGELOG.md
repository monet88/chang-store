# Changelog

## [Unreleased] — 2026-09-23

### Added

- Custom app icon: a combined camera-lens + clothing-hanger logomark with an
  indigo-to-fuchsia gradient, placed at `build/icon.ico` (multi-size ICO) and
  `build/icon.png` (512×512 PNG). electron-builder now embeds the icon into both
  the portable and installer executables instead of using the default Electron
  icon.
- NSIS installer build target (`npm run dist:win:installer`): produces a
  one-click Windows setup EXE (`Chang Store-<version>-setup.exe`) that installs
  to Program Files with desktop and Start Menu shortcuts. The installed app
  launches faster than the portable variant because it skips per-launch
  self-extraction.
- Unified build script `scripts/build-win.mjs` replaces the former
  `build-win-portable.mjs` and accepts a target argument (`portable` or `nsis`).

## [Unreleased] — 2026-09-21

### Added

- A production-grade Electron desktop shell based on the Chatbox architecture
  audit. Desktop development and packaging now use `electron-vite` to build the
  main, preload, and renderer processes explicitly instead of starting a custom
  loopback HTTP server to serve the Vite output.
- A narrow named preload bridge for desktop gateway operations: Gemini
  `generateContent`, gateway model discovery, and OpenAI-compatible image
  generate/edit calls are executed by Electron main instead of exposing a
  generic `ipcRenderer.invoke` escape hatch to the renderer.
- Encrypted desktop gateway credential storage backed by Electron `safeStorage`.
  Existing CPA/Image gateway keys are migrated out of renderer localStorage only
  after secure storage succeeds; localStorage retains a non-secret reference
  marker. Legacy `vertex_proxy_*` credentials are migrated through the same path.
- Desktop image URL materialization for gateways that return `data[].url` instead
  of `b64_json`. The main-process downloader rejects private/reserved network
  targets, pins connections to validated public DNS results, revalidates
  redirects, requires an image response, caps downloads at 50 MB, and applies a
  hard request deadline before returning base64 data to the renderer.
- Desktop networking/security regression coverage for credential migration,
  named gateway routing, secret-free renderer behavior, and IPv4/IPv6 public
  network classification.

### Changed

- Packaged desktop builds now load `out/renderer/index.html` directly with
  `BrowserWindow.loadFile()`. Development uses the renderer URL provided by
  `electron-vite`, removing the previous fixed-port probe, MIME table, SPA
  fallback server, and server shutdown lifecycle.
- Electron main and preload are now TypeScript build targets under `electron/`.
  The existing React source tree remains shared by browser and desktop instead of
  being duplicated or moved solely to mirror Chatbox's layout.
- The desktop renderer runs with `webSecurity: true`, `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`. External navigation is blocked
  from replacing the trusted app renderer; HTTP(S) links continue to open in the
  system browser.
- Desktop provider credentials are no longer injected into generated renderer or
  main bundles. Browser builds keep the existing direct-provider/localStorage
  contract, while desktop requests resolve credentials through the encrypted
  main-process vault and bind each stored key to its configured gateway base URL.
- Gateway settings now understand desktop credential references when discovering
  served models and building the active Gemini/GPT Image clients. Changing a
  desktop gateway base URL invalidates the old stored credential so a key cannot
  silently be reused against a different destination.
- The Electron window now waits for `ready-to-show`, reports renderer load/process
  failures, preserves single-instance focus behavior, and handles startup errors
  without leaving a partially bootstrapped second instance.

### Fixed

- Opening a second desktop instance can no longer continue into the normal app
  bootstrap after failing the single-instance lock; it now exits cleanly while
  the existing window is restored and focused.
- Desktop gateway traffic no longer depends on renderer CORS exceptions. The
  app can keep custom/local gateway support without disabling Electron renderer
  web security.
- Secure credential migration is fail-safe: if the OS-encrypted vault cannot
  store a key, the existing plaintext value is left untouched rather than being
  replaced prematurely by a reference marker and effectively lost.
- Desktop credential rotation no longer reuses a served-model cache entry from
  the previous key, and failed gateway saves keep the previous working settings
  instead of silently discarding them.
- Editing an encrypted image-gateway key now keeps a local field draft and
  commits once on blur, avoiding per-keystroke vault writes and controlled-input
  resets. Clearing or rebinding a profile also removes the old vault entry.
- Desktop credential migration now preserves legacy gateway URLs, promotes a
  profile-only CPA credential into the active CPA settings projection, and
  keeps startup alive when renderer storage access fails.
- "Clear all data" now removes legacy gateway keys and refuses to report success
  when the encrypted credential vault could not be cleared.
- Provider-returned image URLs no longer create an unrestricted main-process
  fetch path; non-public IPv4/IPv6 ranges, mapped/translation forms, excessive
  redirects, oversized payloads, non-image responses, and indefinitely trickled
  downloads are rejected.

## [Unreleased] — 2026-09-19

### Added

- AI Scan (`✨ AI Scan`, issue #162): an analytical pre-pass that deconstructs
  the source garments into a textile blueprint (weave and material, optical
  finish, weight and drape physics, micro-edge details) before synthesis, and
  splices that blueprint into the image prompt as a subordinate technical
  specification. A toggle with an analysis badge and an expandable blueprint
  viewer sits in the options column of Virtual Try-On (both modes: multi-model
  and wardrobe), Lookbook, Identity Transfer, Pose Changer and Background
  Replacer — the four features that gain nothing from textile semantics
  (Watermark Remover, Pattern Generator, Photo Album, AI Editor) are untouched.
  The preference persists in `ai_scan_enabled` and defaults to ON.
- `AiScanContext` (`src/contexts/AiScanContext.tsx`) owns the layer: the
  persisted preference and the analysis itself, while `AiScanPanel` shows the
  state of the source set it was given. Each source set is analyzed once
  (capped at four images, `gemini-3.8-flash`) and reused by both the panel's
  pre-scan and the generation call; a disabled, failed or cancelled analysis
  resolves to `null` so generation always ships its base prompt, with no extra
  latency or tokens.
- The scan follows the generation, not the batch: Virtual Try-On analyzes each
  subject with the target garments, every wardrobe set analyzes its own garments
  plus the subject, and Identity Transfer analyzes each destination photo
  separately — a blueprint never describes one photo inside another photo's
  prompt. One of the four source slots is reserved for that shared reference, so
  a full garment list cannot crowd the subject out of its own analysis.
- `formatAiScanBlock` (`src/utils/ai-scan-blueprint.ts`) is the single splice
  point, so every prompt builder emits the identical block heading.

### Changed

- The garment/outfit analysis prompt is shared: it now also asks for textile
  engineering (weave and material, optical properties and finish, weight and
  drape physics, micro-edge and hemline details), which the E-Com Pack
  blueprint benefits from unchanged.
- The E-Com Pack's three prompt lanes build their blueprint block through
  `formatAiScanBlock`; the block heading is now
  `AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images)`
  instead of the former E-Com-Pack-only wording.
- Prompt builders accept the blueprint as an optional field and a blank or
  absent value leaves the built prompt byte-identical: Virtual Try-On
  (`outfitBlueprint` on the input), Identity Transfer (same), Background
  Replacer (same), Pose Changer (`buildTextPosePrompt` /
  `buildReferencePosePrompt` third argument), Lookbook (`buildLookbookPrompt`,
  `buildVariationPrompt`, `buildCloseUpPrompts` trailing argument).

### Fixed

- Virtual Try-On (multi-model) analyzes each subject's own source set inside its
  batch job — the garments plus that subject's photo — so subject B is no longer
  generated from subject A's blueprint; regenerate-single scans the same way.
  Batch concurrency still bounds the generation.
- The Lookbook reserves one scan slot for `fabricTextureImage`, so four or more
  clothing images can no longer crowd the texture swatch out of its own
  analysis; source order stays garment slots first, texture last.
- The AI Scan badge is panel state again: `AiScanContext` keeps the preference,
  the analysis and its one-set cache, while `AiScanPanel` renders the
  blueprint / spinner / "unavailable" note of the sources it was given. A batch
  job's analysis can no longer label another job's panel.
- Pose Changer establishes its busy state (`isLoading`,
  `generationStatus.active`) before awaiting the scan and guards the run behind
  an in-flight ref, so Generate is no longer clickable for the whole analysis
  and a second click cannot start a duplicate run.
- Lookbook variations and close-ups reuse the blueprint stored on the generated
  main instead of re-scanning the form, so editing the sources towards outfit B
  after generating from outfit A no longer injects B's fresh analysis into A's
  derived shots.
- AI Scan fails closed: one failed or unusable source report resolves the scan
  to `null` and injects no partial blueprint, instead of keeping the reports
  that answered and renumbering them.

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
- Prompt builders take the lane's format (`src/utils/promptFormat.ts`). The
  interleaved builders (Virtual Try-On, Identity Transfer, Clothing Transfer)
  now assemble one role map for the GPT lane — each image named by position,
  with its user note, instead of the labels a flattened prompt carried a second
  time. The task text, invariants and prohibitions stay one shared source, so
  the Gemini prompts are unchanged.
- The Identity Transfer prompt on the GPT lane drops the sentences that only
  restate an earlier section (the anti-list, the authority/makeup/grade repeats,
  and the reference wrap its role map already carries): 6,135 → 4,827 characters
  of instructions with every rule kept. The Gemini prompt is byte-identical;
  the compaction is anchored to substrings of the shared text, so a missing
  anchor leaves it whole instead of dropping a rule.
- Virtual Try-On and Clothing Transfer use the same lane compaction: the GPT
  prompt drops the prohibition bullets and avoid bullets that only restate a
  section above them (the lower-body, pockets, and tucking rules; four
  restatements of ROLE 1/2 and PLACEMENT). Both Gemini prompts are byte-identical
  (4,035 and 3,197 characters), and every dropped bullet's rule stays stated in
  the prompt.
- Gemini prompt optimizations: Pattern Generator keeps its interleaved Gemini
  prompt assembly; negative prompts use semantic scene framing; camera framing
  instructions in Background Replacer, Pose Changer and Photo Album are locked
  to English to prevent bilingual prompt leakage; buzzword bloat removed; default
  Watermark Remover and chat refinement model updated to `gemini-3.1-flash-image`.

### Fixed

- Prompts no longer pin a resolution. Five prompt strings asked for "2K" while
  the UI's resolution control (1K/2K/4K, default 2K) is the real parameter —
  `editImage` sends it as `imageConfig.imageSize` — so a 1K or 4K request
  carried a contradictory instruction. Pose Changer (both prompts), Background
  Replacer, Photo Album, and the Face-Fusion prompt in `imageEditingService`
  now state the quality intent without naming a resolution.
- A multi-person Virtual Try-On now tells the model to erase the red targeting
  dot and its white ring from the result. The dot is composited onto the image
  sent to the model, and no prompt asked for its removal on either lane.
- The main Lookbook prompt and both AI Editor prompts demand exactly one
  standalone image, so a generation cannot come back as a collage, grid, or
  contact sheet.
- GPT Studio navigation: replaced Pattern Generator with Identity Transfer in
  `PROVIDER_SUPPORTED_FEATURES` so the studio renders all five shipped workflows
  and navigation never routes to an unbacked view.
- GPT image engine parts adapter: flattened Gemini-style `interleavedParts`
  into the single prompt and ordered reference images required by OpenAI-style
  `/images/edits`, unblocking parts-based workflows (Virtual Try-On, Clothing
  Transfer, Identity Transfer).
- Negative prompts on the GPT lane: the Lookbook negative prompt reached the
  engine and was dropped, because `/images/edits` has no negative field. Both
  lanes now append it to the request prompt through
  `src/utils/negative-prompt-builder.ts`, so the wording cannot drift apart.
- The Gemini lane dropped the negative prompt whenever a request carried
  interleaved parts; the avoid-sentence now travels as one more part.
- AI Editor prompts state the edit invariants on both lanes: apply only the
  named change, keep identity/framing/lighting intact, never invent or garble
  text and logos, and blend referenced images as one photograph.
- The GPT studio offered a 1-4 image-count slider that its lane cannot honour
  (`n` is measured-ignored on the reference gateway), so the control is gone
  from the Virtual Try-On and Clothing Transfer views; one request still returns
  one image.

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

