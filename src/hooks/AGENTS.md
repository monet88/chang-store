# HOOKS - Feature Logic Layer

## OVERVIEW
15 hooks: one per feature + 2 shared canvas/drawing hooks. All business logic, state, validation, and service orchestration lives here. Never import from contexts inside services — only hooks mediate.

## WHERE TO LOOK
| Task | Hook | Notes |
|------|------|-------|
| Image editing | `useImageEditor.ts` | Canvas history, undo/redo, tool switching |
| Lookbook flow | `useLookbookGenerator.ts` | Draft persistence + variations + chat refinement |
| Try-on flow | `useVirtualTryOn.ts` | Batch processing + per-item upscaling |
| Clothing transfer | `useClothingTransfer.ts` | Batch processing with Gemini override |
| Upscaling | `useUpscale.ts` | Multi-phase: analysis → prompt → upscale |
| Face swap | `useSwapFace.ts` | Style analysis + face transfer |
| Pose change | `usePoseChanger.ts` | Reference image + pose description |
| Background | `useBackgroundReplacer.ts` | AI description + replacement |
| Outfit analysis | `useOutfitAnalysis.ts` | Step-based wizard + redesign presets |
| Batch watermark | `useWatermarkRemover.ts` | Concurrency control + retry + ZIP download |
| Canvas drawing | `useCanvasDrawing.ts` | Metrics, marching ants, animation cleanup (shared) |
| Inpainting | `useInpainting.ts` | Mask drawing + prompt |
| Drive sync | `useGoogleDriveSync.ts` | Queue-based upload/delete + retry |
| Relighting | `useRelight.ts` | Single image relighting |
| Photo album | `usePhotoAlbum.ts` | `fullModel`/`faceAndOutfit` modes |

## CONVENTIONS
- Every feature hook: `useLanguage()` + `useApi()` + optional `useImageGallery()`
- Error pattern: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`
- Build service config via `buildImageServiceConfig(onStatusUpdate)` helper
- Validate inputs before calling services
- Feature model routing: `getModelsForFeature(Feature.Xxx)`
- Batch hooks: `useRef` for ID counters, bounded concurrency (3 workers via `run-bounded-workers.ts`)
- Lookbook persists drafts in localStorage with debounce

## ANTI-PATTERNS
- No JSX/UI in hooks — return `{ state, handlers }` only
- No direct external API calls — route through `services/`
- No API key storage in state — use `ApiProviderContext`
- Canvas hooks MUST return cleanup in `useEffect` (cancelAnimationFrame)
- Never skip `finally` — always reset `isLoading` and `loadingMessage`

## COMPLEX STATE MACHINES
- `useImageEditor`: Canvas history stack, undo/redo, tool switching, adjustment layers
- `useVirtualTryOn` / `useClothingTransfer`: Bounded concurrency, per-item status tracking
- `useLookbookGenerator`: Debounced localStorage, refinement versioning
- `useGoogleDriveSync`: Async queue via refs (avoids stale closures), local↔Drive ID mapping
- `useUpscale`: Multi-phase workflow with per-image studio state

## NOTES
- `useWatermarkRemover` takes `addToGallery` as param (not context) — intentional for batch ops
- No reducers — all state via `useState`/`useRef`
