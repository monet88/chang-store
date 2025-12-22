# Chang-Store Components Scout Report
Generated: 2025-12-22 14:36 | Agent: scout-external

## Summary
AI-powered fashion/image editing app with 14 main features: virtual try-on, image gen, video gen, and image editing.

## Application Features (via Feature enum)
| Feature ID | Feature Name |
|------------|--------------|
| try-on | Virtual Try-On |
| lookbook | Lookbook Generator |
| background | Background Replacer |
| pose | Pose Changer |
| swap-face | Swap Face |
| photo-album | Photo Album Creator |
| outfit-analysis | Outfit Analysis |
| relight | Relight |
| upscale | Upscale |
| image-editor | Image Editor |
| video | Video Generator |
| video-continuity | Video Continuity |
| inpainting | Inpainting |
| grwm-video | GRWM Video |

## Core Feature Components

### 1. VirtualTryOn.tsx
Path: F:\CodeBase\Chang-Store\components\VirtualTryOn.tsx
Purpose: Virtual clothing try-on - overlays garment images onto person photos
Props: None (uses hooks)
Dependencies: hooks/useVirtualTryOn.ts, ImageUploader, HoverableImage, Spinner, AspectRatioSelector

### 2. LookbookGenerator.tsx
Path: F:\CodeBase\Chang-Store\components\LookbookGenerator.tsx
Purpose: Generates product lookbooks with multiple poses/angles (360-spin views)
Dependencies: hooks/useLookbookGenerator.ts, ImageSpinner

### 3. BackgroundReplacer.tsx
Path: F:\CodeBase\Chang-Store\components\BackgroundReplacer.tsx
Purpose: Replaces image backgrounds via AI
Dependencies: hooks/useBackgroundReplacer.ts

### 4. PoseChanger.tsx
Path: F:\CodeBase\Chang-Store\components\PoseChanger.tsx
Purpose: Changes model poses in fashion photos
Dependencies: hooks/usePoseChanger.ts, PoseLibraryModal

### 5. SwapFace.tsx
Path: F:\CodeBase\Chang-Store\components\SwapFace.tsx
Purpose: Face swap between two images
Dependencies: hooks/useSwapFace.ts

### 6. PhotoAlbumCreator.tsx
Path: F:\CodeBase\Chang-Store\components\PhotoAlbumCreator.tsx
Purpose: Creates styled photo albums from multiple images
Dependencies: hooks/usePhotoAlbum.ts

### 7. OutfitAnalysis.tsx
Path: F:\CodeBase\Chang-Store\components\OutfitAnalysis.tsx
Purpose: AI outfit analysis + redesign suggestions
Features: Step workflow, clothing analysis, redesign presets (casual/smart-casual/luxury/asian-style)

### 8. Relight.tsx
Path: F:\CodeBase\Chang-Store\components\Relight.tsx
Purpose: Changes lighting conditions in photos
Dependencies: hooks/useRelight.ts

### 9. Upscale.tsx
Path: F:\CodeBase\Chang-Store\components\Upscale.tsx
Purpose: AI image upscaling/enhancement

### 10. ImageEditor.tsx
Path: F:\CodeBase\Chang-Store\components\ImageEditor.tsx
Purpose: Full-featured image editor with drawing tools
Dependencies: hooks/useImageEditor.ts

### 11. Inpainting.tsx
Path: F:\CodeBase\Chang-Store\components\Inpainting.tsx
Purpose: AI inpainting - edit specific regions of images
Dependencies: hooks/useInpainting.ts

### 12. VideoGenerator.tsx
Path: F:\CodeBase\Chang-Store\components\VideoGenerator.tsx
Purpose: Text/image-to-video generation
Dependencies: hooks/useVideoGenerator.ts

### 13. GRWMVideoGenerator.tsx
Path: F:\CodeBase\Chang-Store\components\GRWMVideoGenerator.tsx
Purpose: Get Ready With Me style video sequence generator
Features: Multi-image upload, AI prompt generation, sequential video creation

### 14. VideoContinuity.tsx
Path: F:\CodeBase\Chang-Store\components\VideoContinuity.tsx
Purpose: Placeholder (not yet implemented)

## Shared/Utility Components

| Component | Path | Purpose |
|-----------|------|---------|
| Header | components/Header.tsx | Sidebar navigation |
| Tabs | components/Tabs.tsx | Feature tab navigation |
| LanguageSwitcher | components/LanguageSwitcher.tsx | EN/VI toggle |
| HoverableImage | components/HoverableImage.tsx | Image with hover actions |
| ImageSpinner | components/ImageSpinner.tsx | 360-spin viewer |
| ImageUploader | components/ImageUploader.tsx | Drag-drop upload |
| Spinner | components/Spinner.tsx | Loading spinner |
| ProgressBar | components/Spinner.tsx | Progress indicator |
| ErrorDisplay | components/Spinner.tsx | Error message box |
| Tooltip | components/Tooltip.tsx | Hover tooltips |
| AspectRatioSelector | components/AspectRatioSelector.tsx | Ratio picker |
| Icons | components/Icons.tsx | 50+ SVG icons |

## Modal Components

| Modal | Path | Purpose |
|-------|------|---------|
| SettingsModal | components/modals/SettingsModal.tsx | API keys, model selection, data mgmt |
| GalleryModal | components/modals/GalleryModal.tsx | Image gallery with bulk actions |
| ImageSelectionModal | components/modals/ImageSelectionModal.tsx | Pick image from gallery |
| PoseLibraryModal | components/modals/PoseLibraryModal.tsx | Browse/select poses |
| UploadResultsModal | components/modals/UploadResultsModal.tsx | Display upload results |
| FeatureSettingsModal | components/modals/FeatureSettingsModal.tsx | Empty placeholder |

## Core Types (types.ts)
- ImageFile { base64: string; mimeType: string }
- AspectRatio = Default | 1:1 | 9:16 | 16:9 | 4:3 | 3:4
- AnalyzedItem { item, description, possibleBrands }

## File Count
- Feature Components: 14
- Shared Components: 10
- Modal Components: 6
- Total: 45 files in components/

## Unresolved Questions
1. What is the purpose of FeatureSettingsModal.tsx (empty file)?
2. Is VideoContinuity planned for future implementation?
3. Distinction between SettingsModal.tsx in root vs modals/SettingsModal.tsx?
