# Architecture

Chang Store is a React 19 + TypeScript + Vite single-page application.
All AI processing happens client-side via the Google Gemini SDK — there is
no custom backend server.

## Product Surface

- **Browser SPA** — the only runtime surface.
- No server, no API routes, no database server.
- AI calls go directly from the browser to Google Gemini endpoints.

## Core Pattern

```text
Component (thin UI)
  → Hook (state + logic)
    → Service Facade (imageEditingService.ts)
      → Gemini SDK (@google/genai)
```

Components are thin UI wrappers with zero business logic. All state management,
API orchestration, error handling, and gallery integration live in the paired
hook. Services are stateless facades that format requests and parse responses.

## Directory Structure

```text
src/
├── components/          # UI layer — feature screens + shared UI
│   └── modals/          # Modal dialogs (settings, pose library, prompt library)
├── hooks/               # Feature logic — one hook per feature
├── services/            # API facades (stateless)
│   └── gemini/          # Gemini SDK wrappers (image, text, chat, video)
├── contexts/            # Global state providers
├── config/              # Model capability registry
├── utils/               # Pure helpers, prompt builders
├── data/                # Static data files
├── locales/             # i18n strings (en.ts source, vi.ts mirror)
└── types.ts             # Shared type definitions + Feature enum
```

## Feature Routing

No React Router. `App.tsx` switches on the `Feature` enum with lazy-loading:

```text
Feature.TryOn → VirtualTryOn.tsx
Feature.Lookbook → LookbookGenerator.tsx
Feature.Background → BackgroundReplacer.tsx
Feature.Pose → PoseChanger.tsx
Feature.PhotoAlbum → PhotoAlbumCreator.tsx
Feature.AIEditor → AIEditor.tsx
Feature.WatermarkRemover → WatermarkRemover.tsx
Feature.ClothingTransfer → ClothingTransfer.tsx
Feature.PatternGenerator → PatternGenerator.tsx
```

## Provider Nesting (order matters)

```text
LanguageProvider
  → ToastProvider (lives in src/components/Toast.tsx)
    → ApiProvider
      → GoogleDriveProvider
        → ImageGalleryProvider
          → ImageViewerProvider
            → AppContent
```

Each provider depends on its parent. Do not reorder.

## Service Routing

All image operations route through `src/services/imageEditingService.ts`.
This facade delegates to `src/services/gemini/image.ts` for the actual SDK
calls. Never bypass the facade from hooks or components.

```text
Hook → imageEditingService.editImage(params, model, config)
     → imageEditingService.upscaleImage(...)
     → imageEditingService.createImageChatSession(...)
         ↓
     gemini/image.ts → @google/genai SDK
```

Text generation routes through `src/services/textService.ts` which uses
`src/services/gemini/text.ts`.

## Model Selection

Three model categories managed by `ApiProviderContext`:

| Category | Purpose | Storage Key |
| --- | --- | --- |
| imageEdit | Edit existing images | `image_edit_model` |
| imageGenerate | Generate new images | `image_generate_model` |
| textGenerate | Text/prompt generation | `text_generate_model` |

Model registry at `src/config/modelRegistry.ts` defines per-model capabilities
(aspect ratio support, image size support) and defaults.

## State Management

| Concern | Mechanism |
| --- | --- |
| Feature state | Hook-local `useState` |
| Global model/key | `ApiProviderContext` |
| Gallery images | `ImageGalleryContext` + IndexedDB |
| Language | `LanguageContext` |
| Toast notifications | `ToastProvider` |
| Session persistence | localStorage via `utils/storage.ts` |
| Image cache | IndexedDB via `utils/imageCache.ts` |

## Persistence Layer

No server database. All persistence is browser-local:

- **IndexedDB** (idb-keyval): gallery images, image cache
- **localStorage**: session state, model preferences, draft forms
- **Google Drive** (optional): cloud sync via `googleDriveService.ts`

## Dependency Rule

| Layer | May import from | Must not import from |
| --- | --- | --- |
| Components | hooks, contexts, types, components/ui | services directly |
| Hooks | services, contexts, utils, types | components |
| Services | utils, types, @google/genai | hooks, components, contexts |
| Utils | types only | anything else |
| Contexts | types, services (for init only) | hooks, components |

Components must never call services directly — always go through hooks.

## Build and Deploy

- **Dev**: `npm run dev` (Vite, port 3000)
- **Build**: `npm run build` (Vite production build)
- **Deploy**: Vercel (static SPA)
- **Env vars**: Gemini API key injected via `vite.config.ts` `define` block
  for all modes (not just development)

## Observability

- `src/services/debugService.ts` logs API calls with provider, model, feature,
  prompt, duration, and success/failure.
- No server-side logging — all observability is client-side console.
