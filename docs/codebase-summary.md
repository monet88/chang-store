# Codebase Summary

## Statistics
- **Total Files (src/):** 104 files
- **Total Lines of Code (src/):** ~19,859 LOC
- **Total Repository Files:** 257 files (including tests, docs, planning, and config)
- **Total Repository Tokens:** 358,341 tokens

### Breakdown by Directory

| Directory | Files | LOC | Purpose |
|-----------|-------|-----|---------|
| `src/components/` | 50 | ~8,200 | UI layer: thin wrappers, feature screens, shared UI, modals |
| `src/hooks/` | 16 | ~3,800 | Feature logic and state management (one hook per feature) |
| `src/services/` | 10 | ~2,400 | API facades (stateless), Gemini SDK modules |
| `src/utils/` | 14 | ~1,900 | Pure helpers, prompt builders, image processing, ZIP/download |
| `src/locales/` | 2 | ~2,025 | i18n: `en.ts` (source of truth, ~1,011 LOC), `vi.ts` (~1,014 LOC) |
| `src/contexts/` | 5 | ~1,100 | Global state providers (Language, API, Toast, Drive, Gallery, Viewer) |
| `src/config/` | 2 | ~400 | Model capability registry, model selection rules |
| `src/data/` | 1 | ~200 | Static data and constants |
| `src/` (root) | 4 | ~834 | Main entry: `App.tsx`, `types.ts`, `main.tsx`, `index.css` |

## Key Directories

### `src/components/` (50 files, ~8,200 LOC)
- **Feature screens:** TryOn, Lookbook, Background, Pose, PhotoAlbum, AIEditor, WatermarkRemover, ClothingTransfer, PatternGenerator
- **Modals:** 5 modal components for settings, help, gallery, etc.
- **Shared UI:** Button, Input, Card, Modal, Toast, Spinner, and other reusable components
- **Layout:** Header, Sidebar, LanguageSwitcher, Icons

### `src/hooks/` (16 files, ~3,800 LOC)
One hook per feature, centralizing all state, validation, API calls, and side effects:
- `useVirtualTryOn.ts` — Virtual try-on with source type selection and garment notes
- `useLookbookGenerator.ts` — Lookbook generation
- `useBackgroundReplacer.ts` — Background replacement
- `usePoseChanger.ts` — Pose control
- `usePhotoAlbum.ts` — Photo album generation
- `useAIEditor.ts` — Prompt-driven AI editing
- `usePatternGenerator.ts` — Pattern generation
- `useClothingTransfer.ts` — Clothing transfer with spatial realism
- `useWatermarkRemover.ts` — Watermark removal with batch support
- `useModelSelection.ts` — Model registry and selection
- `useGalleryPersistence.ts` — Gallery state with IndexedDB persistence
- `useGoogleDriveSync.ts` — Google Drive integration
- `useInpainting.ts` — Inpainting operations
- `useSwapFace.ts` — Face swapping
- `usePromptLibrary.ts` — Prompt templates and history
- `useSettingsModal.ts` — Settings UI state

### `src/services/` (10 files, ~2,400 LOC)
- **`imageEditingService.ts`** (242 LOC) — Unified facade for all image operations, routes to Gemini modules
- **`geminiService.ts`** — Gemini client initialization and configuration
- **`textService.ts`** (252 LOC) — Text generation via Gemini
- **`googleDriveService.ts`** (411 LOC) — Google Drive API integration
- **`apiClient.ts`** — Base HTTP client
- **`debugService.ts`** — API call logging and debugging
- **`gemini/image.ts`** (230 LOC) — Image generation and editing
- **`gemini/text.ts`** (296 LOC) — Text generation via Gemini
- **`gemini/video.ts`** (759 LOC) — Video generation
- **`gemini/chat.ts`** — Chat interface

### `src/utils/` (14 files, ~1,900 LOC)
Utility functions organized by domain:
- **Prompt builders:** `clothing-transfer-prompt-builder.ts`, `lookbookPromptBuilder.ts`, `pattern-generator-prompt-builder.ts`, `virtual-try-on-prompt-builder.ts`, `watermark-prompts.ts`
- **Image processing:** `imageUtils.ts`, `imageCache.ts`
- **Data persistence:** `galleryDB.ts` (IndexedDB wrapper), `storage.ts`
- **Batch processing:** `batch-image-session.ts`, `run-bounded-workers.ts`
- **Download/export:** `imageDownload.ts`, `zipDownload.ts`
- **Configuration:** `photoAlbumConfig.ts`

### `src/contexts/` (5 files, ~1,100 LOC)
Global state providers (strict nesting order):
1. **`LanguageProvider`** — i18n state and `useLanguage()` hook
2. **`ToastProvider`** — Toast notifications (lives in `src/components/Toast.tsx`)
3. **`ApiProviderContext`** — API keys and model selection state
4. **`GoogleDriveContext`** (367 LOC) — Google Drive sync and auth
5. **`ImageGalleryContext`** (273 LOC) — Gallery state with IndexedDB persistence
6. **`ImageViewerContext`** — Image viewer state

### `src/config/` (2 files, ~400 LOC)
- **`modelRegistry.ts`** (218 LOC) — Model capability registry, feature-to-model mapping
- **`constants.ts`** — Application constants

### `src/locales/` (2 files, ~2,025 LOC)
- **`en.ts`** (~1,011 LOC) — English strings (source of truth)
- **`vi.ts`** (~1,014 LOC) — Vietnamese translations (mirror)

## Feature Enum (src/types.ts)
Nine features accessible via Feature enum:
1. `TryOn` — Virtual try-on with source type selection
2. `Lookbook` — Lookbook generation
3. `Background` — Background replacement
4. `Pose` — Pose changing
5. `PhotoAlbum` — Photo album generation
6. `AIEditor` — Prompt-driven AI editing
7. `WatermarkRemover` — Watermark removal with batch support
8. `ClothingTransfer` — Clothing transfer with spatial realism
9. `PatternGenerator` — Pattern generation

## Data Persistence
- **IndexedDB:** Gallery images persisted via `idb-keyval` (6.2.2)
- **Google Drive:** Cloud archiving and sync via Google Drive API
- **Local Storage:** Settings and preferences

## Code Intelligence
The project is indexed by GitNexus:
- **Indexed symbols:** ~2,932 symbols
- **Relationships:** ~4,782 relationships
- **Execution flows:** ~194 execution flows

## Architecture Pattern
```
Component (Thin UI) → Hook (State + Logic) → Service Facade → Gemini API
```

All image operations route through `src/services/imageEditingService.ts`, which delegates to Gemini service modules. Components never call services directly; they use paired hooks.

## Testing
- **Framework:** Vitest 4.0.17
- **Test location:** `__tests__/` mirrors `src/` structure
- **UI boundary tests:** `__tests__/components/ui-boundary-imports.test.ts` ensures components don't import services directly
