# Phase 1: Remove Local Provider and Anti Provider — keep Gemini only - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all Local Provider and Anti Provider code from the codebase. After this phase, the app has a single AI backend: Google Gemini SDK. All provider routing logic (`local--`/`anti--` prefixes, `isLocalModel`/`isAntiModel` checks) is eliminated. The `imageEditingService.ts` facade becomes a thin pass-through to Gemini services.

</domain>

<decisions>
## Implementation Decisions

### File deletion
- **D-01:** Delete `localProviderService.ts`, `antiProviderService.ts` entirely
- **D-02:** Delete `localModels.ts`, `localModels.data.js`, `antiModels.ts`, `antiModels.data.js`
- **D-03:** Delete test file `__tests__/services/localProviderService.test.ts`

### Service simplification
- **D-04:** Remove all `isLocalModel`/`isAntiModel` branches in `imageEditingService.ts` — each function keeps only the Gemini path
- **D-05:** Remove `LOCAL_PREFIX`, `ANTI_PREFIX`, prefix-stripping helpers, `buildLocalSize`, `buildLocalConfig`, `buildAntiConfig`
- **D-06:** Simplify `ApiConfig` to remove `localApiBaseUrl`, `localApiKey`, `antiApiBaseUrl`, `antiApiKey`
- **D-07:** Remove local/anti routing in `textService.ts`

### Context & state
- **D-08:** Remove `localApiBaseUrl`, `localApiKey`, `antiApiBaseUrl`, `antiApiKey` from `ApiProviderContext.tsx`

### Settings UI
- **D-09:** Remove all Local/Anti API configuration fields from `SettingsModal.tsx` completely (not hiding)

### i18n
- **D-10:** Remove all translation keys related to local/anti provider in `en.ts` and `vi.ts`

### Hooks & components
- **D-11:** Remove `localApi`/`antiApi` config destructuring from all hooks and components that pass it to services

### Agent's Discretion
- Whether to keep or simplify the `provider` field in `logApiCall` (can be hardcoded to 'Gemini')
- Whether `buildLocalSize` resolution logic should be preserved for Gemini or removed entirely

</decisions>

<specifics>
## Specific Ideas

No specific requirements — straightforward deletion/simplification.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Service architecture
- `src/services/AGENTS.md` — Service routing rules, provider stack documentation
- `AGENTS.md` — Root-level architecture overview, provider prefix table

### Provider files (to be deleted)
- `src/services/localProviderService.ts` — Local Provider REST client
- `src/services/antiProviderService.ts` — Anti Provider REST client
- `src/utils/localModels.ts` + `src/utils/localModels.data.js` — Local model definitions
- `src/utils/antiModels.ts` + `src/utils/antiModels.data.js` — Anti model definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to delete
- `src/services/localProviderService.ts` — Local Provider REST client
- `src/services/antiProviderService.ts` — Anti Provider REST client
- `src/utils/localModels.ts`, `src/utils/localModels.data.js`
- `src/utils/antiModels.ts`, `src/utils/antiModels.data.js`
- `__tests__/services/localProviderService.test.ts`

### Files to modify
- `src/services/imageEditingService.ts` — core facade, every function has local/anti/gemini branches
- `src/services/textService.ts` — text generation routing
- `src/contexts/ApiProviderContext.tsx` — stores local/anti API config
- `src/components/modals/SettingsModal.tsx` — Local/Anti API config UI
- Hooks: `useVirtualTryOn`, `useClothingTransfer`, `useBackgroundReplacer`, `usePoseChanger`, `useLookbookGenerator`, `useOutfitAnalysis`, `useUpscale`, `useSwapFace`
- Components: `AIEditor`, `ImageEditor`, `OutfitAnalysis`, `PoseChanger`, `PhotoAlbumCreator`, `Relight`

### Integration points
- `ApiProviderContext` provides config to all hooks/components
- `imageEditingService.ts` is the unified facade — all hooks call through it

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-remove-local-provider-and-anti-provider-keep-gemini-only*
*Context gathered: 2026-03-26*
