# STRUCTURE

## High-Level Layout

- `src/App.tsx` - app shell, feature switching, lazy loading, provider wiring.
- `src/index.tsx` - React mount.
- `index.html` - browser shell, GIS script, font loading, inline global styles.
- `src/types.ts` - shared feature and image types.
- `src/index.css` - global stylesheet entry.

## Source Directories

- `src/components/` - feature UIs and shared UI building blocks. Current tree contains about 50 TSX files when subfolders are included.
- `src/components/modals/` - modal UIs such as gallery and settings dialogs.
- `src/components/shared/` - small shared display components.
- `src/hooks/` - feature logic and async workflows.
- `src/contexts/` - global providers and accessor hooks.
- `src/services/` - provider clients, facades, and integration helpers.
- `src/services/gemini/` - Gemini-specific image, text, chat, and video code.
- `src/utils/` - pure helpers, caches, prompt builders, ZIP download helpers.
- `src/locales/` - translation source files (`en.ts`, `vi.ts`).
- `src/config/` - small config helpers such as `src/config/modelRegistry.ts`.
- `__tests__/` - test suites and shared mocks.

## Non-Source Directories Present in Repo

- `docs/` - hand-written project docs, some of which do not match current runtime source.
- `.planning/` - planning and mapping output.
- `plans/` - legacy or parallel plan artifacts.
- `dist/` - built output.
- `coverage/` - generated coverage artifacts.
- `node_modules/` - dependencies.

## Key Runtime Files by Area

### App Shell

- `src/App.tsx`
- `src/components/Header.tsx`
- `src/components/GalleryButton.tsx`
- `src/components/MobileMenuButton.tsx`
- `src/components/MobileOverlay.tsx`

### Provider State

- `src/contexts/ApiProviderContext.tsx`
- `src/contexts/LanguageContext.tsx`
- `src/contexts/ImageGalleryContext.tsx`
- `src/contexts/ImageViewerContext.tsx`
- `src/contexts/GoogleDriveContext.tsx`

### Provider Facade and Implementations

- `src/services/imageEditingService.ts`
- `src/services/apiClient.ts`
- `src/services/localProviderService.ts`
- `src/services/antiProviderService.ts`
- `src/services/googleDriveService.ts`
- `src/services/gemini/image.ts`
- `src/services/gemini/text.ts`
- `src/services/gemini/chat.ts`
- `src/services/gemini/video.ts`

### Representative Feature Pairs

- `src/components/LookbookGenerator.tsx` + `src/hooks/useLookbookGenerator.ts`
- `src/components/ClothingTransfer.tsx` + `src/hooks/useClothingTransfer.ts`
- `src/components/OutfitAnalysis.tsx` + `src/hooks/useOutfitAnalysis.ts`
- `src/components/PhotoAlbumCreator.tsx` + `src/hooks/usePhotoAlbum.ts`

## Placement Rules for New Code

- Add new feature screens under `src/components/`.
- Put feature business logic in `src/hooks/`.
- Put cross-feature reusable controls in `src/components/shared/`.
- Put new dialogs in `src/components/modals/`.
- Put provider-specific API code in `src/services/`.
- Put shared pure logic and prompt builders in `src/utils/`.
- Put new translation keys in both `src/locales/en.ts` and `src/locales/vi.ts`.
- Put test files under `__tests__/` grouped by area (`contexts`, `hooks`, `services`, `utils`, or `components`).

## Important Structural Quirks

- The `src/` directory is the application root. All runtime code lives here.
- Some root docs such as `ARCHITECTURE.md`, `CODEBASE.md`, and files under `docs/` describe removed or renamed integrations.
- `repomix-output.xml` contains snapshots of older code and should not be treated as current architecture.
