# Product Overview

Chang Store is an AI-powered virtual fashion studio. Users upload photos of
people and clothing, then use AI image models to generate styled outputs:
virtual try-ons, lookbooks, background replacements, pose changes, and more.

The app ships **two studios** behind a header switch: **Gemini** (default,
full-featured) and **GPT Image** (OpenAI-compatible). Both run the same
workflow views; Gemini covers all ten workflows, the GPT Image studio covers
five. See `provider-studios.md` for the studio split contract.

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
| AI Backend | Google Gemini SDK (`@google/genai`); plus GPT Image (OpenAI) REST in the GPT studio |
| Storage | IndexedDB (idb-keyval) |
| Build/Deploy | Vite, Vercel |

## Architecture Summary

```
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

No React Router. `App.tsx` switches on `Feature` enum with lazy-loading.
Provider nesting: `LanguageProvider → ToastProvider → ApiProvider →
ImageGalleryProvider → ImageViewerProvider → AppContent`.

`AppContent` also holds a `StudioMode` (`gemini | gptImage`).
`ImageEngineContext` supplies the active studio's image transport — Gemini
through `imageEditingService`, GPT Image through
`src/services/providers/gpt-image/gptImageEngine.ts` — so both studios share the
same feature hooks, prompt builders and gallery. See `provider-studios.md`.

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
- Image cache: IndexedDB via `src/utils/imageCache.ts`
