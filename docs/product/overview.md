# Product Overview

Chang Store is an AI-powered virtual fashion studio. Users upload photos of
people and clothing, then use Gemini AI models to generate styled outputs:
virtual try-ons, lookbooks, background replacements, pose changes, and more.

## Target Users

- Fashion e-commerce teams needing product imagery at scale.
- Content creators producing styled outfit visuals.
- Individual users exploring outfit combinations virtually.

## Core Value Proposition

Replace physical photoshoots with AI-generated fashion imagery. One subject
photo + one clothing photo = styled output in seconds, with configurable models,
aspect ratios, and quality settings.

## Features

| Feature | Enum Value | Purpose |
| --- | --- | --- |
| Virtual Try-On | `TryOn` | Dress a subject in uploaded clothing items |
| Lookbook Generator | `Lookbook` | Generate styled editorial spreads |
| Background Replacer | `Background` | Swap photo backgrounds via prompt or preset |
| Pose Changer | `Pose` | Re-pose a subject using reference poses |
| Photo Album | `PhotoAlbum` | Batch-generate themed photo sets |
| AI Editor | `AIEditor` | Free-form image editing via natural language |
| Watermark Remover | `WatermarkRemover` | Remove watermarks from images |
| Clothing Transfer | `ClothingTransfer` | Transfer clothing between subjects |
| Pattern Generator | `PatternGenerator` | Generate textile/fabric patterns |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| AI Backend | Google Gemini SDK (`@google/genai`) |
| Storage | IndexedDB (idb-keyval), Google Drive (optional) |
| Build/Deploy | Vite, Vercel |

## Architecture Summary

```
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

No React Router. `App.tsx` switches on `Feature` enum with lazy-loading.
Provider nesting: `LanguageProvider → ToastProvider → ApiProvider →
GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`.

## Model Selection

Three model selection types managed by `ApiProviderContext`:

- **imageEdit** — models for editing existing images (Gemini 3 Pro Image, etc.)
- **imageGenerate** — models for generating new images (Imagen 4, etc.)
- **textGenerate** — models for text/prompt generation (Gemini 2.5 Flash, etc.)

Model registry at `src/config/modelRegistry.ts` defines capabilities per model
(aspect ratio support, image size support).

## Persistence

- Gallery images: IndexedDB via `src/utils/galleryDB.ts`
- Session state: localStorage via `src/utils/storage.ts`
- Optional cloud sync: Google Drive via `src/services/googleDriveService.ts`
- Image cache: IndexedDB via `src/utils/imageCache.ts`
