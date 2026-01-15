# Discovery Report: LookbookGenerator Refactor

## Problem Statement
`LookbookGenerator.tsx` (419 lines) duplicates significant logic with `useLookbookGenerator.ts` (372 lines). The component should be a thin UI wrapper but currently reimplements:
- All state management
- All handlers
- Refinement logic
- Helper functions

## Architecture Snapshot

### Current State
```
LookbookGenerator.tsx (419 lines)
├── State: formState, loading states, refinement state (duplicated)
├── Handlers: all generate/refine/upscale handlers (duplicated)
├── Helpers: requireAivideoautoConfig, buildImageServiceConfig (duplicated)
└── UI: LookbookForm + LookbookOutput composition

useLookbookGenerator.ts (372 lines)
├── State: identical state definitions
├── Handlers: identical handler implementations
├── Draft persistence: localStorage (unique to hook)
└── NOT USED by component!
```

### Target State
```
LookbookGenerator.tsx (~50 lines)
└── Thin wrapper: const { state, handlers } = useLookbookGenerator();

useLookbookGenerator.ts (~400 lines)
├── All state management
├── All handlers
├── Refinement logic (with version history)
├── Draft persistence
└── aspectRatio, resolution state (missing currently)
```

## Existing Patterns

| Pattern | Location | Reusable |
|---------|----------|----------|
| Hook + thin component | `VirtualTryOn.tsx` + `useVirtualTryOn.ts` | Yes |
| Prompt builders | `utils/lookbookPromptBuilder.ts` | Already used |
| Service config builder | Both files (duplicate) | Move to hook |

## Duplicated Code Analysis

| Code Block | Component Lines | Hook Lines | Action |
|------------|-----------------|------------|--------|
| `initialFormState` | 28-38 | 41-51 | Remove from component |
| `formState` + setters | 45-57 | 56-86 | Use hook's |
| `refinementHistory/versions` | 67-70 | 73-75 | Consolidate in hook |
| `handleRefineImage` | 83-119 | 301-333 | Use hook's |
| `handleSelectVersion` | 121-140 | Missing | Add to hook |
| `handleResetRefinement` | 142-160 | 335-341 | Use hook's (needs version support) |
| `requireAivideoautoConfig` | 165-171 | Inline in handlers | Extract helper |
| `buildImageServiceConfig` | 173-177 | 90-94 | Use hook's |
| `handleGenerateDescription` | 196-212 | 132-148 | Use hook's |
| `handleGenerate` | 214-257 | 150-215 | Use hook's |
| `handleUpscale` | 259-288 | 217-246 | Use hook's |
| `handleGenerateVariations` | 290-322 | 248-274 | Use hook's |
| `handleGenerateCloseUp` | 324-365 | 276-299 | Use hook's |

## Technical Constraints

- React 19 + Vite SPA
- Tailwind 4 for styling
- `@/` alias for imports
- Component must remain thin (per AGENTS.md)

## Gap Analysis

### Hook Missing Features (from component)
1. `aspectRatio` state + setter
2. `resolution` state + setter  
3. `refinementVersions` array for version history
4. `selectedVersionIndex` state
5. `handleSelectVersion` handler
6. `originalImageRef` for reset to original
7. `clearForm` handler

### Hook Improvements Needed
1. Use `useCallback` for all handlers (component does, hook doesn't)
2. Add `useRef` for chat session (more stable than state)
3. Return `imageEditModel` for form display
