# Execution Plan: LookbookGenerator Refactor

**Epic:** cs-k72
**Generated:** 2026-01-15

## Tracks

| Track | Agent | Beads (in order) | File Scope |
|-------|-------|------------------|------------|
| 1 | BlueLake | cs-ctd → cs-1l9 → cs-sin → cs-5fy | `hooks/useLookbookGenerator.ts`, `components/LookbookGenerator.tsx` |

## Track Details

### Track 1: BlueLake - Hook Enhancement + Component Refactor

**File scope**: `hooks/useLookbookGenerator.ts`, `components/LookbookGenerator.tsx`

**Beads (sequential - each blocks next):**

1. `cs-ctd`: Add missing state to useLookbookGenerator hook
   - Add `aspectRatio`, `resolution` state with setters
   - Add `refinementVersions` array state
   - Add `selectedVersionIndex` state
   - Add `originalImageRef` using useRef
   - Export `imageEditModel` for UI display

2. `cs-1l9`: Add missing handlers to useLookbookGenerator hook
   - Add `handleSelectVersion` handler
   - Add `handleClearForm` handler
   - Wrap ALL handlers in `useCallback`
   - Update return object with new exports

3. `cs-sin`: Refactor component to use hook as single source of truth
   - Replace all state with hook destructuring
   - Remove all handler implementations
   - Remove helper functions
   - Keep only JSX composition (~50 lines)

4. `cs-5fy`: Cleanup and verify LookbookGenerator refactor
   - Remove unused imports
   - Update component JSDoc
   - Run `npm run build`
   - Manual smoke test

## Cross-Track Dependencies

None - single track, sequential execution.

## Acceptance Criteria

- [ ] `LookbookGenerator.tsx` < 80 lines
- [ ] `useLookbookGenerator.ts` is single source of truth
- [ ] No duplicated logic between files
- [ ] `npm run build` passes
- [ ] All lookbook features functional

## Risk Assessment

| Task | Risk | Mitigation |
|------|------|------------|
| State migration | LOW | TypeScript catches mismatches |
| Handler migration | LOW | Identical implementations |
| useRef refactor | MEDIUM | Manual test chat session lifecycle |

## Estimated Effort

- Total: ~2 hours
- cs-ctd: 30 min
- cs-1l9: 30 min  
- cs-sin: 45 min
- cs-5fy: 15 min
