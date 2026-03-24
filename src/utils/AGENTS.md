# UTILS - Helpers & Configs

## OVERVIEW
15 files. Pure functions: prompt builders, image processing, model configs, caching. No side effects, no state.

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Lookbook prompts | `lookbookPromptBuilder.ts` | Style-specific builders (flatlay, folded, mannequin, hanger, studio, showroom) |
| Try-on prompts | `virtual-try-on-prompt-builder.ts` | Garment-aware prompt construction |
| Watermark prompts | `watermark-prompts.ts` | Predefined configs + custom prompt support |
| Image processing | `imageUtils.ts` | `getImageDimensions`, `blobToBase64`, `compressImage`, `cropAndCompressImage`, `getErrorMessage` |
| Image caching | `imageCache.ts` | `ImageLRUCache<T>` class with add/remove/getAll/getMetrics |
| Local models | `localModels.ts` | `LOCAL_TEXT_MODELS`, `LOCAL_IMAGE_MODELS`, `withLocalPrefix()` |
| Anti models | `antiModels.ts` | `ANTI_TEXT_MODELS`, `ANTI_IMAGE_MODELS`, `withAntiPrefix()` |
| Model data | `localModels.data.js`, `antiModels.data.js` | Raw model config data |
| Storage | `storage.ts` | localStorage helpers (lookbook sets, backup/restore) |
| ZIP download | `zipDownload.ts` | `downloadImagesAsZip()` via JSZip |

## CONVENTIONS
- Pure functions — no imports from contexts or hooks
- `getErrorMessage(err, t)` is the centralized error formatter (i18n-aware)
- Model config files export typed arrays (`LocalModelOption[]`, `AntiModelOption[]`)
- Prompt builders take a form state interface + images, return prompt string

## NOTES
- `storage.ts` has some stub functions — may need implementation
- Canvas-heavy functions excluded from unit tests (need integration tests)
