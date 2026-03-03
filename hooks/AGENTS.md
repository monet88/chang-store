# HOOKS - Feature Logic Layer

## OVERVIEW
13 hooks: one per feature. All business logic, state, validation, and service orchestration lives here.

## WHERE TO LOOK
| Task | Hook | Notes |
|------|------|-------|
| Image editing | `useImageEditor.ts` | Canvas + history + undo/redo + tools |
| Lookbook flow | `useLookbookGenerator.ts` | Draft persistence + variations + chat refinement |
| Try-on flow | `useVirtualTryOn.ts` | Subject + clothing items + upscaling |
| Face swap | `useSwapFace.ts` | Style analysis + face transfer |
| Pose change | `usePoseChanger.ts` | Reference image + pose description |
| Background | `useBackgroundReplacer.ts` | AI description + replacement |
| Outfit analysis | `useOutfitAnalysis.ts` | Step-based wizard + redesign presets |
| Batch watermark | `useWatermarkRemover.ts` | Concurrency control + retry + ZIP |
| Canvas drawing | `useCanvasDrawing.ts` | Metrics, marching ants, cleanup (shared) |
| Inpainting | `useInpainting.ts` | Mask drawing + prompt |
| Drive sync | `useGoogleDriveSync.ts` | Queue-based upload/delete + retry |
| Relighting | `useRelight.ts` | Single image relighting |
| Photo album | `usePhotoAlbum.ts` | fullModel/faceAndOutfit modes |

## CONVENTIONS
- Every feature hook follows: `useLanguage()` + `useApi()` + optional `useImageGallery()`
- Error pattern: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`
- Build service config via `buildImageServiceConfig(onStatusUpdate)` helper
- Validate inputs before calling services
- Feature-specific model routing via `getModelsForFeature(Feature.Xxx)`
- Some hooks persist drafts in localStorage (e.g., lookbook generator)

## ANTI-PATTERNS
- No JSX or UI logic in hooks — hooks return state and handlers only
- No direct external API calls — route via `services/`
- No API key storage in hook state — use `ApiProviderContext`
- Canvas hooks MUST clean up in `useEffect` return (cancelAnimationFrame)

## NOTES
- `useWatermarkRemover` takes `addToGallery` as param (not context) — intentional for batch ops
- `useGoogleDriveSync` uses refs for async queue to avoid stale closure issues
