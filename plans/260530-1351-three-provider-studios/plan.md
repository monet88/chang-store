---
title: "Three Provider Studios"
description: "Split app entry into isolated Gemini, Grok, and GPT Image studios while preserving the existing Gemini pipeline."
status: pending
priority: P2
branch: "docs/harness-backfill"
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
| 1 | [Studio Shell](./phase-01-studio-shell.md) | Pending | Add header switch, studio mode routing, sidebar swap — Gemini default, no launcher. |
| 2 | [Shared Provider Components](./phase-02-shared-provider-studio-ui.md) | Pending | Build shared settings panel, results grid, retry utility, and response parser. |
| 3 | [Grok Provider Studio](./phase-03-grok-provider-studio.md) | Pending | Implement Grok hook, registry, service, and 5 workflows sequentially. |
| 4 | [GPT Image Provider Studio](./phase-04-gpt-image-provider-studio.md) | Pending | Implement GPT Image hook, service, multipart upload, and 5 workflows sequentially. |
| 5 | [Tests Docs Validation](./phase-05-tests-docs-validation.md) | Pending | Add regression/provider tests, docs, and quality gates. |

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

- [ ] App starts directly into Gemini workspace (no launcher gate).
- [ ] Header shows three-segment studio switch control.
- [ ] Gemini choice preserves existing app behavior with no provider-model pollution.
- [ ] Switching to Grok/GPT unmounts previous studio and mounts new one (no state preservation).
- [ ] Sidebar swaps to 5 provider features when in Grok/GPT mode.
- [ ] Gallery hidden in UtilityDock when in Grok/GPT mode; Settings and PromptLibrary remain.
- [ ] Grok/GPT support Virtual Try-On, Lookbook, Clothing Transfer, Pattern Generator, and AI Editor workflows.
- [ ] Grok studio sends edit requests via official xAI JSON `image`/`images` object contract with user-selected `n` (1–10) and no more than 3 source images.
- [ ] Grok generation/edit services prove `b64_json` output or fail with a typed unsupported-response error.
- [ ] GPT Image studio sends edit requests via multipart repeated `image[]` uploads with user-selected quality + size.
- [ ] Provider settings persist through `ApiProviderContext` (URL, API key) with env defaults.
- [ ] Provider results remain local-only.
- [ ] Shared retry utility handles 429/503/auth_unavailable for both providers.
- [ ] TypeScript, lint, and relevant tests pass.

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
