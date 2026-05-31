---
title: "Provider Studio UI Parity with Gemini"
description: >-
  Bring the Grok and GPT provider studios to visual + structural UI parity with
  the Gemini studio: stepped wizard panels, per-item source cards (own uploader +
  type select + note + Add Another Item), Multi-Model/Wardrobe toggle with
  wardrobe sets engine, and Lookbook rich output (variations / close-up /
  refinement version history). Reuses the already-shared Gemini prompt builders.
  Gemini pipeline stays untouched; provider results remain local-only.
status: pending
priority: P2
branch: "feat/three-provider-studios"
tags: [frontend, providers, ui, parity, wardrobe, lookbook]
blockedBy: []
blocks: []
created: "2026-05-31T14:33:21.504Z"
createdBy: "ck:plan"
source: skill
---

# Provider Studio UI Parity with Gemini

## Overview

The Grok and GPT provider studios share ONE flat scrolling layout that renders all
five workflows (Try-On, Lookbook, Clothing Transfer, Pattern Generator, AI Editor).
The Gemini studio, by contrast, uses rich per-feature UIs: stepped wizard panels,
per-clothing-item cards (own uploader + type select + note + "Add Another Item"),
a Multi-Model/Wardrobe mode toggle, and a multi-stage Lookbook output (variations,
close-up, refinement version history).

This plan closes the **visual + structural** gap. The **logic/prompt** foundation
already exists: the completed plan `260531-1614-provider-studio-prompt-reuse` wired
the provider hooks into the same Gemini `*-prompt-builder.ts` via
`provider-studio-prompt-adapter.ts`, plus source-item types/notes, background/extra
fields, refine/upscale/regenerate, multi-person targeting, and batch subjects. So
the remaining work is mostly presentational restructuring + two genuinely new
provider engines (wardrobe, lookbook rich output).

## Foundation (already shipped — do NOT rebuild)

From `plans/260531-1614-provider-studio-prompt-reuse` (status: complete):
- `buildProviderStudioPrompt` reuses Gemini builders (strips inline image Parts).
- `useProviderStudioFields` — source-item types/notes arrays, background, extra.
- `useProviderTryOnBatch` — multi-person marker + batch subjects + bounded workers.
- `useProviderLookbookFields` — full `LookbookFormState` + fabric image.
- `useProviderResultActions` — per-tile refine/upscale/regenerate (mutual exclusion).
- Presentational: `ProviderSourceFields`, `ProviderTryOnExtras`, `ProviderLookbookControls`, `ProviderResultsGrid`, `ProviderResultTile`, `ProviderSettingsPanel`.

## Scope Decisions

- **Both providers together.** Grok and GPT share `GrokStudio.tsx` / `GptImageStudio.tsx`
  (near-identical) and all `useProvider*` helper hooks. Changes land once, apply to both.
- **No new React Context.** Continue props-drilling `activeFeature` + `studioMode`.
- **Boundary preserved.** Components never import `src/services/*` or `src/config/*`
  (enforced by `__tests__/components/ui-boundary-imports.test.ts`). New hooks own all
  service calls and expose option lists.
- **Provider results stay local-only.** No Gemini `useImageGallery` integration.
- **Reuse presentational components where pure.** `WardrobeSetCard` is fully
  presentational (callbacks only) — reuse it directly for provider wardrobe.
  `LookbookOutput` is presentational, but user chose a provider-specific
  `ProviderLookbookOutput` so Gemini output UI stays untouched.
- **GPT batch caveat.** GPT multipart edits are slow (~60-90s) and can timeout through
  Cloudflare tunnels (documented; localhost recommended). Wardrobe/variations multiply
  request count — cap GPT Wardrobe at 2 sets and GPT Lookbook at 1 variation, with
  concurrency 1 and a prominent time warning.
- **DRY shared layout.** Extract the common studio scaffold into a shared component so
  Grok and GPT do not diverge as richness grows.
- **Shipping checkpoint.** Phases 1-4 are a valid shippable checkpoint if gates are
  green; Phase 5 Lookbook rich output may ship as a follow-up.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Research and Shared Foundation](./phase-01-research-and-shared-foundation.md) | Pending |
| 2 | [Stepped Visual Parity](./phase-02-stepped-visual-parity.md) | Pending |
| 3 | [Per-Item Source Cards](./phase-03-per-item-source-cards.md) | Pending |
| 4 | [Wardrobe Mode for Providers](./phase-04-wardrobe-mode-for-providers.md) | Pending |
| 5 | [Lookbook Rich Output](./phase-05-lookbook-rich-output.md) | Pending |
| 6 | [i18n Tests and Validation](./phase-06-i18n-tests-and-validation.md) | Pending |

## Dependencies

- Phase 1 (shared scaffold extraction) unblocks Phases 2-5.
- Phase 2 (stepped panels) is independent visual work; can run right after Phase 1.
- Phase 3 (per-item cards) depends on Phase 1 scaffold + Phase 2 panel styling.
- Phase 4 (wardrobe) depends on Phase 1; reuses Phase 3 per-item card pattern.
- Phase 5 (lookbook rich output) depends on Phase 1; independent of 3/4.
- Phase 6 (i18n/tests/validation) depends on all implementation phases.

## Cross-Plan Relationship

- Builds on completed `plans/260531-1614-provider-studio-prompt-reuse` (logic parity).
  That plan is `status: complete`, so no active `blockedBy`. This plan is the UI sibling.
- No overlap with `260531-2053-harness-docs-consistency-entrypoint` (docs/CLI tooling).

## Success Criteria (whole plan)

- [ ] Grok and GPT studios visually resemble Gemini: stepped panels, rounded cards,
      "Step 1/Step 2" headings, section titles.
- [ ] Try-On in providers uses per-item source cards (uploader + type + note + add/remove).
- [ ] Try-On exposes a Multi-Model / Wardrobe toggle; Wardrobe runs sets × items.
- [ ] Lookbook in providers shows rich output (variations + close-up + version history).
- [ ] Gemini studio behavior unchanged; `providerIsolation` test still green.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test` green,
      `npm run build` succeeds.
- [ ] UI boundary test still passes (no service/config imports in components).

## Risks (whole plan)

- **Scope creep** — full parity is large. Mitigate: phases are independently shippable;
  Phase 2 alone gives ~80% visual similarity. Stop points are explicit.
- **GPT timeout amplification** — wardrobe/variations multiply slow GPT calls. Mitigate:
  low concurrency, prominent time warning, allow per-feature opt-out for GPT.
- **Divergence between Grok and GPT studios** — mitigate by extracting shared scaffold
  in Phase 1 before adding richness.
- **Boundary regressions** — new hooks must own service/config imports. Mitigate: run
  `ui-boundary-imports.test.ts` each phase.

## Red Team Review

### Session — 2026-05-31
**Reviewers:** Failure Mode Analyst, Assumption Destroyer, Scope Auditor
**Findings:** 9 raised — 7 accepted, 2 rejected
**Severity (accepted):** 2 High, 4 Medium, 1 Low

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Per-item card UI assumes `images[0]`=subject invariant, but `useProviderStudioFields` indexes source arrays by SOURCE position (0 = images[1]). Add/remove on the subject vs a source shift indices differently — easy off-by-one between `images[]` and `sourceItemTypes/Notes`. | High | Accept | Phase 3 |
| 2 | `useProviderWardrobe` must NOT import provider services or it breaks the hook boundary intent. Boundary test only scans `src/components` + `App.tsx`, NOT `src/hooks` — so a violation would pass tests silently and rot the architecture. | High | Accept | Phase 4 |
| 3 | GPT wardrobe/variations multiply ~60-90s calls; even concurrency 1 means a 4-set wardrobe ≈ 4-6 min and is tunnel-timeout-prone. Plan should let GPT cap sets/variations harder or warn explicitly, not just "low concurrency". | Medium | Accept | Phase 4, 5 |
| 4 | `LookbookOutput` reuse decision is left as (a)-or-(b) inside Phase 5 — undecided work. Must resolve in Phase 5 step 1 before building, else risk half-coupling. | Medium | Accept | Phase 5 |
| 5 | Feature/studio-switch reset effect currently clears prompt/images/fields/batch/lookbook. New state (tryOnMode, wardrobe sets, lookbook output history) must be added to the SAME reset or stale state leaks across workflows. | Medium | Accept | Phase 4, 5 |
| 6 | Abort handling: in-flight wardrobe/variation batches must abort on unmount/studio-switch (existing AbortController pattern) or late responses overwrite new-feature state. | Medium | Accept | Phase 4, 5 |
| 7 | No key-parity guard between en.ts and vi.ts — VI mirrors are added by hand and silently drift. | Low | Accept | Phase 6 |

#### Rejected Findings

| # | Finding | Reason |
|---|---------|--------|
| R1 | "Just make providers import the Gemini feature components directly for true parity." | Violates boundary + Gemini coupling to `imageEditingService`/gallery; the whole point is provider-isolated UI. |
| R2 | "Add a shared StudioContext to avoid props drilling." | Validated decision in foundation plan: no new context; drilling is 1-2 levels. Out of scope. |

#### Applied Changes

- **Phase 3:** Centralize ALL `images[]` + type/note mutations in `useProviderStudioFields`
  helpers (`addSourceItem/removeSourceItem/updateSourceItem`) with an explicit invariant:
  source index `i` ↔ `images[i+1]`; subject add/remove handled separately. Add a unit test
  for alignment after arbitrary add/remove sequences (already in Phase 3 success criteria).
- **Phase 4:** Make `useProviderWardrobe` service-agnostic (takes `generateSet` callback);
  add a NEW boundary assertion — extend `ui-boundary-imports.test.ts` (or add a hooks-scoped
  variant) to also forbid `src/services/*` imports inside `src/hooks/useProvider*.ts`.
- **Phases 4 & 5:** GPT gets hard caps (sets ≤ 2, variations = 1) + prominent time warning,
  not merely low concurrency. Document the cap in i18n hint.
- **Phase 5:** Build a new provider-specific `ProviderLookbookOutput`; use Gemini
  `LookbookOutput` as visual reference only and leave Gemini UI untouched.
- **Phases 4 & 5:** Extend the feature/studio-switch reset effect + AbortController teardown
  to cover `tryOnMode`, wardrobe sets, and lookbook output history.
- **Phase 6:** Add an en/vi key-parity test (assert both locale objects have identical key sets).

## Validation Log

### Session 1 — 2026-05-31
**Trigger:** `/ck:plan validate` — critical-questions interview (Fact Checker + Contract Verifier + Scope Auditor)
**Claims checked:** 12 | Verified: 11 | Failed: 0 | Unverified: 1

#### Verification Findings

- **Verified:** Foundation plan `260531-1614-provider-studio-prompt-reuse` is `status: complete`
  — its hooks/components exist (`useProviderStudioFields`, `useProviderTryOnBatch`,
  `useProviderLookbookFields`, `useProviderResultActions`, `ProviderSourceFields`,
  `ProviderTryOnExtras`, `ProviderResultsGrid`, `ProviderResultTile`).
- **Verified:** `WardrobeSetCard.tsx` is fully presentational (callbacks only, no service import) — reusable.
- **Verified:** `useWardrobeMode.ts` imports `editImage` from `imageEditingService` — NOT reusable in providers (confirms need for a service-agnostic provider wardrobe hook).
- **Verified:** `buildProviderStudioPrompt` already accepts `sourceItemTypes`, `sourceItemNotes`,
  `backgroundPrompt`, `extraPrompt`, `isMultiPersonMode`, `lookbookState`, `fabricTextureImage`
  — richer UI feeds existing options, no new prompt logic needed.
- **Verified:** `ui-boundary-imports.test.ts` scans only `src/components/**` + `App.tsx` (not hooks)
  — confirms Red Team finding #2; Phase 4 must add hook-scoped boundary coverage.
- **Verified:** Both studio hooks share the same reset-on-feature-change effect — confirms finding #5.
- **Unverified:** Exact prop shape of `LookbookOutput.tsx` (data-only vs Gemini-coupled) — deferred to
  Phase 5 step 1 by design (decision gate before build).

#### Confirmed Decisions

- Build once in shared scaffold (Phase 1) before adding richness — prevents Grok/GPT divergence.
- Provider wardrobe + lookbook engines are service-agnostic; studio hooks inject `generate*` callbacks.
- GPT gets hard caps + warnings, not just concurrency tuning.
- Plan is independently shippable: Phases 1-2 deliver ~80% visual win; 3/4/5 are additive.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-06.
- Stale-term / renamed-API / superseded-decision scan: 0 contradictions.
- Reconciled references: GPT caps now consistent across Phase 4, 5, and plan Risks.
- Boundary-test extension referenced consistently in Phase 4 + Phase 6.
- Unresolved contradictions: 0.

### Session 2 — 2026-05-31
**Trigger:** `/ck:plan validate plans/260531-2132-provider-studio-ui-parity/` — critical-questions interview after code-evidence pass
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** `LookbookOutput.tsx` hiện là presentational/data-callback only nhưng vẫn hardcode vài chi tiết Gemini (`Feature.Lookbook`, props chưa export). Phase 5 nên xử lý thế nào?
   - Options: Generalize nhẹ | Provider riêng | Quyết khi cook
   - **Answer:** Provider riêng
   - **Rationale:** Keeps Gemini Lookbook output untouched and avoids coupling provider rich output to Gemini prop contracts.

2. **[Performance/Risk]** Với GPT Image chậm và dễ timeout, hard cap provider Wardrobe/Lookbook nên đặt cụ thể thế nào?
   - Options: 2 sets, 1 variation | 2 sets, 2 variations | Cho user override
   - **Answer:** 2 sets, 1 variation
   - **Rationale:** Minimizes timeout/cost risk for slow GPT multipart edits while still delivering visible parity.

3. **[Scope]** Phase 5 Lookbook rich output là phần sâu nhất và P3. Khi triển khai plan, nó nên là bắt buộc trong cùng đợt hay có thể tách sau?
   - Options: Tách sau nếu cần | Bắt buộc đủ parity | Chỉ MVP output
   - **Answer:** Tách sau nếu cần
   - **Rationale:** Allows shipping the Phases 1-4 provider UI checkpoint once gates are green; Phase 5 remains additive.

4. **[Boundary]** Test boundary mới cho hooks nên chặn service/config imports ở phạm vi nào?
   - Options: Chỉ useProvider*.ts | Tất cả hooks | Không thêm test
   - **Answer:** Chỉ useProvider*.ts
   - **Rationale:** Shared provider helper hooks should stay service-agnostic; provider-specific studio hooks intentionally own provider service/config imports.

#### Confirmed Decisions
- Provider Lookbook rich output uses a new `ProviderLookbookOutput` component; `LookbookOutput.tsx` remains a visual reference only.
- GPT Wardrobe cap: max 2 sets, concurrency 1. GPT Lookbook cap: max 1 variation, serial execution.
- Phases 1-4 are a shippable checkpoint if quality gates pass; Phase 5 may follow later.
- Hook boundary coverage targets shared `src/hooks/useProvider*.ts` helpers only.

#### Action Items
- [x] Propagate provider-specific Lookbook output decision to Phase 5.
- [x] Propagate exact GPT caps to Phase 4, Phase 5, and plan summary.
- [x] Propagate Phase 1-4 checkpoint wording to plan summary and Phase 6 gates/docs step.
- [x] Propagate hook boundary scope to Phase 6.

#### Impact on Phases
- Phase 4: exact GPT Wardrobe cap and concurrency are now specified.
- Phase 5: no generalization decision remains; build provider-specific output and cap GPT variations at 1.
- Phase 6: supports checkpoint gates/docs after Phase 4 and full gates/docs after Phase 5.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-06.
- Decision deltas checked: 4 (Lookbook output strategy, GPT caps, Phase 1-4 checkpoint, hook boundary scope).
- Reconciled stale references: 7.
- Unresolved contradictions: 0.
