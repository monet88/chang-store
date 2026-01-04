# Chang-Store: Codebase Summary

**Last Updated:** 2026-01-04

## 1. Directory Structure

```
Chang-Store/
├── components/           # React UI components (30+ files)
│   ├── modals/          # Modal dialogs (6 files)
│   └── [Feature].tsx    # Feature components
├── contexts/            # React Context providers (4 files)
├── hooks/               # Custom hooks per feature (13 files)
├── services/            # API service layer (8 files)
│   ├── gemini/          # Gemini-specific services
│   └── tauriService.ts  # Desktop native features bridge
├── locales/             # i18n translations (2 files)
├── utils/               # Utility functions (3 files)
│   └── lookbookPromptBuilder.ts  # Pure prompt generation functions
├── src-tauri/           # Tauri desktop app (Rust backend)
├── App.tsx              # Root component with provider stack
├── index.tsx            # Entry point
└── types.ts             # Shared TypeScript definitions
```

## 2. Key Files and Purposes

### 2.1 Entry Points

| File | Purpose |
|------|---------|
| `index.tsx` | React DOM render, mounts `<App />` |
| `App.tsx` | Provider hierarchy, feature routing, global modals |

### 2.2 Type Definitions

| File | Contents |
|------|----------|
| `types.ts` | `Feature` enum, `ImageFile`, `AspectRatio`, `AIVideoAutoModel`, model types |

### 2.3 Context Providers

| File | State Managed |
|------|---------------|
| `contexts/LanguageContext.tsx` | Current locale, translation function `t()` |
| `contexts/ApiProviderContext.tsx` | API keys, model selection, per-feature model resolution |
| `contexts/ImageGalleryContext.tsx` | Session image gallery (add/remove/list) |
| `contexts/ImageViewerContext.tsx` | Fullscreen image viewer state |

### 2.4 Service Layer

| File | Responsibility |
|------|----------------|
| `services/apiClient.ts` | Gemini SDK initialization, API key management |
| `services/imageEditingService.ts` | Unified facade routing to Gemini or AIVideoAuto |
| `services/gemini/image.ts` | Gemini image generation/editing |
| `services/gemini/text.ts` | Gemini text generation |
| `services/gemini/video.ts` | Gemini video generation (Veo) |
| `services/aivideoautoService.ts` | AIVideoAuto API integration |
| `services/tauriService.ts` | Tauri desktop native features bridge |
| `utils/lookbookPromptBuilder.ts` | Pure functions for lookbook prompt generation |

### 2.5 Feature Components

| Component | Hook | Description |
|-----------|------|-------------|
| `VirtualTryOn.tsx` | `useVirtualTryOn` | Garment overlay on person |
| `LookbookGenerator.tsx` | - | Orchestrator for lookbook creation (delegates to form/output) |
| `LookbookForm.tsx` | - | Input UI for lookbook generator (memoized) |
| `LookbookOutput.tsx` | - | Output display with tabs (main/variations/closeup) |
| `BackgroundReplacer.tsx` | `useBackgroundReplacer` | AI background replacement |
| `PoseChanger.tsx` | `usePoseChanger` | Model pose transformation |
| `SwapFace.tsx` | `useSwapFace` | Face swap between images |
| `PhotoAlbumCreator.tsx` | `usePhotoAlbum` | Multi-image album styling |
| `OutfitAnalysis.tsx` | `useOutfitAnalysis` | Style critique + redesign |
| `Relight.tsx` | `useRelight` | Lighting adjustment |
| `Upscale.tsx` | - | Image resolution enhancement |
| `ImageEditor.tsx` | `useImageEditor` | Canvas-based editor |
| `Inpainting.tsx` | `useInpainting` | Mask-based region editing |
| `VideoGenerator.tsx` | `useVideoGenerator` | Text/image to video |
| `GRWMVideoGenerator.tsx` | `useGRWMVideoGenerator` | GRWM video creation |
| `VideoContinuity.tsx` | - | Multi-scene video (WIP) |

### 2.6 Shared Components

| Component | Purpose |
|-----------|---------|
| `Header.tsx` | Sidebar navigation, feature selection |
| `GalleryButton.tsx` / `GalleryModal.tsx` | Session image gallery |
| `SettingsModal.tsx` | API key configuration, model selection |
| `ImageUpload.tsx` | Reusable image upload with preview |
| `Icons.tsx` | SVG icon library |

## 3. Module Relationships

```
App.tsx
  └── Providers (Language -> Api -> ImageGallery -> ImageViewer)
        └── AppContent
              ├── Header (feature selection)
              ├── Feature Components (conditionally rendered)
              ├── GalleryModal (overlay)
              └── SettingsModal (overlay)

Feature Component
  └── useFeatureHook()
        ├── useApi() - model selection
        ├── useLanguage() - translations
        ├── useImageGallery() - save results
        └── imageEditingService - API calls
```

## 4. Data Flow

1. **User Input** -> Component state (via hook)
2. **Generation Trigger** -> Hook calls `imageEditingService`
3. **Service Routing** -> Based on model prefix (`aivideoauto--` or Gemini)
4. **API Response** -> `ImageFile` returned to hook
5. **State Update** -> Component re-renders with results
6. **Gallery Save** -> `addImage()` persists to session context

## 5. File Statistics

| Directory | File Count | Primary Extension |
|-----------|------------|-------------------|
| `components/` | ~45 | `.tsx` |
| `hooks/` | 13 | `.ts` |
| `services/` | 8 | `.ts` |
| `contexts/` | 4 | `.tsx` |
| `locales/` | 2 | `.ts` |
| `utils/` | 3 | `.ts` |

**Total Source Files:** ~108 (excluding node_modules, tests)
**Estimated Token Count:** ~200k tokens
