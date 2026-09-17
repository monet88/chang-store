# Product Overview

Chang Store is an AI-powered virtual fashion studio. Users upload photos of
people and clothing, then use AI image models to generate styled outputs:
virtual try-ons, lookbooks, background replacements, pose changes, and more.

The app ships **three isolated provider studios** behind a header switch:
**Gemini** (default, full-featured), **Grok** (xAI), and **GPT Image** (OpenAI).
Gemini is the primary studio with all ten workflows; the Grok and GPT Image
studios cover five workflows each. See `provider-studios.md` for the studio
split contract.

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
| Identity Transfer | `IdentityTransfer` | Apply one shared identity across destination images |
| Pattern Generator | `PatternGenerator` | Generate textile/fabric patterns |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| AI Backend | Google Gemini SDK (`@google/genai`); plus Grok (xAI) and GPT Image (OpenAI) REST in provider studios |
| Storage | IndexedDB (idb-keyval), Google Drive (optional) |
| Build/Deploy | Vite, Vercel |

## Architecture Summary

```
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

No React Router. `App.tsx` switches on `Feature` enum with lazy-loading.
Provider nesting: `LanguageProvider → ToastProvider → ApiProvider →
GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`.

`AppContent` also holds a `StudioMode` (`gemini | grok | gptImage`). The Gemini
studio uses the pipeline above; Grok and GPT Image studios are isolated and call
their own provider services (`src/services/providers/*`). See
`provider-studios.md`.

## Model Selection

Three model selection types managed by `ApiProviderContext`:

- **imageEdit** — Gemini image models for editing existing images; default `gemini-3.1-flash-image`
- **imageGenerate** — Gemini image models for generating new images; default `gemini-3.1-flash-image`
- **textGenerate** — Gemini text models for prompt generation; default `gemini-3.5-flash`

Model registry at `src/config/modelRegistry.ts` defines capabilities per model
(aspect ratio support, image size support).

## Persistence

- Gallery images: IndexedDB via `src/utils/galleryDB.ts`
- Session state: localStorage via `src/utils/storage.ts`
- Optional cloud sync: Google Drive via `src/services/googleDriveService.ts`
- Image cache: IndexedDB via `src/utils/imageCache.ts`
