# Execution Plan: Lookbook AI - Iterative Refinement

## Epic Context

**EPIC_ID**: `cs-ot2`
**Sub-Epic**: `cs-6ey` (Phase 1: Backend Services)

**Objective**: Add prompt input below generated lookbook image for iterative refinement using Gemini multi-turn chat context.

## Parallel Tracks

### Track 1: Backend Foundation (BlueLake)
**Agent**: BlueLake
**Beads**: Phase 1 → Phase 2 (sequential, backend-only)
**File Scope**: `src/services/gemini/**, src/services/imageEditingService.ts, src/hooks/useLookbookGenerator.ts`

**Responsibilities**:
1. Create Gemini chat service module (`services/gemini/chat.ts`)
2. Implement `ImageChatSession` with refinement, history, reset
3. Export from `imageEditingService.ts`
4. Extend `useLookbookGenerator` hook with refinement state
5. Add handlers: `handleRefineImage`, `handleResetRefinement`

**Dependencies**: None (independent work)

---

### Track 2: Frontend Components (GreenCastle)
**Agent**: GreenCastle
**Beads**: Phase 3 → Phase 4 (sequential, frontend-only)
**File Scope**: `src/components/**, src/locales/**`

**Responsibilities**:
1. Create `RefinementInput` component with collapsible history
2. Integrate into `LookbookOutput.tsx`
3. Update `LookbookGenerator.tsx` prop passing
4. Add i18n strings (English + Vietnamese)
5. Add tooltips and polish UX

**Dependencies**: Track 1 must complete Phase 2 (hook exports ready) before Track 2 can test integration

---

## Cross-Track Dependencies

| Blocker | Description | Resolution |
|---------|-------------|------------|
| Track 2 awaits Track 1 Phase 2 | Frontend needs hook exports (`refinementHistory`, `isRefining`, handlers) | Track 1 completes Phase 2, then Track 2 can integrate |

**Resolution Strategy**: Track 1 runs Phases 1-2 sequentially first. Track 2 waits for Track 1 Phase 2 completion before starting Phase 3.

## Execution Order

```
[Track 1]
  Phase 1: Chat Service (2h)
    ├─ Create chat.ts
    ├─ Implement ImageChatSession
    └─ Export from imageEditingService
  ↓
  Phase 2: Hook State (2h)
    ├─ Add state: chatSession, refinementHistory, isRefining
    ├─ Add handleRefineImage handler
    ├─ Add handleResetRefinement handler
    └─ Export new props
  ↓
  [NOTIFY] "Track 1 Phase 2 COMPLETE → Track 2 can start Phase 3"

[Track 2] (waits for Track 1 Phase 2)
  Phase 3: UI Components (1.5h)
    ├─ Create RefinementInput component
    ├─ Add collapsible history UI
    ├─ Integrate into LookbookOutput
    └─ Update LookbookGenerator props
  ↓
  Phase 4: i18n & Polish (0.5h)
    ├─ Add English translations
    ├─ Add Vietnamese translations
    ├─ Add tooltips
    └─ Final verification
```

## File Ownership

**Track 1 (BlueLake):**
- `src/services/gemini/chat.ts` (create)
- `src/services/imageEditingService.ts` (modify - export)
- `src/hooks/useLookbookGenerator.ts` (modify - state + handlers)

**Track 2 (GreenCastle):**
- `src/components/shared/RefinementInput.tsx` (create)
- `src/components/LookbookOutput.tsx` (modify - integrate component)
- `src/components/LookbookGenerator.tsx` (modify - pass props)
- `src/locales/en.ts` (modify - add translations)
- `src/locales/vi.ts` (modify - add translations)

**No Overlap**: File scopes are mutually exclusive.

## Agent Mail Protocol

### Track Coordination Thread
**Thread ID**: `cs-ot2`

**Messages**:
- `[Track 1] Phase 1 COMPLETE` → BlueLake to Orchestrator
- `[Track 1] Phase 2 COMPLETE` → BlueLake to Orchestrator (CRITICAL: unblocks Track 2)
- `[Track 2] Phase 3 COMPLETE` → GreenCastle to Orchestrator
- `[Track 2] Phase 4 COMPLETE` → GreenCastle to Orchestrator
- `[EPIC] cs-ot2 COMPLETE` → Orchestrator to All

### Track Self-Context Threads
- `track:BlueLake:cs-ot2` → BlueLake's learnings, gotchas
- `track:GreenCastle:cs-ot2` → GreenCastle's learnings, gotchas

## Success Criteria

**Track 1 Complete When**:
- Chat service exports `createImageChatSession`, `ImageChatSession`, `RefinementHistoryItem`
- Hook exports: `chatSession`, `refinementHistory`, `isRefining`, `handleRefineImage`, `handleResetRefinement`
- TypeScript compiles without errors
- Manual API test successful

**Track 2 Complete When**:
- RefinementInput renders below generated image
- History collapsible, time-ago format works
- Refine button triggers handler, shows loading
- Reset button clears session
- i18n works in both EN and VI
- No hardcoded strings

**Epic Complete When**:
- All 4 phases done
- Integration test: Generate → Refine → See new image → History updates → Reset works
- Both languages tested
- No TypeScript errors, no runtime errors

## Verification Checklist

```bash
# Track 1 verification
npm run build  # Must pass
# Manual test: import { createImageChatSession } from './services/imageEditingService'

# Track 2 verification
npm run lint   # Must pass
npm run dev    # UI renders correctly
# Manual test: Generate lookbook → See refinement input → Type prompt → Refine → See result

# Integration verification
# 1. Generate lookbook image
# 2. Type "make background darker" → Click Refine
# 3. Verify refined image appears
# 4. Verify history shows "make background darker - Xm ago"
# 5. Type "add warmer lighting" → Click Refine
# 6. Verify history shows both items
# 7. Click Reset → Verify session cleared
# 8. Switch language to VI → Verify translations
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Gemini API safety block | Add error handling in chat.ts with i18n key `error.api.safetyBlock` |
| Session timeout | Auto-recreate session on `sendRefinement` error |
| Large image payload | Already handled by existing compression in `imageUtils.ts` |
| Context window overflow | Limit history display to 10 items in UI (service tracks all) |

## Notes

- **No new Beads issues created yet** - orchestrator will track progress via phases
- Plan already exists in `plans/260114-1216-lookbook-iterative-refinement/`
- Total effort: 6h (Track 1: 4h, Track 2: 2h)
- Estimated parallelism: Minimal (Track 2 blocked until Track 1 Phase 2 done)
