# Chang-Store: Codebase Summary

**Last Updated:** 2026-03-17

## 1. Directory Structure

```
Chang-Store/
├── src/                      # Application source root
│   ├── components/           # React UI components (64 files)
│   │   ├── upscale/         # Upscaling features
│   │   ├── shared/          # Shared UI components
│   │   ├── modals/          # Modal dialogs (5 files)
│   │   └── [Feature].tsx    # Feature components (14 main features)
│   ├── contexts/            # React Context providers (5 files)
│   ├── hooks/               # Custom hooks per feature (15 files)
│   ├── services/            # API service layer (13 files)
│   │   └── gemini/          # Gemini-specific services (chat, image, text, video)
│   ├── locales/             # i18n translations (2 files)
│   ├── utils/               # Utility functions (12 files)
│   │   └── lookbookPromptBuilder.ts  # Pure prompt generation functions
│   ├── config/              # Config helpers
│   ├── App.tsx              # Root component with provider stack
│   ├── index.tsx            # Entry point
│   ├── index.css            # Global styles
│   └── types.ts             # Shared TypeScript definitions
├── __tests__/               # Test suites (intentionally at repo root)
```

## 2. Key Files and Purposes

### 2.1 Entry Points

| File | Purpose |
|------|---------|
| `src/index.tsx` | React 19 DOM render, mounts `<App />` |
| `src/App.tsx` | Provider hierarchy, feature routing, global modals |

### 2.2 Type Definitions

| File | Contents |
|------|----------|
| `src/types.ts` | `Feature` enum, `ImageFile`, `AspectRatio`, model types, specialized interfaces |

### 2.3 Context Providers

| File | State Managed |
|------|---------------|
| `src/contexts/LanguageContext.tsx` | Current locale (en/vi), translation function `t()` |
| `src/contexts/ApiProviderContext.tsx` | API keys, model selection, per-feature model resolution |
| `src/contexts/GoogleDriveContext.tsx` | OAuth state, token refresh, Drive integration |
| `src/contexts/ImageGalleryContext.tsx` | Gallery state with Drive sync + LRU cache |
| `src/contexts/ImageViewerContext.tsx` | Fullscreen image viewer state |

### 2.4 Service Layer

| File | Responsibility |
|------|----------------|
| `src/services/apiClient.ts` | Gemini SDK initialization, API key management |
| `src/services/imageEditingService.ts` | Unified Gemini facade for image edit/generate/upscale flows |
| `src/services/gemini/image.ts` | Gemini image generation/editing |
| `src/services/gemini/text.ts` | Gemini text generation |
| `src/services/gemini/video.ts` | Gemini video generation (Veo) |
| `src/services/gemini/chat.ts` | Gemini chat session management |
| `src/utils/lookbookPromptBuilder.ts` | Pure functions for lookbook prompt generation |

### 2.5 Feature Components

| Component | Hook | Description |
|-----------|------|-------------|
| `VirtualTryOn.tsx` | `useVirtualTryOn` | Garment overlay on person |
| `LookbookGenerator.tsx` | `useLookbook` | Orchestrator for lookbook creation |
| `BackgroundReplacer.tsx` | `useBackgroundReplacer` | AI background replacement |
| `PoseChanger.tsx` | `usePoseChanger` | Model pose transformation |
| `SwapFace.tsx` | `useSwapFace` | Face swap between images |
| `PhotoAlbumCreator.tsx` | `usePhotoAlbum` | Multi-image album styling |
| `OutfitAnalysis.tsx` | `useOutfitAnalysis` | Style critique + redesign |
| `Relight.tsx` | `useRelight` | Lighting adjustment |
| `Upscale.tsx` | `useUpscale` | Image resolution enhancement |
| `ImageEditor.tsx` | `useImageEditor` | Canvas-based editor (orchestrator) |
| `Inpainting.tsx` | `useInpainting` | Mask-based region editing |
| `VideoGenerator.tsx` | `useVideoGenerator` | Text/image to video |
| `GRWMVideoGenerator.tsx` | `useGRWMVideoGenerator` | GRWM video creation |
| `ClothingTransfer.tsx` | `useClothingTransfer` | Transfer clothing item onto a person |

### 2.6 Shared Components

| Component | Purpose |
|-----------|---------|
| `Header.tsx` | Sidebar navigation, feature selection |
| `GalleryButton.tsx` / `GalleryModal.tsx` | Image gallery with Drive sync |
| `SettingsModal.tsx` | API key configuration and Gemini model selection |
| `ImageUpload.tsx` | Reusable image upload with preview |
| `Icons.tsx` | SVG icon library |

## 3. Module Relationships

```
App.tsx
  └── Providers (Language -> Api -> GoogleDrive -> ImageGallery -> ImageViewer)
        └── AppContent
              ├── Header (feature selection)
              ├── Feature Components (conditionally rendered)
              ├── GalleryModal (overlay)
              └── SettingsModal (overlay)

Feature Component (Thin UI)
  └── useFeatureHook() (Business Logic)
        ├── useApi() - model selection and API key state
        ├── useLanguage() - translations
        ├── useImageGallery() - save results
        ├── useGoogleDrive() - cloud persistence
        └── imageEditingService - API calls
```

## 4. Data Flow

1. **User Input** -> Component state (via hook)
2. **Generation Trigger** -> Hook calls `imageEditingService`
3. **Service Routing** -> Through Gemini service facades
4. **API Response** -> `ImageFile` returned to hook
5. **State Update** -> Component re-renders with results
6. **Gallery Save** -> `addImage()` persists to session context + Google Drive sync
7. **Persistence** -> LocalStorage for settings/drafts, Drive for images

## 5. File Statistics

| Directory | File Count | Primary Extension |
|-----------|------------|-------------------|
| `src/components/` | 64 | `.tsx` |
| `src/hooks/` | 15 | `.ts` |
| `src/services/` | 13 | `.ts` |
| `src/contexts/` | 5 | `.tsx` |
| `src/locales/` | 2 | `.ts` |
| `src/utils/` | 12 | `.ts` |

**Total Source Files:** ~115 (excluding node_modules, tests)
**Estimated Token Count:** ~250k tokens
