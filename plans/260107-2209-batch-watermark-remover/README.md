# Batch Watermark Remover

## Overview

| Field | Value |
|-------|-------|
| Feature | Batch Watermark Remover |
| Type | New Tab Component |
| Status | Planning |
| Estimated | 8-9 hours |
| Created | 2026-01-07 |

## Summary

Add a new tab "Watermark Remover" that allows users to batch process unlimited images to remove text, logos, and watermarks using Gemini AI with configurable concurrency and retry capabilities.

## Requirements

### Confirmed Specifications

| Aspect | Decision |
|--------|----------|
| Input | Unlimited batch upload via MultiImageUploader |
| Model Selection | Separate dropdown: `gemini-2.5-flash-image` / `gemini-3-pro-image-preview` |
| Prompt Selection | 5 predefined + custom textarea |
| Concurrency | User configurable at start, default = 5 |
| Progress | Simple % per image |
| On Failure | Continue processing other images |
| Retry UI | Inline dropdown on each image |
| Gallery Save | Both individual + batch save all |
| Download | Individual + ZIP (jszip) |

### Predefined Prompts

1. **Text & Logo Removal**: "Remove all text, logos, and graphical overlays from this image. Fill the removed areas with background-appropriate content that matches the surrounding style, colors, and textures seamlessly."
2. **Clean Version**: "A clean version of this image without any written text, symbols, or branding elements. Naturally extend the background or pattern to replace removed objects."
3. **Safe & Neutral**: "Keep the original composition and style. Only remove text and graphic elements that are not part of the main scene. Fill gaps with matching visual content."
4. **Artistic/Pattern**: "Remove all non-decorative text and logos. Regenerate the underlying design, pattern, or texture to cover removed areas while maintaining artistic harmony."
5. **Quick & Simple**: "Erase text and logos. Fill with matching background."

## UI Design

```
+-------------------------------------------------------------+
|  INPUTS                        |  OUTPUTS                   |
|  ------                        |  -------                   |
|  [MultiImageUploader]          |  +---------------------+   |
|   (unlimited images)           |  | img1.jpg    OK 100% |   |
|                                |  | [Prompt 1 v] [Save] |   |
|  Model:                        |  +---------------------+   |
|  [gemini-2.5-flash-image v]    |  | img2.jpg    45%     |   |
|                                |  | Processing...       |   |
|  Prompt:                       |  +---------------------+   |
|  [1. Text & Logo Removal v]    |  | img3.jpg    ERROR   |   |
|  +------------------------+    |  | [Prompt 2 v][Retry] |   |
|  | Editable prompt...     |    |  +---------------------+   |
|  +------------------------+    |                            |
|                                |  --------------------------  |
|  Concurrency: [5]              |  [Save All to Gallery]     |
|                                |  [Download All ZIP]        |
|  [Start Processing]            |                            |
+-------------------------------------------------------------+
```

## Phases

- [Phase 1: Foundation](./phase-1-foundation.md) - Utils, types, dependencies
- [Phase 2: Hook Logic](./phase-2-hook-logic.md) - useWatermarkRemover hook
- [Phase 3: Components](./phase-3-components.md) - UI components
- [Phase 4: Integration](./phase-4-integration.md) - App.tsx, i18n
- [Phase 5: Polish](./phase-5-polish.md) - Error handling, UX

## File Changes

| File | Action | Est. Lines |
|------|--------|------------|
| `utils/watermark-prompts.ts` | Create | ~30 |
| `utils/zipDownload.ts` | Create | ~25 |
| `types.ts` | Modify | +15 |
| `hooks/useWatermarkRemover.ts` | Create | ~150 |
| `components/WatermarkRemover.tsx` | Create | ~180 |
| `components/WatermarkRemoverOutput.tsx` | Create | ~120 |
| `App.tsx` | Modify | +10 |
| `locales/en.ts` | Modify | +20 |
| `locales/vi.ts` | Modify | +20 |
| `package.json` | Modify | +1 (jszip) |

## Execution Order

```
1. npm install jszip
2. utils/watermark-prompts.ts
3. utils/zipDownload.ts
4. types.ts (add interfaces)
5. hooks/useWatermarkRemover.ts
6. components/WatermarkRemoverOutput.tsx
7. components/WatermarkRemover.tsx
8. App.tsx (add tab)
9. locales/*.ts
10. Test & polish
```

## Dependencies

- `jszip` - ZIP file creation for batch download (~50KB gzipped)

## Technical Notes

- Reuse existing: MultiImageUploader, editImage from gemini/image.ts, ImageGalleryContext
- Concurrency control using promise pool pattern
- Per-item error handling, batch continues on individual failures
- Model selection is independent from global settings
