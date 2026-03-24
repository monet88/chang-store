# ARCHITECTURE

## Entry Flow

- `index.html` loads the GIS script, global styles, and mounts `index.tsx`.
- `index.tsx` renders `<App />` into `#root`.
- `App.tsx` owns the feature switcher state, lazy-loads feature screens, and wraps the provider stack.

## Provider Stack

The runtime provider order in `App.tsx` is:

1. `LanguageProvider`
2. `ToastProvider`
3. `ApiProvider`
4. `GoogleDriveProvider`
5. `ImageGalleryProvider`
6. `ImageViewerProvider`
7. `AppContent`

This stack means feature code can assume translation, provider settings, gallery state, image viewer state, and Drive auth are globally available.

## Application Shape

- Navigation is state-driven, not router-driven.
- `AppContent` stores `activeFeature` and switches feature UIs through a `switch` statement.
- Top-level features and modals are lazy-loaded with `React.lazy` and `Suspense`.
- `Feature` values are defined in `types.ts`.

## Layering

### Presentation

- Feature UIs live in `components/`.
- Modal UIs live in `components/modals/`.
- Shared leaf components live in `components/shared/`.

### Logic

- Feature logic is supposed to live in `hooks/`.
- Current repo is hybrid:
  - `components/LookbookGenerator.tsx` is a thin orchestrator over `hooks/useLookbookGenerator.ts`.
  - `components/ClothingTransfer.tsx` is a thin orchestrator over `hooks/useClothingTransfer.ts`.
  - `components/VirtualTryOn.tsx` still contains large amounts of logic inline.

### Global State

- Cross-feature state lives in `contexts/`.
- Contexts expose hook-style accessors such as `useApi`, `useImageGallery`, and `useGoogleDrive`.

### Service Layer

- AI provider routing is centralized in `services/imageEditingService.ts`.
- Provider-specific implementations live in `services/gemini/*`, `services/localProviderService.ts`, and `services/antiProviderService.ts`.
- Google Drive integration is split between `services/googleDriveService.ts` and `hooks/useGoogleDriveSync.ts`.

### Utilities

- Reusable pure logic lives in `utils/`.
- Prompt-building logic for the lookbook feature lives in `utils/lookbookPromptBuilder.ts`.
- Shared error translation helpers live in `utils/imageUtils.ts`.

## Canonical Data Flow

The best current pattern is:

`Component -> Hook -> Service facade -> Provider implementation -> Context side-effects`

Example:

- `components/LookbookGenerator.tsx`
- `hooks/useLookbookGenerator.ts`
- `services/imageEditingService.ts`
- `services/gemini/image.ts` or `services/localProviderService.ts` or `services/antiProviderService.ts`
- `contexts/ImageGalleryContext.tsx` for saved outputs

## Gallery and Sync Flow

- Generated images are kept in memory by `contexts/ImageGalleryContext.tsx`.
- If Google Drive is connected, gallery actions queue sync work through `hooks/useGoogleDriveSync.ts`.
- Google Drive file reads and writes are executed by `services/googleDriveService.ts`.

## UI Composition Notes

- `App.tsx` handles only app shell state, modal visibility, and feature switching.
- Feature-specific forms, generation state, and API calls should stay out of `App.tsx`.
- New features should follow the `LookbookGenerator` or `ClothingTransfer` split, not the `VirtualTryOn` inline pattern.

## Where New Code Should Go

- New feature screen: `components/FeatureName.tsx`
- New feature logic: `hooks/useFeatureName.ts`
- New provider routing or facade behavior: `services/imageEditingService.ts`
- New provider-specific implementation: `services/` or `services/gemini/`
- New global state: `contexts/FeatureContext.tsx`
- New pure prompt or transformation logic: `utils/`
