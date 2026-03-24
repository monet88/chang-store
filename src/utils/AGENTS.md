# UTILS - Helpers & Configs

## OVERVIEW
16 files. Pure functions: prompt builders, image processing, model configs, caching, storage, ZIP. No side effects, no state, no context imports.

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Lookbook prompts | `lookbookPromptBuilder.ts` | Style builders: flatlay, folded, mannequin, hanger, studio, showroom |
| Try-on prompts | `virtual-try-on-prompt-builder.ts` | Garment-aware prompt construction |
| Clothing transfer prompts | `clothing-transfer-prompt-builder.ts` | Transfer-specific prompt |
| Watermark prompts | `watermark-prompts.ts` | Predefined configs + custom prompt |
| Image processing | `imageUtils.ts` | `getImageDimensions`, `blobToBase64`, `compressImage`, `cropAndCompressImage`, `getErrorMessage` |
| Image caching | `imageCache.ts` | `ImageLRUCache<T>` — add/remove/getAll/getMetrics |
| Local models | `localModels.ts` | `LOCAL_TEXT_MODELS`, `LOCAL_IMAGE_MODELS`, `withLocalPrefix()` |
| Anti models | `antiModels.ts` | `ANTI_TEXT_MODELS`, `ANTI_IMAGE_MODELS`, `withAntiPrefix()` |
| Raw model data | `localModels.data.js`, `antiModels.data.js` | Static config arrays (JS, not TS) |
| Batch processing | `batch-image-session.ts` | Batch session management helpers |
| Bounded concurrency | `run-bounded-workers.ts` | Worker pool for parallel image ops (limit: 3) |
| Storage | `storage.ts` | localStorage: lookbook sets, backup/restore |
| ZIP download | `zipDownload.ts` | `downloadImagesAsZip()` via JSZip |
| Photo album config | `photoAlbumConfig.ts` | Mode/preset configuration |

## CONVENTIONS
- Pure functions — no imports from `contexts/` or `hooks/`
- `getErrorMessage(err, t)` is the centralized i18n-aware error formatter — use it everywhere
- Prompt builders take a form-state interface + images, return a prompt string
- Model config files export typed arrays (`LocalModelOption[]`, `AntiModelOption[]`)

## NOTES
- `storage.ts` has stub functions — may need implementation
- `.data.js` files are raw JS (not TS) — intentional for large static data
- Canvas-heavy functions excluded from unit tests (need integration tests)
