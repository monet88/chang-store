---
title: "Three Provider Studios"
description: "Split app entry into isolated Gemini, Grok, and GPT Image studios while preserving the existing Gemini pipeline."
status: complete
priority: P2
branch: "feat/three-provider-studios"
tags: [frontend, providers, image-api]
blockedBy: []
blocks: []
created: "2026-05-30T06:53:49.081Z"
createdBy: "ck:plan"
source: skill
---

# Three Provider Studios

## Overview

Add a header-level studio switcher with three choices: Gemini, Grok, and GPT Image. Gemini is the default studio — the app opens directly into the current Gemini workspace with no launcher gate. Grok and GPT Image are isolated provider studios focused on five feature workflows: Virtual Try-On, Lookbook, Clothing Transfer, Pattern Generator, and AI Editor. Provider studios share only a settings panel and results grid; all other UI, hooks, services, and request contracts are provider-specific.

## Validated Decisions (from grill-me interview)

- **No launcher page.** Gemini is default. A three-segment switch in the header allows switching studios.
- **Unmount/remount on switch.** Provider studio state (form, results) is lost when switching away. No session state map.
- **ApiProviderContext owns provider settings.** API key and base URL persist through the existing provider context/localStorage pattern. Form state and results do not persist.
- **Minimal shared UI.** Only `ProviderSettingsPanel` and `ProviderResultsGrid` are shared. Each provider renders its own workflow UI.
- **No `workflowPayloadBuilder`.** Each provider hook builds payloads directly.
- **Reuse `Feature` enum.** Define `PROVIDER_SUPPORTED_FEATURES` subset; no separate `ProviderFeature` type.
- **Shared `openaiCompatibleResponse.ts`.** Provider services must request or normalize to OpenAI-compatible `data[].b64_json` before returning images. URL-only responses are a typed failure until conversion or a proxy exists.
- **Shared retry utility.** `withRetry` used by both Grok and GPT Image for 429/503/auth_unavailable errors.
- **Workflows implemented sequentially.** All 5 features per provider, but one at a time — test each before moving to the next.
- **Hook + props state management.** No new React Context. GoogleDrive excluded from provider studio branch.
- **UtilityDock in provider mode.** Gallery hidden; Settings and Prompt Library remain visible.
- **Grok `n` slider.** User selects output count (1–10) via slider in workflow panel.
- **GPT Image quality + size controls.** User selects quality (`low`, `medium`, `high`, `auto`) and size via dropdowns in workflow panel.
- **Sidebar swaps content.** When in Grok/GPT studio, sidebar shows 5 provider features instead of 9 Gemini features.
- **Env naming.** Hosting platform uses non-prefixed names (`GROK_API_KEY`, `GPT_IMAGE_API_KEY`). `vite.config.ts` define block maps with VITE_ fallback: `JSON.stringify(env.GROK_API_KEY || env.VITE_GROK_API_KEY)`.
- **API key security accepted for v1.** Document risk; plan proxy serverless for v2.
- **Base URL validation.** Allowlist known domains (api.x.ai, api.openai.com). Custom URLs require HTTPS + user confirmation warning.
- **AbortController on unmount.** Provider hooks create AbortController on mount, abort on unmount. withRetry respects AbortSignal.
- **Prompt validation.** `validatePrompt()` enforces max 10,000 chars, strips control characters. Called at hook level.
- **Typed error contract.** Services throw `ProviderApiError` on non-2xx. `withRetry` evaluates error type, not string matching.
- **activeFeature clamp on switch.** When switching to provider mode, clamp to `PROVIDER_SUPPORTED_FEATURES[0]` if current feature is Gemini-only.
- **Provider studios own their content area.** No Gemini workspace header (featureMeta, GlobalModelSelector) renders in provider mode.
- **Official provider docs are contract source.** xAI image edits use JSON `image`/`images` objects, not multipart and not raw data URI arrays. GPT Image edits use multipart repeated `image[]` fields in the raw HTTP contract.

## Harness Readiness

- Lane: high-risk.
- Story: `US-001-three-provider-studios`.
- Story packet: `docs/stories/epics/E01-provider-studios/US-001-three-provider-studios/`.
- Implementation is blocked until the story packet and Harness matrix row exist.
- Provider contract assumptions must be rechecked against official docs immediately before implementation.

## Phases

| Phase | Name | Status | Purpose |
|-------|------|--------|---------|
| 1 | [Studio Shell](./phase-01-studio-shell.md) | Complete | Add header switch, studio mode routing, sidebar swap — Gemini default, no launcher. |
| 2 | [Shared Provider Components](./phase-02-shared-provider-studio-ui.md) | Complete | Build shared settings panel, results grid, retry utility, and response parser. |
| 3 | [Grok Provider Studio](./phase-03-grok-provider-studio.md) | Complete | Implement Grok hook, registry, service, and 5 workflows sequentially. |
| 4 | [GPT Image Provider Studio](./phase-04-gpt-image-provider-studio.md) | Complete | Implement GPT Image hook, service, multipart upload, and 5 workflows sequentially. |
| 5 | [Tests Docs Validation](./phase-05-tests-docs-validation.md) | Complete | Add regression/provider tests, docs, and quality gates. |

## Dependencies

- Phase 2 depends on Phase 1 for the studio mode type and routing contract.
- Phases 3 and 4 depend on Phase 2 shared components (settings panel, results grid, retry, response parser).
- Phase 3 completes before Phase 4 starts (Grok first for faster feedback loop).
- Phase 5 depends on all implementation phases.

## Primary Touchpoints

- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Tabs.tsx`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Modify: `vite.config.ts`
- Modify: `src/contexts/ApiProviderContext.tsx`
- Create: `src/components/studios/StudioModeSwitch.tsx`
- Create: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx`
- Create: `src/components/studios/provider-studio/ProviderResultsGrid.tsx`
- Create: `src/components/studios/GrokStudio.tsx`
- Create: `src/components/studios/GptImageStudio.tsx`
- Create: `src/hooks/useGrokStudio.ts`
- Create: `src/hooks/useGptImageStudio.ts`
- Create: `src/config/grokModelRegistry.ts`
- Create: `src/config/gptImageModelRegistry.ts`
- Create: `src/config/providerRegistry.ts`
- Create: `src/services/providers/grok/grokImageService.ts`
- Create: `src/services/providers/gpt-image/gptImageService.ts`
- Create: `src/services/providers/shared/openaiCompatibleResponse.ts`
- Create: `src/services/providers/shared/withRetry.ts`
- Create: `src/services/providers/shared/validatePrompt.ts`
- Create: `src/services/providers/shared/ProviderApiError.ts`
- Create: `src/utils/provider-url-validation.ts`
- Add tests under `__tests__/` mirroring source files.

## Success Criteria

- [x] App starts directly into Gemini workspace (no launcher gate).
- [x] Header shows three-segment studio switch control.
- [x] Gemini choice preserves existing app behavior with no provider-model pollution.
- [x] Switching to Grok/GPT unmounts previous studio and mounts new one (no state preservation).
- [x] Sidebar swaps to 5 provider features when in Grok/GPT mode.
- [x] Gallery hidden in UtilityDock when in Grok/GPT mode; Settings and PromptLibrary remain.
- [x] Grok/GPT support Virtual Try-On, Lookbook, Clothing Transfer, Pattern Generator, and AI Editor workflows.
- [x] Grok studio sends edit requests via official xAI JSON `image`/`images` object contract with user-selected `n` (1–10) and no more than 3 source images.
- [x] Grok generation/edit services prove `b64_json` output or fail with a typed unsupported-response error.
- [x] GPT Image studio sends edit requests via multipart repeated `image[]` uploads with user-selected quality + size.
- [x] Provider settings persist through `ApiProviderContext` (URL, API key) with env defaults.
- [x] Provider results remain local-only.
- [x] Shared retry utility handles 429/503/auth_unavailable for both providers.
- [x] TypeScript, lint, and relevant tests pass.

## Implementation Summary

### Session 6 — 2026-05-30 (implementation via /ck:cook --auto)

All five phases implemented and verified. Quality gates: `npx tsc --noEmit` clean,
`npm run test` 626 passing across 55 files, `npm run build` succeeds (Grok/GPT
studios code-split into lazy chunks).

**New files (25):** `StudioModeSwitch`, `GrokStudio`, `GptImageStudio`,
`ProviderSettingsPanel`, `ProviderResultsGrid`, `providerWorkflows`,
`useGrokStudio`, `useGptImageStudio`, `grokModelRegistry`,
`gptImageModelRegistry`, `providerRegistry`, `grokImageService`,
`gptImageService`, shared `openaiCompatibleResponse` / `withRetry` /
`validatePrompt` / `ProviderApiError` / `safeFetch`, `provider-url-validation`,
plus mirrored tests.

**Modified:** `App.tsx`, `types.ts`, `Header.tsx`, `Tabs.tsx`, `UtilityDock.tsx`,
`ApiProviderContext.tsx`, `vite.config.ts`, `locales/en.ts`, `locales/vi.ts`,
docs (`ARCHITECTURE.md`, `CHANGELOG.md`, `deployment-guide.md`, `api/*`), `.env.example`.

**Architecture decisions honored:** Component → Hook → Service boundary kept
(registry option lists exposed through hooks so studio components never import
`src/config` or `src/services`). Gemini pipeline fully isolated — verified by
`__tests__/config/providerIsolation.test.ts`.

**Code review remediation (post-implementation):** services now block
non-HTTPS/invalid base URLs before sending the bearer token; provider error
i18n keys are self-contained; network failures map to a typed `networkError`
via shared `safeFetch`.

**Deferred (non-blocking follow-ups):** in-studio feature switch does not abort
an in-flight request (studio-switch unmount does); a v2 serverless proxy is still
planned so provider keys never reach the client bundle.

### Session 7 — 2026-05-31 (E2E validation against local proxy)

**Trigger:** User-driven end-to-end smoke test of all 10 provider workflows
(5 Grok + 5 GPT Image) against an OpenAI-compatible proxy at
`http://localhost:8333` with API key `monet-4292`.

**HTTPS validation relaxed.** Original allowlist required `https:` only, which
blocked local proxies. `validateProviderBaseUrl` now accepts both `http:` and
`https:`; non-allowlisted hosts (including `localhost`) still surface a custom
warning so the user knows the bearer token is going to an unfamiliar domain.
The Grok/GPT services drop the explicit "Enforce HTTPS" comments and rely on
the shared validator to reject non-parseable URLs.

**Files touched:**

- `src/utils/provider-url-validation.ts` — accept `http:` + `https:`
- `src/services/providers/grok/grokImageService.ts` — comment update
- `src/services/providers/gpt-image/gptImageService.ts` — comment update
- `src/components/studios/provider-studio/ProviderSettingsPanel.tsx` — drop
  `not-https` branch
- `src/locales/en.ts`, `src/locales/vi.ts` — remove `urlNotHttps` key
- `__tests__/utils/provider-url-validation.test.ts`,
  `__tests__/services/providers/grok/grokImageService.test.ts`,
  `__tests__/components/studios/provider-studio/ProviderSettingsPanel.test.tsx`
  — drop the not-https expectations
- `vite.config.ts` — add `**/.kiro/**` and `**/.gitnexus/**` to watcher ignores
  to prevent ENOSPC under heavy local tooling.

**Quality gates:** `npx tsc --noEmit` clean, `npm run test` 627/627 passing,
ESLint clean on touched files, `gitnexus_detect_changes` reports zero
symbol-level changes (logic stayed within existing functions).

**E2E results — all HTTP 200:**

| Provider | Workflow | Endpoint | Body shape |
|---|---|---|---|
| Grok | Pattern Generator | `/images/generations` | JSON |
| Grok | Try-On | `/images/edits` | JSON `images[]` data URLs |
| Grok | AI Editor | `/images/edits` | JSON `images[]` data URLs |
| Grok | Lookbook | `/images/edits` | JSON `images[]` data URLs |
| Grok | Clothing Transfer | `/images/edits` | JSON `images[]` data URLs |
| GPT Image | Pattern Generator | `/images/generations` | JSON |
| GPT Image | Try-On | `/images/edits` | multipart `image[]` |
| GPT Image | AI Editor | `/images/edits` | multipart `image[]` |
| GPT Image | Lookbook | `/images/edits` | multipart `image[]` |
| GPT Image | Clothing Transfer | `/images/edits` | multipart `image[]` |

Outputs render and persist in their respective results grids; per-provider
`localStorage` settings survive studio switches as expected.

## Risks

- App shell changes can regress current navigation. Mitigate with minimal wrapper and tests.
- Provider secrets in a Vite SPA can be exposed. Accepted for v1 — document risk, plan proxy for v2.
- Provider API docs can drift. Mitigate by checking official docs immediately before implementation and recording the observed contract in the story validation evidence.
- First workflow scope is larger than a generic prompt/edit studio. Mitigate by implementing workflow adapters sequentially and keeping Gemini hooks untouched.
- Existing Gemini prompt builders may produce Gemini-specific `Part[]`. Mitigate by building payloads from plain prompt strings and `ImageFile[]` directly in provider hooks.

### Session 3 — 2026-05-30
**Trigger:** post-validation remediation after official xAI/OpenAI docs check.

#### Superseded Decisions

- **Standalone `providerSettings.ts` superseded.** Provider settings now belong in `ApiProviderContext` to follow project rules that API keys/provider config come from context, not hook-local state or standalone persistence services.
- **Grok raw `images[]` data URI contract superseded.** xAI edits use JSON `image` or `images` objects with URL-like image references; the product cap is 3 source images for multi-image editing.
- **GPT Image `standard`/`hd` quality values superseded.** GPT Image 2 quality values are `low`, `medium`, `high`, and `auto`.
- **GPT Image repeated `image` field wording superseded.** The raw HTTP multipart contract uses repeated `image[]` fields.

#### Remediation Items

- [x] Align plan with official provider request contracts.
- [x] Move provider settings ownership to `ApiProviderContext`.
- [x] Add high-risk story packet and Harness matrix requirement.
- [x] Add API planning notes under `docs/api/`.

## Validation Log

### Session 1 — 2026-05-30
**Trigger:** `/ck:plan validate` — post-plan critical-questions interview
**Questions asked:** 4
**Tier:** Full (Fact Checker + Contract Verifier + Flow Tracer + Scope Auditor)
**Verification Results:** Claims checked: 15 | Verified: 13 | Failed: 0 | Unverified: 2

#### Verification Findings

- **Verified:** `src/types.ts` Feature enum has all 9 values; `ImageFile` has `base64` + `mimeType` fields; `Header.tsx` props match plan; `UtilityDock.tsx` exists with GalleryButton; `modelRegistry.ts` is Gemini-only with `providerId: 'google'`; `Tabs.tsx` renders all 9 features in 3 groups; `GeneratedImage.tsx` exists; `src/components/studios/` and `src/services/providers/` don't exist yet (clean slate); `imageEditingService.ts` wraps Gemini service; existing test structure matches plan's new test paths.
- **Finding:** `vite.config.ts` currently only injects `GEMINI_API_KEY` (line 43). Plan references 4 new provider env vars but doesn't list `vite.config.ts` as modified — production builds would fail for provider API calls.
- **Finding:** `Header` currently takes 4 props (`activeFeature`, `setActiveFeature`, `isOpen`, `onClose`). Adding `studioMode` + sidebar swap means Header interface changes to 5 props.
- **Finding:** `Tabs` component hardcodes 9 features in 3 groups. Provider sidebar needs 5 features in different layout.

#### Questions & Answers

1. **[Architecture/Scope]** Plan references VITE_GROK_API_KEY, VITE_GROK_BASE_URL, VITE_GPT_IMAGE_API_KEY, VITE_GPT_IMAGE_BASE_URL but doesn't list vite.config.ts as modified. Currently only GEMINI_API_KEY is injected via define block. How should provider env vars be exposed?
   - Options: Add to vite.config.ts | Use Vite import.meta.env directly
   - **Answer:** Add to vite.config.ts (Recommended)
   - **Rationale:** Without `define` injection, provider API keys won't be accessible in production builds. Must add `vite.config.ts` to modified files.

2. **[Architecture]** Plan creates grokModelRegistry.ts and gptImageModelRegistry.ts separate from the Gemini modelRegistry.ts. Provider studios won't use the existing Header model selector or useModelSelection hook. Is this intentional?
   - Options: Fully separate registries | Unified registry with providerId
   - **Answer:** Fully separate registries (Recommended)
   - **Rationale:** Provider studios are isolated — they manage their own models within provider hooks. No crossover with Gemini model selector.

3. **[Architecture]** Tabs component currently renders 9 features in 3 hardcoded groups. Phase 1 says "sidebar shows 5 provider features." How should the swap be implemented?
   - Options: Conditional Tabs prop | Separate ProviderTabs component
   - **Answer:** Conditional Tabs prop (Recommended)
   - **Rationale:** Add optional `studioMode?: StudioMode` prop to Tabs. When provider mode, render 5 features in single flat group. When gemini/undefined, render existing 3 groups.

4. **[Scope]** Gemini has a "Send to PhotoAlbum" flow via handleSendToFeature in AppContent. In provider studios, PhotoAlbum isn't in the 5-feature sidebar. Should this transfer flow exist in provider mode?
   - Options: Disable in provider mode | Keep but switch studio on transfer
   - **Answer:** Disable in provider mode (Recommended)
   - **Rationale:** Provider results are local-only. No cross-studio state transfer. PhotoAlbum feature is Gemini-exclusive.

#### Confirmed Decisions

- **vite.config.ts injection:** Add 4 provider env vars to `define` block alongside existing `GEMINI_API_KEY`. Mark `vite.config.ts` as modified in plan touchpoints.
- **Separate registries:** Provider model registries stay fully isolated. No shared model selection across studios.
- **Conditional Tabs:** Add `studioMode?: StudioMode` prop; provider mode renders single flat group of 5 features.
- **No PhotoAlbum transfer:** `handleSendToFeature` is Gemini-scoped only. Provider studios don't offer "send to" flow.

#### Action Items

- [x] Add `vite.config.ts` to plan's "Primary Touchpoints" list
- [x] Update Phase 1 to specify Tabs `studioMode` prop and Header interface change
- [x] Update Phase 3, 4 to explicitly note PhotoAlbum transfer is disabled in provider mode

#### Phase Propagation

- **Phase 1:** Add `vite.config.ts` to modified files. Specify Tabs receives `studioMode` prop. Specify Header interface gains `studioMode: StudioMode` prop.
- **Phase 2:** No changes needed (shared components don't depend on these decisions).
- **Phase 3:** Note that `handleSendToFeature` / PhotoAlbum transfer is not present in Grok studio.
- **Phase 4:** Note that `handleSendToFeature` / PhotoAlbum transfer is not present in GPT Image studio.
- **Phase 5:** Add `vite.config.ts` to regression test scope — verify provider env var injection.

### Whole-Plan Consistency Sweep (Session 1)
- Files reread: plan.md, phase-01-... through phase-05-...
- Decision deltas checked: 4
- Reconciled stale references: 0
- Unresolved contradictions: 0

### Session 2 — 2026-05-30
**Trigger:** `/ck:plan validate` — follow-up validation interview
**Questions asked:** 4
**Tier:** Standard (Fact Checker + Contract Verifier)
**Verification Results:** Claims checked: 8 | Verified: 7 | Failed: 0 | Unverified: 1

#### Verification Findings

- **Verified:** `UtilityDock.tsx` imports `GalleryButton` at line 3, renders at line 56 — plan's conditional hide is feasible.
- **Verified:** `handleSendToFeature` only exists in `App.tsx:92` and is passed to `LookbookGenerator` and `ClothingTransfer` — confirms Gemini-only scope.
- **Verified:** `Header.tsx` has 4 props interface at line 8 — adding `studioMode` makes 5 props as plan states.
- **Verified:** No component imports from `src/services/` directly — boundary is clean, provider services won't break existing pattern.
- **Verified:** localStorage pattern in `ApiProviderContext` uses try/catch with `typeof localStorage` guard — `providerSettings.ts` should follow same pattern.
- **Verified:** `src/components/studios/` and `src/services/providers/` directories don't exist — clean slate confirmed.
- **Verified:** Feature enum exists in `src/types.ts` with all 9 values.
- **Unverified:** Grok API exact response format for `images/generations` endpoint (depends on external API docs).

#### Questions & Answers

1. **[State Management]** Plan says provider settings (API key) stored in localStorage. ApiProviderContext already has localStorage pattern for Gemini key. How should new provider settings be managed?
   - Options: Standalone providerSettings.ts | Extend ApiProviderContext | New ProviderContext
   - **Answer:** Standalone providerSettings.ts (Recommended)
   - **Rationale:** Superseded in Session 3. Provider settings now belong in `ApiProviderContext` because project rules require API keys/provider config to come from context.

2. **[API Contract]** Phase 4 says GPT Image uses multipart FormData with repeated 'image' fields for multi-image edits. How should multiple reference images be appended?
   - Options: Repeated form.append('image', blob) | Indexed fields (image_0, image_1) | Single 'images' field with JSON
   - **Answer:** Repeated form.append('image', blob) (Recommended)
   - **Rationale:** Superseded in Session 3. Raw HTTP now uses repeated `image[]` fields per official GPT Image docs.

3. **[Execution Order]** Phase 3 (Grok) must complete before Phase 4 (GPT Image) for 'faster feedback loop'. Keep sequential or allow parallel?
   - Options: Sequential — Grok first | Parallel — both at once | GPT Image first
   - **Answer:** Sequential — Grok first (Recommended)
   - **Rationale:** Grok is JSON-only (simpler), validates shared components before GPT Image adds multipart complexity. Reduces rework risk.

4. **[Props Flow]** Plan says 'No new React Context' but useGrokStudio/useGptImageStudio need studioMode. How should state flow?
   - Options: Props drilling from App | Minimal StudioContext | URL hash state
   - **Answer:** Props drilling from App (Recommended)
   - **Rationale:** Only 1-2 levels deep (App → Studio component → hook via argument). No context overhead needed for shallow prop passing.

#### Confirmed Decisions

- **Standalone providerSettings.ts:** Superseded in Session 3 by `ApiProviderContext` settings ownership.
- **Repeated form.append('image', blob):** Superseded in Session 3 by repeated `image[]` fields in raw HTTP multipart.
- **Sequential execution confirmed:** Phase 3 → Phase 4. No parallel provider implementation.
- **Props drilling for studioMode:** App passes studioMode as prop to studio components. Hooks receive it as argument, not from context.

#### Phase Propagation

- **Phase 2:** Superseded in Session 3: extend `ApiProviderContext`; do not add standalone provider settings persistence.
- **Phase 4:** Superseded in Session 3: multipart uses repeated `image[]` fields in raw HTTP.
- **Phase 3 & 4:** Confirm hooks receive `studioMode` as function argument, not from context.

### Whole-Plan Consistency Sweep (Session 2)
- Files reread: plan.md, phase-01 through phase-05
- Decision deltas checked: 4
- New decisions consistent with Session 1 validated decisions: yes
- Reconciled stale references: 0
- Unresolved contradictions: 0

## Red Team Review

### Session — 2026-05-30
**Findings:** 15 unique (29 raw, deduped) — 10 accepted, 5 rejected
**Severity breakdown:** 2 Critical, 5 High, 3 Medium (accepted only)
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | User-controlled base URL → credential exfiltration | Critical | Accept | Phase 2, 3 |
| 2 | `activeFeature` persistence leaks across studios | Critical | Accept | Phase 1 |
| 3 | No prompt input validation/length limit | High | Accept | Phase 2 |
| 4 | vite.config.ts misleading comment | High | Accept | Phase 1 |
| 5 | VITE_ prefix env var confusion (define vs import.meta.env) | High | Accept | Phase 1, 2 |
| 6 | No AbortController for in-flight requests on studio switch | High | Accept | Phase 2, 3, 4 |
| 7 | featureMeta/GlobalModelSelector renders in provider mode | High | Accept | Phase 1 |
| 8 | `docs/project-changelog.md` → `docs/CHANGELOG.md` | Medium | Accept | Phase 5 |
| 9 | withRetry no jitter/exponential backoff | Medium | Accept | Phase 2 |
| 10 | withRetry error contract unspecified (throw vs return) | Medium | Accept | Phase 2 |

#### Rejected Findings

| # | Finding | Reason |
|---|---------|--------|
| R1 | localStorage plaintext API keys | User-validated decision: "API key security accepted for v1" |
| R2 | CLAUDE.md stale WardrobeMode | Not blocking; separate maintenance concern |
| R3 | No CORS consideration | Grok supports browser CORS; custom URLs are user responsibility |
| R4 | UI boundary test blocks provider imports | Architecture: components → hooks → services. Components never import services. |
| R5 | GPT Image `n:1` vs Grok `n:1-10` UX inconsistency | Already documented in Phase 4 ("n effectively one"). Add explicit UI note. |

### Whole-Plan Consistency Sweep (Red Team)
- Files reread: plan.md, phase-01 through phase-05
- Decision deltas checked: 10 (accepted findings applied)
- Reconciled stale references:
  - `docs/project-changelog.md` → `docs/CHANGELOG.md` (Phase 5)
  - Env naming: `VITE_GROK_API_KEY` → hosting uses `GROK_API_KEY` with VITE_ fallback (Phase 1, 2, Validated Decisions)
  - Architecture: "AppShell wrapping AppContent" → studioMode state lives inside AppContent below providers (Phase 1)
  - UtilityDock prop: "hideGallery or studioMode" → `studioMode?: StudioMode` (Phase 1)
  - withRetry: "5s fixed delay" → exponential backoff + jitter (Phase 2)
  - "cap around 20" → `MAX_GPT_REFERENCE_IMAGES = 10` (Phase 4)
- Unresolved contradictions: 0

### Session 3 — 2026-05-30
**Trigger:** Final validation pass before implementation
**Questions asked:** 4

#### Verification Results
- **Tier:** Full (5 phases → all 4 roles)
- **Claims checked:** 25+
- **Verified:** 25 | **Failed:** 0 | **Unverified:** 1
- Historical unverified item: Grok API exact `b64_json` response format (resolved in Session 5 via current xAI REST Images reference)

#### Questions & Answers

1. **[API Contract]** Phase 3 yêu cầu Grok service 'prove b64_json output or fail with typed unsupported-response error'. Nếu xAI chỉ trả image URLs (không hỗ trợ b64_json), xử lý thế nào?
   - Options: Fail with error, skip Grok (Recommended) | Fetch URL → convert to base64 client-side | Support both URL and b64_json in ImageFile
   - **Answer:** Fail with error, skip Grok (Recommended)
   - **Rationale:** Service throws typed error, UI shows 'Grok does not support local image output'. Simplest, safest. No CORS risk, no latency penalty.

2. **[Scope]** Mỗi provider studio có 5 workflows × 2 providers = 10 workflow implementations. Giảm scope MVP không?
   - Options: Giữ nguyên 5 workflows/provider (Recommended) | MVP 3 workflows trước (AIEditor + TryOn + Lookbook) | MVP 2 workflows (AIEditor + generate-only)
   - **Answer:** Giữ nguyên 5 workflows/provider (Recommended)
   - **Rationale:** Full feature parity. Effort estimate đã validated qua previous sessions.

3. **[Architecture]** providerRegistry.ts location — `src/config/` hay `src/services/providers/`?
   - Options: src/config/providerRegistry.ts (Recommended) | src/services/providers/registry.ts
   - **Answer:** src/config/providerRegistry.ts (Recommended)
   - **Rationale:** Consistent with existing modelRegistry.ts location. Config/registry files stay in `src/config/`.

4. **[Architecture]** UtilityDock GalleryButton hiding strategy in provider mode?
   - Options: studioMode prop, conditionally render GalleryButton (Recommended) | Không hide, giữ GalleryButton cho tất cả studios
   - **Answer:** studioMode prop, conditionally render GalleryButton (Recommended)
   - **Rationale:** Thêm `studioMode?: StudioMode` prop; khi studioMode !== 'gemini' thì không render GalleryButton trong expanded panel.

#### Confirmed Decisions
- **Grok b64_json fallback:** Fail with typed error if b64_json unavailable. No client-side URL conversion.
- **Full scope:** 5 workflows per provider, no MVP reduction.
- **providerRegistry.ts:** Lives in `src/config/` alongside existing registries.
- **UtilityDock:** `studioMode?: StudioMode` prop controls GalleryButton visibility.

#### Phase Propagation
- All decisions confirm existing plan content — no phase file changes needed.

### Whole-Plan Consistency Sweep (Session 3)
- Files reread: plan.md, phase-01 through phase-05
- Decision deltas checked: 4
- All answers confirmed recommended options already present in plan
- Reconciled stale references: 0
- Unresolved contradictions: 0

### Session 4 — 2026-05-30
**Trigger:** `/ck:plan validate` — final implementation-readiness check
**Questions asked:** 4
**Tier:** Full (5 phases → all 4 roles)
**Verification Results:** Claims checked: 18 | Verified: 18 | Failed: 0 | Unverified: 1
- Historical unverified item: Grok API exact `b64_json` response format (resolved in Session 5 via current xAI REST Images reference)

#### Verification Findings

- **Verified:** `src/components/studios/` does not exist (clean slate).
- **Verified:** `src/services/providers/` does not exist (clean slate).
- **Verified:** `StudioMode` type not yet in `src/types.ts` (clean slate).
- **Verified:** `vite.config.ts` only injects `GEMINI_API_KEY` + `GOOGLE_CLIENT_ID` (lines 43-44).
- **Verified:** `Header.tsx` has 4 props: `activeFeature, setActiveFeature, isOpen, onClose` (line 8, 15).
- **Verified:** `UtilityDock.tsx` renders `GalleryButton` unconditionally (line 56).
- **Verified:** `docs/api/` exists with `grok-image-api-guide.md`, `gpt-image-2-api-guide.md`, `README.md`.
- **Verified:** `ApiProviderContext` uses guarded localStorage pattern (typeof check + try/catch).
- **Verified:** No `providerSettings` API exists in context yet (clean slate for extension).

#### Questions & Answers

1. **[Scope]** Plan đã qua 2 validation + 1 red-team. Codebase verification confirms clean slate (0 failures). Validate thêm khía cạnh nào?
   - Options: Implementation readiness | UX edge cases | Skip validation | Specific concern
   - **Answer:** Skip validation
   - **Rationale:** Plan is mature — proceed to implementation.

2. **[UX]** Khi switch studio giữa chừng (request đang pending) — plan nói unmount/remount nhưng chưa specify rõ UX. Xử lý thế nào?
   - Options: Abort + unmount silently (Recommended) | Abort + toast warning | Block switch while loading
   - **Answer:** Abort + unmount silently (Recommended)
   - **Rationale:** AbortController cancel request, unmount component, no toast. User hiểu implicit rằng switch = cancel.

3. **[State]** Provider settings persist qua localStorage. Switch từ Grok sang GPT Image rồi quay lại — settings có restore không?
   - Options: Always persist per-provider (Recommended) | Clear on switch
   - **Answer:** Always persist per-provider (Recommended)
   - **Rationale:** Mỗi provider có riêng localStorage keys. Switch back = settings vẫn còn. Đã implied trong plan nhưng giờ explicit.

4. **[Risk]** Nếu 1 workflow gặp API issue (ví dụ Grok không support edit cho certain model), strategy là gì?
   - Options: Skip workflow + document limitation (Recommended) | Block phase until resolved | Stub with error state
   - **Answer:** Skip workflow + document limitation (Recommended)
   - **Rationale:** Implement what works, disable unsupported workflows with clear UI message, move on to next.

#### Confirmed Decisions

- **Silent abort on switch:** AbortController cancels in-flight requests on studio switch. No toast, no blocking.
- **Per-provider settings persistence:** Each provider has namespaced localStorage keys. Settings survive studio switches.
- **Skip unsupported workflows:** If a provider API doesn't support a workflow, disable it with clear UI message rather than blocking the phase.

#### Phase Propagation

- **Phase 1:** No changes — unmount/remount already implies abort via useEffect cleanup.
- **Phase 2:** No changes — withRetry already respects AbortSignal.
- **Phase 3 & 4:** Add note: if a workflow is unsupported by the provider API at implementation time, disable with UI message and document limitation. Do not block phase completion.

### Whole-Plan Consistency Sweep (Session 4)
- Files reread: plan.md, phase-01 through phase-05
- Decision deltas checked: 3
- New decisions consistent with existing plan content (abort on unmount already specified, per-provider persistence already implied by ApiProviderContext extension, skip-workflow is new but non-contradictory)
- Reconciled stale references: 0
- Unresolved contradictions: 0

### Session 5 — 2026-05-30
**Trigger:** User supplied xAI playground evidence for Grok aspect ratios/models and requested contract proof.
**Questions asked:** 4
**Tier:** Full follow-up focused on external provider contract and Harness friction.
**Verification Results:** Claims checked: 8 | Verified: 8 | Failed: 0 | Unverified: 0

#### Verification Findings

- **Verified:** xAI REST Images reference documents `aspect_ratio` for generation and edits, including `1:1`, `2:3`, `3:2`, `9:16`, and `16:9`.
- **Verified:** xAI REST Images reference documents `resolution` values `1k` and `2k`.
- **Verified:** xAI REST Images reference documents `response_format` values `url` and `b64_json` for both `/v1/images/generations` and `/v1/images/edits`.
- **Verified:** xAI REST Images response documents `data[].b64_json` when `response_format` is `b64_json`.
- **Verified:** xAI image examples use `grok-imagine-image-quality`; xAI Models reference lists `grok-imagine-image`. Phase 3 now supports both and defaults to quality.
- **Verified:** OpenAI GPT Image 2 plan remains aligned with current OpenAI docs: `gpt-image-2`, repeated `image[]` fields for raw multipart edits, and `low|medium|high|auto` quality.
- **Verified:** `scripts/harness` has a bash shebang but is tracked with git mode `100644`, so direct execution fails. `scripts/bin/harness-cli` is executable. Workaround is `bash scripts/harness ...`; durable fix is `chmod +x scripts/harness` and commit the mode change.
- **Verified:** `docs/development-rules.md` is absent; user will create it separately.

#### Questions & Answers

1. **[API Contract]** xAI size UI shows aspect ratios such as 2:3 Tall, 3:2 Wide, 1:1 Square, 9:16 Vertical, 16:9 Widescreen. Should Phase 3 use `size` or official xAI fields?
   - Options: Use `aspect_ratio` + `resolution` (Recommended) | Keep `size` | Support both
   - **Answer:** Use `aspect_ratio` + `resolution` (Recommended)
   - **Rationale:** Current xAI REST Images reference has `aspect_ratio` and `resolution`; no `size` field is documented.

2. **[API Contract]** Should Grok support one model or both model IDs observed in xAI docs/UI?
   - Options: Support `grok-imagine-image` and `grok-imagine-image-quality`, default quality (Recommended) | Only quality | Only base model
   - **Answer:** Support both, default quality (Recommended)
   - **Rationale:** User confirmed both are available; official examples use quality while the Models reference lists base `grok-imagine-image`.

3. **[Documentation]** `docs/development-rules.md` is missing. Should this validation create it?
   - Options: User creates it separately (Recommended) | Create placeholder now | Remove references
   - **Answer:** User creates it separately (Recommended)
   - **Rationale:** Keep this validation scoped to provider studio plan correctness.

4. **[Harness]** Why did `scripts/harness` fail as not executable?
   - Options: Git mode is `100644`; commit executable bit (Recommended) | Always invoke with `bash scripts/harness` | Ignore
   - **Answer:** Git mode is `100644`; commit executable bit (Recommended)
   - **Rationale:** The wrapper has a shebang and is intended as a stable executable entrypoint.

#### Confirmed Decisions

- **Grok output contract:** Request `response_format: 'b64_json'` for generation and edits; fail typed unsupported-response only if provider violates the documented contract.
- **Grok dimensions:** Replace `size: '1024x1024'` with `aspect_ratio` presets and `resolution`.
- **Grok model registry:** Support `grok-imagine-image` and `grok-imagine-image-quality`, defaulting to quality.
- **Harness friction:** Backlog #1 records the non-executable wrapper; use `bash scripts/harness` until mode is fixed.

#### Phase Propagation

- **Phase 3:** Updated request contracts, requirements, implementation steps, and success criteria for `aspect_ratio`, `resolution`, `response_format: 'b64_json'`, and both Grok models.
- **Docs:** Updated `docs/api/grok-image-api-guide.md` with REST Images reference evidence and corrected request examples.

### Whole-Plan Consistency Sweep (Session 5)
- Files reread: plan.md, phase-01 through phase-05, docs/api/grok-image-api-guide.md
- Decision deltas checked: 4
- Reconciled stale references: `size: '1024x1024'` replaced by `aspect_ratio`/`resolution`; old Grok b64 uncertainty superseded by REST Images proof.
- Unresolved contradictions: 0
