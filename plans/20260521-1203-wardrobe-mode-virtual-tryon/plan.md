---
status: pending
created: 2026-05-21
scope: Virtual Try-On Wardrobe Mode
brainstorm: plans/reports/brainstorm-20260521-wardrobe-mode.md
---

# Wardrobe Mode — Implementation Plan

## Overview

Add "Wardrobe" mode to Virtual Try-On: 1 model × N outfit sets → N images. Inverse of existing Multi-Model mode.

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | Types & data model | pending | `src/types.ts` |
| 2 | Hook logic (wardrobe sub-hook) | pending | `src/hooks/useWardrobeMode.ts` (new), `src/hooks/useVirtualTryOn.ts` |
| 3 | Component UI (mode toggle + wardrobe cards) | pending | `src/components/VirtualTryOn.tsx`, `src/components/WardrobeSetCard.tsx` (new) |
| 4 | i18n strings | pending | `src/locales/en.ts`, `src/locales/vi.ts` |
| 5 | Tests | pending | `__tests__/hooks/useWardrobeMode.test.tsx` (new), `__tests__/components/VirtualTryOn.test.tsx` |

## Dependencies

- Phase 2 depends on Phase 1 (types)
- Phase 3 depends on Phase 2 (hook exports)
- Phase 4 can run parallel with Phase 2-3
- Phase 5 after all others

## Key Decisions

- Prompt builder and service layer: NO changes needed
- Extract `WardrobeSetCard` component if VirtualTryOn.tsx exceeds 700 LOC
- Extract wardrobe logic to `src/hooks/useWardrobeMode.ts` sub-hook
- State preserved when switching modes (no reset)
- Wardrobe mode starts with 1 empty set by default
- Multi-person mode NOT supported in Wardrobe mode (single-person only)
- Correct type for set items: `VirtualTryOnClothingItem` (not `ClothingItemState`)

## Phases (Updated Files)

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | Types & data model | pending | `src/types.ts` |
| 2 | Hook logic (wardrobe sub-hook) | pending | `src/hooks/useWardrobeMode.ts` (new), `src/hooks/useVirtualTryOn.ts` |
| 3 | Component UI (mode toggle + wardrobe cards) | pending | `src/components/VirtualTryOn.tsx`, `src/components/WardrobeSetCard.tsx` (new) |
| 4 | i18n strings | pending | `src/locales/en.ts`, `src/locales/vi.ts` |
| 5 | Tests | pending | `__tests__/hooks/useWardrobeMode.test.tsx` (new), `__tests__/components/VirtualTryOn.test.tsx` |

## Validation Log

### Session 1 — 2026-05-21
**Trigger:** /ck:plan validate

### Verification Results
- **Tier:** Full (5 phases)
- **Claims checked:** 12
- **Verified:** 11 | **Failed:** 1 | **Unverified:** 0

#### Failures
1. [Fact Checker] `ClothingItemState` — type not found. Actual: `VirtualTryOnClothingItem` (src/types.ts:126)

#### Questions & Answers

1. **[Architecture]** State preservation on mode switch?
   - Options: Preserve state | Reset on switch
   - **Answer:** Preserve state
   - **Rationale:** User can switch freely without losing uploaded images

2. **[Architecture]** Hook extraction strategy?
   - Options: Extract sub-hook | Keep in single hook
   - **Answer:** Extract sub-hook (`useWardrobeMode.ts`)
   - **Rationale:** Keep each file under 400 LOC, separation of concerns

3. **[Scope]** Default set on first entry?
   - Options: 1 empty set | No default set
   - **Answer:** 1 empty set
   - **Rationale:** Reduces friction, user can add items immediately

4. **[Scope]** Multi-person support in Wardrobe mode?
   - Options: Single-person only | Support multi-person
   - **Answer:** Single-person only
   - **Rationale:** Simplifies implementation, multi-person is edge case for wardrobe use

#### Confirmed Decisions
- Type: `VirtualTryOnClothingItem` (not `ClothingItemState`)
- Hook: extract to `useWardrobeMode.ts`
- State: preserved across mode switches
- Default: 1 empty set on first entry
- Multi-person: disabled in wardrobe mode

#### Impact on Phases
- Phase 1: Fix type reference to `VirtualTryOnClothingItem`
- Phase 2: Create new file `src/hooks/useWardrobeMode.ts` instead of adding to existing hook
- Phase 3: Create new file `src/components/WardrobeSetCard.tsx`
- Phase 5: Test file targets `useWardrobeMode.test.tsx` instead of modifying existing test file

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04, phase-05
- Decision deltas checked: 5 (type fix, sub-hook extraction, state preservation, default set, multi-person scope)
- Reconciled stale references: 1 (old phases table in plan.md referenced wrong files)
- Unresolved contradictions: 0

## Red Team Review

### Session — 2026-05-21
**Findings:** 10 (8 accepted, 2 rejected)
**Severity breakdown:** 0 Critical, 4 High, 6 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `generateWardrobe` omits `numImages`, `aspectRatio`, `resolution` | High | Accept | Phase 2 |
| 2 | Sub-hook `useApi()` access pattern undefined | High | Accept | Phase 2 |
| 3 | Type mismatch: nullable image → prompt builder mapping missing | High | Accept | Phase 2 |
| 4 | Shared prompts conflict with "state preserved" decision | High | Accept | Phase 2, 3, 4 |
| 5 | `WardrobeResultSet` missing `error?: string` field | Medium | Accept | Phase 1 |
| 6 | Flat return spread → naming collisions | Medium | Accept | Phase 2 |
| 7 | Concurrent generation across modes not guarded | Medium | Accept | Phase 2, 3 |
| 8 | Subject snapshot needed before async workers | Medium | Accept | Phase 2 |
| 9 | `WardrobeSet.id` generation strategy undefined | Medium | Reject | — |
| 10 | Cross-set visual consistency not addressed | Medium | Reject | — |

**Rejected rationale:**
- #9: Standard useRef counter pattern obvious from codebase. Not plan-level risk.
- #10: V1 limitation. Same behavior as existing multi-model mode. Not a regression.

### Whole-Plan Consistency Sweep (Post Red-Team)
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04, phase-05
- Decision deltas checked: 8 (params interface, independent prompts, type mapping, namespaced return, isAnyGenerating, subject snapshot, concurrency cap, error field)
- Reconciled stale references: 3 (phase-02 architecture, phase-03 requirements, phase-04 keys)
- Unresolved contradictions: 0
