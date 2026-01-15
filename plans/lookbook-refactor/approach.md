# Approach: LookbookGenerator Refactor

## Gap Analysis Summary

| Component | Have | Need | Gap |
|-----------|------|------|-----|
| State management | Duplicated in both | Single source in hook | Consolidate |
| Version history | Component only | Hook | Move to hook |
| aspectRatio/resolution | Component only | Hook | Add to hook |
| clearForm | Component only | Hook | Add to hook |
| useCallback optimization | Component only | Hook | Add to hook |
| useRef for session | Component only | Hook | Add to hook |

## Recommended Approach

**Strategy: Incremental Consolidation**

1. Enhance hook with missing features
2. Replace component implementation with hook usage
3. Remove all duplicated code from component
4. Component becomes ~50 line thin wrapper

### Why This Approach
- LOW risk: Pattern already proven in `VirtualTryOn`
- Minimal blast radius: Only 2 files
- Testable incrementally
- No new dependencies

### Alternative Approaches

1. **Rewrite from scratch** - Higher risk, same outcome
2. **Keep both, sync state** - Anti-pattern, more complexity

## Risk Map

| Component | Risk | Reason | Verification |
|-----------|------|--------|--------------|
| State consolidation | LOW | Direct move, no logic change | TypeScript |
| Version history move | LOW | Self-contained logic | Manual test |
| Handler migration | LOW | Identical implementations | TypeScript |
| useRef refactor | MEDIUM | Session lifecycle change | Manual test |

## Decomposition

### Phase 1: Enhance Hook (LOW risk)
1. Add `aspectRatio`, `resolution` state + setters
2. Add `refinementVersions`, `selectedVersionIndex` state
3. Add `originalImageRef` using useRef
4. Add `handleSelectVersion`, `handleClearForm` handlers
5. Wrap all handlers in `useCallback`
6. Export `imageEditModel` for UI

### Phase 2: Refactor Component (LOW risk)
1. Import and use `useLookbookGenerator` hook
2. Remove all duplicated state
3. Remove all duplicated handlers
4. Keep only JSX composition
5. Pass hook values to child components

### Phase 3: Cleanup (LOW risk)
1. Remove unused imports from component
2. Update component JSDoc
3. Run typecheck + lint
4. Manual smoke test

## Acceptance Criteria

- [ ] Component < 80 lines
- [ ] Hook is single source of truth for all state
- [ ] No duplicated handlers between files
- [ ] `npm run build` passes
- [ ] All lookbook features work (generate, variations, closeup, refine, upscale)

## Files to Modify

| File | Action | Lines Changed |
|------|--------|---------------|
| `hooks/useLookbookGenerator.ts` | Enhance | +80 lines |
| `components/LookbookGenerator.tsx` | Refactor | -350 lines |
