---
title: Provider Studio Feature Parity with Gemini
description: >-
  Bring the Grok and GPT Image provider studios to full feature parity with the
  Gemini studio: reuse the Gemini prompt builders (rules), then add source-item
  types/notes, background + extra-instruction fields, refine, upscale,
  regenerate-single, multi-person targeting, batch subjects, and the full
  Lookbook control surface. Gemini pipeline stays untouched.
status: complete
priority: P2
branch: feat/three-provider-studios
tags:
  - frontend
  - providers
  - prompt-engineering
  - image-api
  - feature-parity
blockedBy: []
blocks: []
created: '2026-05-31T09:14:49.929Z'
createdBy: 'ck:plan'
source: skill
---

# Provider Studio Feature Parity with Gemini

## Overview

The Grok and GPT Image provider studios are a one-shot "prompt + image POST" reduction of
the Gemini studio. Validation (see Validation Log, Session 1) proved they are NOT at parity:
the prompt-rules gap is only 1 of ~11 capability gaps. **User chose Path A — full parity.**

This plan brings both provider studios to feature parity with Gemini, capability by
capability, each test-gated, **without ever touching the Gemini pipeline**. The original
prompt-builder reuse is the foundation (Phases 1–2); the remaining phases add the rest of
the Gemini feature surface.

### Why Path A is feasible (validated)

Gemini's "advanced" features are **client-side orchestration**, not Gemini-API-exclusive:
- **Refine** = `chat.ts` re-sends the current image + prompt each turn (client-side history,
  no native chat). Reproducible on the provider edit endpoint: feed the result image back as
  the source for the next edit.
- **Upscale** = an `editImage` call with a preservation-first 2K/4K prompt. Grok also supports
  native `resolution: '2k'`.
- **Multi-person targeting** = `compositeMarkerOnImage` paints a red dot on a canvas, then
  sends the composited image. Pure client-side; provider-agnostic.
- **Batch** = `runBoundedWorkers` loops subjects with bounded concurrency. Provider-agnostic.
- **Regenerate single** = re-invoke the same edit for one result slot.

So every gap is portable to the provider edit/generate endpoints. The only true API limits:
Grok caps reference images at 3 (GPT at 10) and `n` 1–10 — already enforced.

## Core Decision (validated against codebase)

- Gemini builders return `Part[]` (interleaved text + inline images). Provider services
  take `prompt: string` + `images: ImageFile[]` separately. Bridge = extract the **text**
  segments from the builder's `Part[]` and pass images separately. (Phase 1)
- All parity logic lives in the provider hooks (`useGrokStudio` / `useGptImageStudio`) and a
  shared adapter; provider **services** stay thin. Gemini builders/services reused as-is.
- Q3=A: builder rules are primary, the user's note is appended. Q4=B: the studio UI gains a
  **dedicated extra-instructions field** (and background field for Try-On) so the user's note
  and the composed rules stay distinct — mirroring Gemini's `extraPrompt`/`backgroundPrompt`.

## Parity Backlog (the ~11 gaps, mapped to phases)

| # | Capability | Gemini source | Phase |
|---|---|---|---|
| 1 | Prompt builders (garment/preservation rules) | `buildVirtualTryOnParts` etc. | 1–2 |
| 2 | Per-source-item **type** (clothing/shoes/bag/accessory) | `sourceItemType` | 3 |
| 3 | Per-source-item **note** | `sourcePrompt` | 3 |
| 4 | **Background prompt** field | `backgroundPrompt` | 3 |
| 5 | **Extra instructions** field (Q4=B) | `extraPrompt` | 3 |
| 6 | **Refine** (iterative edit) | `createImageChatSession` | 4 |
| 7 | **Upscale** 2K/4K | `upscaleImage` | 4 |
| 8 | **Regenerate single** result | `handleRegenerateSingle` | 4 |
| 9 | **Multi-person targeting** (red-dot marker) | `compositeMarkerOnImage` | 5 |
| 10 | **Batch** subjects (bounded concurrency) | `runBoundedWorkers` | 5 |
| 11 | Lookbook **style/garment/fabric/negative/variations/close-ups** | `buildLookbookPrompt` + form | 6 |
| — | Auto **describe** clothing (text model) | `generateClothingDescription` | 6 |

## Per-Feature Prompt Mapping (Phase 1 adapter)

| Feature | Builder reused | Image roles + field mapping |
|---|---|---|
| Try-On | `buildVirtualTryOnParts` | image[0]=subject, image[1..]=source items (per-item type from Phase 3); `extraPrompt`+`backgroundPrompt` from Phase 3 fields |
| Clothing Transfer | `buildClothingTransferParts` | image[0]=concept/destination, image[1..]=source outfit; user note → extra instructions |
| Pattern Generator | `buildPatternGeneratorParts` | all images = references; user prompt appended to `TASK_PROMPT` (ref-agnostic when no image) |
| Lookbook | `buildLookbookPrompt` | clothing refs; Phase 6 adds the full control surface so style is user-chosen, not forced |
| AI Editor | (none — Gemini also sends raw) | adapter returns the raw prompt unchanged |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Shared Prompt Text Extraction](./phase-01-shared-prompt-text-extraction.md) | Complete |
| 2 | [Provider Studio Adapter Wiring](./phase-02-provider-studio-adapter-wiring.md) | Complete |
| 3 | [Source-Item Types, Notes, Background and Extra Instructions](./phase-03-source-item-fields.md) | Complete |
| 4 | [Refine, Upscale and Regenerate-Single](./phase-04-refine-upscale-regenerate.md) | Complete |
| 5 | [Multi-Person Targeting and Batch Subjects](./phase-05-multiperson-and-batch.md) | Complete |
| 6 | [Lookbook Control Surface and Auto-Describe](./phase-06-lookbook-parity.md) | Complete (control surface; variations/close-ups/describe deferred — see Phase 7) |
| 7 | [Verification, Parity Matrix and Docs](./phase-07-verification-and-docs.md) | Complete |

## Dependencies

- Builds on completed plan `260530-1351-three-provider-studios` (which intentionally sent raw
  prompts and deferred builder reuse). This plan reverses that deferral and extends to full
  parity. Prior plan is `complete` — no blocking relationship.
- Phase 2 depends on Phase 1. Phase 3 depends on Phase 2 (adapter consumes the new fields).
- Phase 4 depends on Phase 2 (refine/upscale reuse the wired generate path). Phase 5 depends
  on Phase 4 (batch/regenerate share the per-job runner). Phase 6 depends on Phase 1 (adapter
  Lookbook branch). Phase 7 depends on all.
- Sequencing rationale: highest output-quality value first (prompt rules → input fidelity →
  post-generation tools), heaviest/lowest-certainty last (multi-person, batch, Lookbook form).

## Primary Touchpoints

- Create: `src/utils/provider-studio-prompt-adapter.ts`
- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts`
- Modify: `src/components/studios/GrokStudio.tsx`, `src/components/studios/GptImageStudio.tsx`
- Modify: `src/components/studios/provider-studio/providerWorkflows.ts` (per-feature field flags)
- Modify: `src/components/studios/provider-studio/ProviderResultsGrid.tsx` (refine/upscale/regen controls)
- Modify: `src/locales/en.ts`, `src/locales/vi.ts`
- Reuse unchanged: `src/utils/*-prompt-builder.ts`, `lookbookPromptBuilder.ts`,
  `src/utils/imageUtils.ts` (`compositeMarkerOnImage`), `src/utils/run-bounded-workers.ts`
- Provider services (`grokImageService.ts`, `gptImageService.ts`): extend only if refine/upscale
  need a new param; prefer reusing existing `edit`/`generate`.
- Create tests mirroring each new source file under `__tests__/`.
- Modify (docs): `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, provider studio docs.

## Success Criteria

- [x] Every Gemini feature capability in the Parity Backlog is available in BOTH Grok and GPT
      Image studios (or explicitly documented as API-constrained with the closest equivalent).
- [x] Provider Try-On/Clothing Transfer/Pattern/Lookbook prompts are builder-composed
      (contain rule phrases, e.g. "never tucked in").
- [x] Source items carry type + note; background and extra-instruction fields feed the builder.
- [x] Refine, upscale (2K/4K), and regenerate-single work on provider results.
- [x] Multi-person targeting and batch subjects work in provider studios.
- [x] Lookbook exposes style/garment/fabric/negative. _(Variations/close-ups/auto-describe deferred — documented subset, see Phase 7 parity matrix.)_
- [x] **Empirical:** Grok AND GPT Image Try-On with the DEFAULT prompt produce untucked results (live proxy verified).
- [x] Gemini pipeline byte-unchanged; all existing Gemini tests stay green.
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run test` pass; Phase 7 parity matrix complete.

## Risks

- **Scope is large** (~11 caps × 2 providers). Mitigation: strict phase sequencing, each phase
  independently shippable and test-gated; stop/reassess after each.
- **Composed-prompt efficacy unproven (red-team F1/F3)** — provider models may bind positional
  labels weakly. Mitigation: Phase 2 Try-On-first smoke test; fall back to curated rule excerpt.
- **Refine on stateless provider endpoints** — no server chat history. Mitigation: client-side
  re-send of the latest image + instruction (exactly how Gemini `chat.ts` already works).
- **Provider API ceilings** — Grok ≤3 refs, GPT ≤10; some Gemini batch sizes won't map 1:1.
  Mitigation: clamp + document; surface limits in UI (already partly enforced).
- **UI complexity creep** — provider studios were intentionally minimal. Mitigation: reuse
  Gemini components/patterns where possible; keep provider components thin (logic in hooks).


## Red Team Review

### Session 1 — 2026-05-31
**Reviewers:** Assumption Destroyer, Failure Mode Analyst, Security Adversary
**Findings:** 8 raw → 6 accepted, 2 rejected
**Severity (accepted):** 1 Critical, 2 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Builder text uses positional role labels ("SUBJECT:", "SOURCE ITEM #1") that rely on Gemini's interleaved `Part[]` ordering. Provider APIs send images as a flat array with no per-image text anchor — the model may not bind "SOURCE ITEM #1" to images[1]. Efficacy is UNPROVEN; "phrase present" ≠ "output improved". | Critical | Accept | plan, Phase 1, Phase 3 |
| 2 | Lookbook default `studio background` assumes a **person** photo ("The person and their complete outfit"), but the provider Lookbook workflow input is **clothing reference** images. Wrong default → incoherent output. | High | Accept | plan, Phase 1 |
| 3 | The proven win (untucked shirt) used ONE targeted sentence, not the full ~1.5k-char builder block. Dumping the entire rule wall may dilute attention or fight the provider model. Full-text efficacy unproven. | High | Accept | Phase 3 |
| 4 | Image-order convention (image[0]=subject) is unenforced in UI; reversed upload makes builder text actively wrong. Original mitigation ("document in hint") is weak. | Medium | Accept | Phase 2, Phase 3 |
| 5 | Pattern Generator text-only path: `TASK_PROMPT` says "based on the reference image(s) above" even when no image is uploaded — minor incoherence. | Medium | Accept | Phase 1 |
| 6 | Success criteria assert phrase presence only. Need an empirical before/after output check gate. | Medium | Accept | plan, Phase 3 |

#### Rejected Findings

| # | Finding | Reason |
|---|---------|--------|
| R1 | Prompt-injection via composed text | User prompt is the only untrusted input and already passes `validatePrompt` (10k cap, control-char strip) at the service layer. Builder text is static/trusted. No new surface. |
| R2 | New network/secret exposure | Pure client-side text composition. No new requests, no new secrets. Out of scope. |

#### Reconciliation (applied)

- **F1 + F3 + F6 → staged rollout, not big-bang.** Phase 2 wiring now lands Try-On
  **first** behind the adapter, then Phase 3 runs a mandatory empirical before/after smoke
  test (default prompt, no manual hints) on Grok Try-On to confirm the composed prompt
  actually fixes the tucked-in defect **before** the other features are trusted. If full
  builder text underperforms a targeted rule subset, fall back to a curated rules excerpt.
- **F2 → Lookbook default changed** from `studio background` to `flat lay` (clothing-only
  presentation, no person assumption), matching the provider Lookbook input (clothing refs).
  Lookbook efficacy explicitly deferred to the Phase 3 smoke check; if poor, Lookbook may
  keep raw-prompt passthrough rather than force a wrong style.
- **F4 → UI hint copy** added to Phase 2 acceptance (Try-On / Clothing Transfer upload
  labels state "first image = model/scene, next = clothing"). Keeps parity with Gemini's
  single-subject convention.
- **F5 → adapter normalizes** Pattern Generator text-only by using a reference-agnostic task
  string when `images.length === 0` (drop "above").

### Whole-Plan Consistency Sweep (Red Team Session 1)
- Files reread: plan.md, phase-01, phase-02, phase-03
- Decision deltas checked: 6 accepted
- Reconciled stale references:
  - Lookbook default `studio background` → `flat lay` (plan Per-Feature table, Phase 1 step 3)
  - Success criteria: added empirical output check (plan + Phase 3)
  - Rollout: Try-On-first staged verification (Phase 2/3)
- Unresolved contradictions: 0


## Validation Log

### Session 1 — 2026-05-31
**Trigger:** `/ck:plan validate` — critical-questions interview + full-tier codebase verification
**Questions asked:** 4 (+1 pivotal scope clarification from user)
**Tier:** Full (Fact Checker + Contract Verifier + Flow Tracer + Scope Auditor)
**Verification Results:** Claims checked: 9 | Verified: 9 | Failed: 0 | Unverified: 0

#### Verification Findings

- **Verified:** `MAX_PROMPT_LENGTH = 10_000` in `validatePrompt.ts` — plan's length claim correct.
- **Verified:** All four Gemini builders exist with the signatures the adapter assumes
  (`buildVirtualTryOnParts`, `buildClothingTransferParts`, `buildPatternGeneratorParts`, `buildLookbookPrompt`).
- **Verified:** Existing hook tests (`__tests__/hooks/useGrokStudio.test.tsx`,
  `useGptImageStudio.test.tsx`) assert **routing only** (`editX` vs `generateX`), NOT prompt
  content → adapter won't break them. Plan's "existing tests pass" claim holds; Phase 3's
  "update tests asserting raw prompt" is effectively a no-op for hooks.
- **Verified:** Provider service tests pass `prompt` directly to the service (not through the
  adapter) → unaffected.
- **Verified:** `MultiImageUploader` preserves upload order → image[0]=subject assumption feasible.

#### PIVOTAL FINDING — Scope mismatch (user intent ≠ original plan)

User asked: *"tất cả các feature ở GPT/Grok đã hoàn toàn giống với Gemini chưa? Tôi cần như
vậy — feature Gemini đã hoạt động hoàn hảo."*

Verification proves provider studios are **NOT** at parity with Gemini. The prompt-rules gap
this plan targets is only **1 of ~11** capability gaps. Gemini feature hooks
(`useVirtualTryOn`, `useLookbookGenerator`, etc.) carry far more than a prompt + image POST:

| Capability | Gemini | Provider studio (Grok/GPT) |
|---|---|---|
| Prompt builders (garment/preservation rules) | ✅ | ❌ (raw prompt) — *this plan* |
| Per-source-item **type** (clothing/shoes/bag/accessory) | ✅ `sourceItemType` | ❌ all treated as generic |
| Per-source-item **note** (`sourcePrompt`) | ✅ | ❌ |
| Separate **background prompt** | ✅ `backgroundPrompt` | ❌ |
| Separate **extra instructions** field | ✅ `extraPrompt` | ❌ (single prompt box) |
| **Refine** (iterative chat session) | ✅ `createImageChatSession` | ❌ |
| **Upscale** (2K/4K) | ✅ `upscaleImage` | ❌ |
| **Regenerate single** result | ✅ | ❌ |
| **Multi-person targeting** (red-dot marker) | ✅ `isMultiPersonMode` | ❌ |
| **Batch** subjects (bounded workers) | ✅ `runBoundedWorkers` | ❌ |
| Lookbook **style/garment/fabric/negative** controls | ✅ rich form | ❌ (no style picker; needs forced default) |
| Auto **describe** clothing (text model) | ✅ `generateClothingDescription` | ❌ |

**Lookbook specifically:** Gemini Lookbook input IS clothing references (same as provider) —
so the input type matches. But Gemini exposes 7 styles + garment type + fabric texture +
negative prompt + variations + close-ups. The provider studio has none of these and would
have to hardcode a single style, which can never match Gemini's output range.

#### Questions & Answers

1. **[Scope] Q1 — Is Lookbook input identical to Gemini?**
   - **Finding/Answer:** Input (clothing refs) matches, but Gemini Lookbook has a full
     style/garment/fabric/negative control surface the provider studio lacks. Forcing one
     default style ≠ parity.
2. **[Efficacy] Q2 — Full builder text vs curated excerpt first?**
   - **Answer:** A — start full text, gate on Phase 3 smoke test, fall back to excerpt if poor.
3. **[UX] Q3 — Where does the user's raw prompt go in the builder?**
   - **Answer:** A — builder rules primary, user prompt appended as `extraPrompt`/`clothingDescription`.
4. **[UX] Q4 — Add a separate "extra instructions" field?**
   - **Answer:** B — YES, add a dedicated extra-instructions field so the user's note and the
     composed rules are distinct (mirrors Gemini's `extraPrompt`/`backgroundPrompt` split).
5. **[Scope] Pivotal — "I need ALL provider features to fully match Gemini."**
   - **Answer:** True parity is the goal, not just the prompt fix. This re-scopes the plan
     from "prompt reuse" to "provider studio feature parity with Gemini."

#### Confirmed Decisions

- **Re-scope:** This plan is no longer prompt-only. It becomes the foundation phase of a
  larger **provider-studio parity** effort. The prompt-builder reuse (original Phases 1–2)
  is correct and stays as **Phase 1–2 (foundation)**, but the plan now explicitly enumerates
  the full parity backlog and sequences it.
- **Q2=A, Q3=A, Q4=B** applied: adapter composes builder rules + appends user note; UI gains a
  dedicated extra-instructions field (Q4=B) so raw note and rules stay separate.
- **Parity is large** — implement in risk/value order, each capability test-gated, Gemini
  pipeline never touched. Provider services stay one-shot where the provider API can't do
  chat-refine; refine/upscale reuse the same provider edit endpoint with preservation prompts.

#### Action Items

- [x] Append this validation log.
- [ ] Re-scope plan.md Overview + add a "Parity Backlog" section enumerating all ~11 gaps.
- [ ] Add Phase 4 (per-source-item type + note + background + extra-instructions fields).
- [ ] Add Phase 5 (Refine + Upscale + Regenerate single, reusing provider edit endpoint).
- [ ] Add Phase 6 (Lookbook control surface: style/garment/fabric/negative) — or accept a
      documented subset if full parity is disproportionate (YAGNI check with user).
- [ ] Add Phase 7 (Batch subjects + multi-person targeting) — flagged as highest-effort,
      lowest-certainty; confirm with user whether in-scope.

#### Open Question for User (blocks final phase sequencing)

Full parity is a **large** effort (~11 capabilities × 2 providers). Two honest paths:
- **Path A — Full parity:** implement every Gemini capability in both provider studios.
  Largest scope; some features (multi-person red-dot, batch, chat-refine) may be constrained
  by what the Grok/GPT image endpoints actually support.
- **Path B — Core parity (recommended, KISS):** match the high-value feature behaviors
  (prompt rules, source-item types/notes, background + extra fields, refine, upscale,
  regenerate) and accept documented gaps for the heaviest Gemini-specific extras (multi-person
  targeting, batch). Most output-quality parity for far less risk.

### Whole-Plan Consistency Sweep (Validation Session 1)
- Files reread: plan.md, phase-01, phase-02, phase-03
- Decision deltas checked: 5 (Q1–Q4 + pivotal re-scope)
- Reconciled stale references: plan is mid-rescope — Overview/phases updated in the edits
  following this log. Until the user picks Path A vs B, Phases 4–7 remain provisional.
- Unresolved contradictions: 1 — **final phase set depends on user's Path A/B choice** (see
  Open Question above). Do NOT proceed to `/ck:cook` until resolved.


### Validation Session 1 — Resolution (Path chosen)

**User chose Path A — full parity.** Open question resolved. Plan re-scoped from 3 phases
(prompt-only) to **7 phases** (full provider-studio parity with Gemini):

1. Shared Prompt Text Extraction (was P1)
2. Provider Studio Adapter Wiring (was P2)
3. Source-Item Types, Notes, Background & Extra Instructions (gaps #2–5; Q4=B field added)
4. Refine, Upscale & Regenerate-Single (gaps #6–8)
5. Multi-Person Targeting & Batch Subjects (gaps #9–10)
6. Lookbook Control Surface & Auto-Describe (gap #11 + describe)
7. Verification, Parity Matrix & Docs (was the old Phase 3)

Feasibility re-verified: Gemini's advanced features are client-side orchestration
(`chat.ts` refine, `compositeMarkerOnImage`, `runBoundedWorkers`, preservation-prompt
upscale) — all portable to the provider edit/generate endpoints. No Gemini-API-exclusive
blockers. Only hard limits: Grok ≤3 / GPT ≤10 reference images, `n` 1–10 (already enforced).

### Whole-Plan Consistency Sweep (Validation Session 1 — final)
- Files reread: plan.md + phase-01..07
- Reconciled stale references:
  - Phase 2 "stop for the Phase 3 smoke test" → "Phase 7 consolidated smoke test"
  - Phase 2 "Phase 3 updates test assertions" → "update assertions in this phase"
  - Phase 1 `DEFAULT_PROVIDER_LOOKBOOK_STATE` clarified as initial value (Phase 6 adds picker)
  - plan Phases table: removed stray CLI-numbered "Phase 7" duplicate; now 7 sequential phases
  - Red Team Session 1 findings (F1–F6) remain valid; F2 (Lookbook default) now superseded by
    Phase 6 (real user-chosen style) — F2's `flat lay` default stays only as the pre-Phase-6 initial
- Unresolved contradictions: 0 (Path A/B resolved → Path A)
