# STRUCTURE

## High-Level Layout

- `App.tsx` - app shell, feature switching, lazy loading, provider wiring.
- `index.tsx` - React mount.
- `index.html` - browser shell, GIS script, font loading, inline global styles.
- `types.ts` - shared feature and image types.
- `src/index.css` - global stylesheet entry.

## Source Directories

- `components/` - feature UIs and shared UI building blocks. Current tree contains about 50 TSX files when subfolders are included.
- `components/modals/` - modal UIs such as gallery and settings dialogs.
- `components/shared/` - small shared display components.
- `hooks/` - feature logic and async workflows.
- `contexts/` - global providers and accessor hooks.
- `services/` - provider clients, facades, and integration helpers.
- `services/gemini/` - Gemini-specific image, text, chat, and video code.
- `utils/` - pure helpers, caches, prompt builders, ZIP download helpers.
- `locales/` - translation source files (`en.ts`, `vi.ts`).
- `config/` - small config helpers such as `config/modelRegistry.ts`.
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

- `App.tsx`
- `components/Header.tsx`
- `components/GalleryButton.tsx`
- `components/MobileMenuButton.tsx`
- `components/MobileOverlay.tsx`

### Provider State

- `contexts/ApiProviderContext.tsx`
- `contexts/LanguageContext.tsx`
- `contexts/ImageGalleryContext.tsx`
- `contexts/ImageViewerContext.tsx`
- `contexts/GoogleDriveContext.tsx`

### Provider Facade and Implementations

- `services/imageEditingService.ts`
- `services/apiClient.ts`
- `services/localProviderService.ts`
- `services/antiProviderService.ts`
- `services/googleDriveService.ts`
- `services/gemini/image.ts`
- `services/gemini/text.ts`
- `services/gemini/chat.ts`
- `services/gemini/video.ts`

### Representative Feature Pairs

- `components/LookbookGenerator.tsx` + `hooks/useLookbookGenerator.ts`
- `components/ClothingTransfer.tsx` + `hooks/useClothingTransfer.ts`
- `components/OutfitAnalysis.tsx` + `hooks/useOutfitAnalysis.ts`
- `components/PhotoAlbumCreator.tsx` + `hooks/usePhotoAlbum.ts`

## Placement Rules for New Code

- Add new feature screens under `components/`.
- Put feature business logic in `hooks/`.
- Put cross-feature reusable controls in `components/shared/`.
- Put new dialogs in `components/modals/`.
- Put provider-specific API code in `services/`.
- Put shared pure logic and prompt builders in `utils/`.
- Put new translation keys in both `locales/en.ts` and `locales/vi.ts`.
- Put test files under `__tests__/` grouped by area (`contexts`, `hooks`, `services`, `utils`, or `components`).

## Important Structural Quirks

- The `src/` directory is not the main application root; it currently holds CSS only.
- Some root docs such as `ARCHITECTURE.md`, `CODEBASE.md`, and files under `docs/` describe removed or renamed integrations.
- `repomix-output.xml` contains snapshots of older code and should not be treated as current architecture.
